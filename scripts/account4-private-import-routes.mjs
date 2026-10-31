import {startPersistedPrivateImport,uploadPersistedPrivatePart,finishPersistedPrivateImport} from './account4-import-workflow.mjs';
import {loadImportSession} from './account4-import-d1.mjs';
import {inspectPrivateImportRecovery} from './account4-import-recovery.mjs';
import {reconcileCompletedPrivateImport} from './account4-import-reconcile.mjs';
import {PART_BYTES,validatePart} from './account4-upload-policy.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function problem(message,status=400){throw Object.assign(new Error(message),{status});}
async function boundedBytes(request,maxBytes){
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))problem('Request body exceeds the allowed size',413);
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader(),chunks=[];let total=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();problem('Request body exceeds the allowed size',413);}chunks.push(value);}
  }finally{reader.releaseLock();}
  const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}
  return out;
}
async function jsonBody(request){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))problem('Send a JSON request',415);
  const bytes=await boundedBytes(request,4096);
  let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{problem('Invalid JSON request');}
  if(!value||typeof value!=='object'||Array.isArray(value))problem('A JSON object is required');
  return value;
}
function ownerActor(user){
  if(user?.kind!=='staff'||user?.role!=='owner'||user?.status!=='active'||!Number.isSafeInteger(user.id)||user.id<1)
    problem('Only the signed-in primary owner can manage private imports',403);
  return {id:user.id,authenticated:true,canImport:true,canPublish:true,role:'owner'};
}
async function requireSchema(db){
  const rows=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('account4_import_sessions','account4_import_parts')").all();
  const names=new Set((rows?.results||[]).map(row=>row.name));
  if(!names.has('account4_import_sessions')||!names.has('account4_import_parts'))
    problem('Account 4 private-import database migrations must be applied before uploads are enabled',503);
}
function publicSession(row){
  return {id:row.id,name:row.filename,size:row.size_bytes,partCount:row.part_count,
    uploadedParts:row.uploaded_parts,state:row.state,expiresAt:row.expires_at_ms,createdAt:row.created_at};
}
export async function account4PrivateImportRoutes(request,env,user,sub,method,withLock,auditEvent){
  if(!sub.startsWith('workspace/imports'))return null;
  const actor=ownerActor(user);
  if(!env?.DB||!env?.FILES)problem('Private import storage is not configured',503);
  await requireSchema(env.DB);
  if(sub==='workspace/imports'&&method==='GET'){
    const rows=await env.DB.prepare("SELECT s.id,s.filename,s.size_bytes,s.part_count,s.state,s.expires_at_ms,s.created_at,(SELECT COUNT(*) FROM account4_import_parts p WHERE p.session_id=s.id) AS uploaded_parts FROM account4_import_sessions s WHERE s.owner_id=? ORDER BY s.created_at DESC LIMIT 20").bind(actor.id).all();
    return Response.json({imports:(rows.results||[]).map(publicSession),maxConcurrentUploads:3,notice:'Uploaded objects remain private. Completion does not scan, publish or deploy them.'},{headers:{'cache-control':'no-store'}});
  }
  if(sub==='workspace/imports'&&method==='POST'){
    const input=await jsonBody(request);
    if(typeof input.name!=='string'||!Number.isSafeInteger(input.size))problem('Provide a filename and an integer byte size');
    const create=async()=>{
      await env.DB.prepare("UPDATE account4_import_sessions SET state='expired' WHERE owner_id=? AND state IN ('uploading','completing') AND expires_at_ms<=?").bind(actor.id,Date.now()).run();
      const active=await env.DB.prepare("SELECT COUNT(*) AS count FROM account4_import_sessions WHERE owner_id=? AND state IN ('uploading','completing') AND expires_at_ms>?").bind(actor.id,Date.now()).first();
      if((active?.count||0)>=3)problem('You already have three active uploads. Complete or reconcile one first.',429);
      return startPersistedPrivateImport(env.FILES,env.DB,actor,{name:input.name,size:input.size});
    };
    if(typeof withLock!=='function')problem('Safe private-import concurrency control is unavailable',503);
    const result=await withLock('account4-private-import-start:'+actor.id,create);
    if(auditEvent)await auditEvent('private-import-started',result.id+' '+result.name+' '+result.size+' bytes');
    return Response.json({...result,notice:'Private staging only. Malware scanning and explicit release approval are still required.'},{status:201,headers:{'cache-control':'no-store'}});
  }
  let match=sub.match(/^workspace\/imports\/([0-9a-f-]{36})(?:\/(parts\/(\d+)|complete|recovery|reconcile))?$/i);
  if(!match||!UUID.test(match[1]))problem('Invalid private import route',404);
  const id=match[1],action=match[2]||'status';
  if(action==='status'&&method==='GET'){
    const row=await env.DB.prepare("SELECT s.id,s.filename,s.size_bytes,s.part_count,s.state,s.expires_at_ms,s.created_at,(SELECT COUNT(*) FROM account4_import_parts p WHERE p.session_id=s.id) AS uploaded_parts FROM account4_import_sessions s WHERE s.id=? AND s.owner_id=?").bind(id,actor.id).first();
    if(!row)problem('Private import not found',404);
    return Response.json({import:publicSession(row)},{headers:{'cache-control':'no-store'}});
  }
  const mutateSession=fn=>{
    if(typeof withLock!=='function')problem('Safe private-import concurrency control is unavailable',503);
    return withLock('account4-private-import-session:'+id,fn);
  };
  if(action.startsWith('parts/')&&method==='PUT'){
    const session=await loadImportSession(env.DB,actor,id);
    const partNumber=Number(match[3]);
    if(!Number.isSafeInteger(partNumber))problem('Invalid part number');
    const expected=Math.min(PART_BYTES,session.size-(partNumber-1)*PART_BYTES);
    if(expected<1)problem('Invalid part number');
    const bytes=await boundedBytes(request,PART_BYTES);
    validatePart({partNumber,byteLength:bytes.byteLength},session);
    // Serialize every mutation for this upload. This prevents two retries of
    // the same R2 part from persisting an ETag that no longer matches the
    // final object, and prevents completion racing an in-flight part receipt.
    const result=await mutateSession(()=>uploadPersistedPrivatePart(env.FILES,env.DB,actor,id,partNumber,bytes));
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  }
  if(action==='complete'&&method==='POST'){
    const result=await mutateSession(()=>finishPersistedPrivateImport(env.FILES,env.DB,actor,id));
    if(auditEvent)await auditEvent('private-import-completed',id+' private-awaiting-review');
    return Response.json({...result,notice:'The object remains private and awaits separate security review.'},{headers:{'cache-control':'no-store'}});
  }
  if(action==='recovery'&&method==='GET'){
    const result=await inspectPrivateImportRecovery(env.DB,env.FILES,actor,id);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  }
  if(action==='reconcile'&&method==='POST'){
    const result=await mutateSession(()=>reconcileCompletedPrivateImport(env.DB,env.FILES,actor,id));
    if(auditEvent)await auditEvent('private-import-reconciled',id+' private-awaiting-review');
    return Response.json({...result,notice:'Reconciled to private review only. Not scanned, published or deployed.'},{headers:{'cache-control':'no-store'}});
  }
  problem('Method not allowed',405);
}
