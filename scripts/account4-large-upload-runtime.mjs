// Account 4 private owner-only 1 GiB resumable R2 upload staging.
// Staged bytes never become site files or deployments without a separate owner review.
const ACCOUNT4_PART_SIZE=8*1024*1024;
const ACCOUNT4_MAX_UPLOAD=1024*1024*1024;
function account4PartPlan(total){
 if(!Number.isSafeInteger(total)||total<1||total>ACCOUNT4_MAX_UPLOAD)throw Error('Invalid upload size');
 return {parts:Math.ceil(total/ACCOUNT4_PART_SIZE),partSize:ACCOUNT4_PART_SIZE};
}
async function account4MultipartRoutes(req,env,user,sub,m){
 if(!sub.startsWith('multipart/'))return null;
 if(user.role!=='owner'||user.kind==='member')fail('Only the owner can stage large uploads',403);
 if(!env.FILES||!env.DB)fail('Private storage is not configured',503);
 const validId=/^[a-f0-9-]{36}$/;
 const endpoint=sub.slice('multipart/'.length);
 if(endpoint==='create'&&m==='POST'){
  const b=await body(req),size=Number(b.size),filename=String(b.name||'').trim();
  if(!Number.isSafeInteger(size)||size<1||size>ACCOUNT4_MAX_UPLOAD)fail('Maximum allowed private upload is 1 GiB',413);
  if(!filename||filename.length>180||filename.includes('/')||filename.includes('\\')||Array.from(filename).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)||filename==='.'||filename==='..')fail('Enter a safe filename');
  const plan=account4PartPlan(size),count=await env.DB.prepare('SELECT key,value_json FROM settings WHERE key LIKE ?').bind('multipart:'+user.id+':%').all();
  if(count.results.filter(r=>{const v=JSON.parse(r.value_json);return v.status==='uploading'&&v.expires>Date.now();}).length>=3)fail('Finish or cancel an existing large upload before opening another',429);
  const id=crypto.randomUUID(),key='owner-staging/'+user.id+'/'+id+'/upload',upload=await env.FILES.createMultipartUpload(key);
  const record={id,key,uploadId:upload.uploadId,user:user.id,name:filename,size,parts:plan.parts,received:{},status:'uploading',expires:Date.now()+24*3600000};
  try{await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('multipart:'+user.id+':'+id,JSON.stringify(record)).run();}
  catch(e){await upload.abort();throw e;}
  return json({id,size,part_size:ACCOUNT4_PART_SIZE,parts:plan.parts,expires_at:record.expires,notice:'Private staging only. No publication or website import.'},201);
 }
 const match=endpoint.match(/^([a-f0-9-]{36})(?:\/(status|finish|abort|part\/(\d{1,3})))?$/);
 if(!match||!validId.test(match[1]))fail('Unknown upload operation',404);
 const id=match[1],action=match[2]||'status',dbKey='multipart:'+user.id+':'+id;
 return withOperationLock(env,'multipart:'+user.id+':'+id,async()=>{
  const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(dbKey).first();
  if(!row)fail('Upload not found',404);
  const r=JSON.parse(row.value_json);
  if(r.user!==user.id||r.expires<Date.now())fail('Upload session expired or inaccessible',410);
  if(action==='status'&&m==='GET')return json({id:r.id,name:r.name,size:r.size,part_size:ACCOUNT4_PART_SIZE,parts:r.parts,received:Object.keys(r.received).map(Number).sort((a,b)=>a-b),status:r.status,expires_at:r.expires});
  if(r.status!=='uploading')fail('Upload is no longer accepting parts',409);
  const upload=env.FILES.resumeMultipartUpload(r.key,r.uploadId);
  if(action.startsWith('part/')&&m==='PUT'){
   const n=Number(match[3]);if(!Number.isSafeInteger(n)||n<1||n>r.parts)fail('Invalid part number',400);
   const expected=n===r.parts?r.size-ACCOUNT4_PART_SIZE*(r.parts-1):ACCOUNT4_PART_SIZE;
   if(String(req.headers.get('content-type')||'').split(';')[0].toLowerCase()!=='application/octet-stream')fail('Upload parts as application/octet-stream',415);
   const bytes=await readLimited(req,ACCOUNT4_PART_SIZE+1);
   if(bytes.byteLength!==expected)fail('Incorrect chunk size; retry this part',413);
   const part=await upload.uploadPart(n,bytes);
   if(!part?.etag||part.partNumber!==n)fail('R2 did not confirm this uploaded part',502);
   r.received[n]={partNumber:n,etag:part.etag};
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(r),dbKey).run();
   return json({ok:true,part_number:n,received:Object.keys(r.received).length,total:r.parts});
  }
  if(action==='finish'&&m==='POST'){
   const completed=Array.from({length:r.parts},(_,i)=>r.received[i+1]);
   if(completed.some(x=>!x))fail('Every upload part must be received before completion',409);
   const object=await upload.complete(completed);
   if(!object||object.size!==r.size){
    await env.FILES.delete(r.key);
    r.status='invalid';
    await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(r),dbKey).run();
    fail('Uploaded object size did not match the declared size',409);
   }
   r.status='staged';r.completed_at=Date.now();r.etag=object.httpEtag||object.etag||'';
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(r),dbKey).run();
   await audit(env,user.username,'private-multipart-staged','Upload '+id+' size '+r.size);
   return json({ok:true,id,status:'staged',size:r.size,notice:'Private staging complete. File was not published or imported.'});
  }
  if(action==='abort'&&m==='POST'){
   await upload.abort();r.status='aborted';r.received={};
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(r),dbKey).run();
   return json({ok:true,status:'aborted'});
  }
  fail('Method not allowed',405);
 });
}
