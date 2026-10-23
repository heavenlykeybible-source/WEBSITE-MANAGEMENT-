interface UploadEnv {DB:D1Database;MEDIA_R2:R2Bucket}
export const MAX_MEDIA_BYTES=2*1024*1024*1024;
const CHUNK=8*1024*1024;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function multipartUpload(request:Request,env:UploadEnv,actor:string):Promise<Response|null>{
 const match=new URL(request.url).pathname.match(/^\/api\/media\/(\d+)\/multipart(?:\/(status|complete|abort|part\/(\d+)))?$/);
 if(!match)return null;
 const id=Number(match[1]),action=match[2]||'start';
 const media=await env.DB.prepare('SELECT object_key,mime_type,size_bytes,status FROM media_objects WHERE media_id=?').bind(id).first<any>();
 if(!media||media.status==='deleted')return json({error:'Media not found'},404);
 let upload=await env.DB.prepare('SELECT * FROM media_uploads WHERE media_id=?').bind(id).first<any>();
 if(upload&&upload.actor_id!==actor)return json({error:'This upload belongs to another administrator'},403);
 if(action==='start'&&request.method==='POST'){
  if(media.status!=='pending'&&media.status!=='failed')return json({error:'This media is already uploaded'},409);
  if(!Number.isSafeInteger(media.size_bytes)||media.size_bytes<1||media.size_bytes>MAX_MEDIA_BYTES)return json({error:'Choose a file up to 2 GB'},400);
  if(upload?.status==='uploading'&&new Date(upload.expires_at).getTime()>Date.now())return json({upload_id:upload.upload_id,chunk_bytes:CHUNK,total_bytes:media.size_bytes});
  if(upload?.status==='uploading'){try{await env.MEDIA_R2.resumeMultipartUpload(media.object_key,upload.upload_id).abort();}catch{console.warn('Previous multipart cleanup failed',id);}}
  const started=await env.MEDIA_R2.createMultipartUpload(media.object_key,{httpMetadata:{contentType:media.mime_type}});
  await env.DB.prepare('DELETE FROM media_upload_parts WHERE media_id=?').bind(id).run();
  await env.DB.prepare("INSERT INTO media_uploads(media_id,upload_id,actor_id,chunk_bytes,total_bytes,status,expires_at) VALUES(?,?,?,?,?,'uploading',?) ON CONFLICT(media_id) DO UPDATE SET upload_id=excluded.upload_id,actor_id=excluded.actor_id,total_bytes=excluded.total_bytes,status='uploading',expires_at=excluded.expires_at").bind(id,started.uploadId,actor,CHUNK,media.size_bytes,new Date(Date.now()+24*3600000).toISOString()).run();
  return json({upload_id:started.uploadId,chunk_bytes:CHUNK,total_bytes:media.size_bytes},201);
 }
 if(!upload)return json({error:'Start the upload first'},404);
 if(action==='status'&&request.method==='GET'){
  const parts=await env.DB.prepare('SELECT part_number,size_bytes FROM media_upload_parts WHERE media_id=? ORDER BY part_number').bind(id).all();
  return json({status:upload.status,chunk_bytes:CHUNK,total_bytes:upload.total_bytes,parts:parts.results,expires_at:upload.expires_at});
 }
 if(upload.status!=='uploading')return json({error:'This upload is no longer active'},409);
 const transfer=env.MEDIA_R2.resumeMultipartUpload(media.object_key,upload.upload_id);
 if(action==='abort'&&request.method==='POST'){
  await transfer.abort();await env.DB.prepare("UPDATE media_uploads SET status='aborted' WHERE media_id=?").bind(id).run();return json({ok:true});
 }
 if(new Date(upload.expires_at).getTime()<=Date.now())return json({error:'Upload expired. Start again.'},410);
 if(action.startsWith('part/')&&request.method==='PUT'){
  const part=Number(match[3]),count=Math.ceil(upload.total_bytes/CHUNK);
  if(!Number.isSafeInteger(part)||part<1||part>count||!request.body)return json({error:'Invalid upload part'},400);
  const expected=Math.min(CHUNK,upload.total_bytes-(part-1)*CHUNK),reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>expected){await reader.cancel();return json({error:'Upload part is too large'},413);}chunks.push(next.value);}
  if(size!==expected)return json({error:'Upload part is incomplete'},400);
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const result=await transfer.uploadPart(part,bytes);
  await env.DB.prepare('INSERT INTO media_upload_parts(media_id,part_number,etag,size_bytes) VALUES(?,?,?,?) ON CONFLICT(media_id,part_number) DO UPDATE SET etag=excluded.etag,size_bytes=excluded.size_bytes').bind(id,part,result.etag,size).run();
  return json({ok:true,part_number:part,size_bytes:size});
 }
 if(action==='complete'&&request.method==='POST'){
  const rows=await env.DB.prepare('SELECT part_number,etag,size_bytes FROM media_upload_parts WHERE media_id=? ORDER BY part_number').bind(id).all<any>();
  const parts=rows.results,count=Math.ceil(upload.total_bytes/CHUNK);
  if(parts.length!==count||parts.some((p,i)=>p.part_number!==i+1)||parts.reduce((sum,p)=>sum+p.size_bytes,0)!==upload.total_bytes)return json({error:'Some upload parts are missing. Resume the upload.'},409);
  await transfer.complete(parts.map(p=>({partNumber:p.part_number,etag:p.etag})));
  const object=await env.MEDIA_R2.head(media.object_key);if(!object||object.size!==upload.total_bytes)return json({error:'Uploaded size could not be verified'},409);
  await env.DB.prepare("UPDATE media_objects SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(id).run();
  await env.DB.prepare("UPDATE media_uploads SET status='completed' WHERE media_id=?").bind(id).run();
  await env.DB.prepare('INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES(?,?,?,?)').bind(actor,'media.upload.complete','media',String(id)).run();
  return json({ok:true,media_id:id,size_bytes:object.size});
 }
 return json({error:'Unsupported upload action'},405);
}
