// Owner-only resumable R2 multipart uploads. 1 GiB maximum, 10 MiB parts.
// Uploads are private staging objects, never automatically deployed or executed.
const LARGE_UPLOAD_MAX=1024*1024*1024, LARGE_UPLOAD_PART=10*1024*1024;
async function largeUploadRoutes(req,env,user,sub,m){
 if(!sub.startsWith('workspace/large-upload/'))return null;
 if(user.role!=='owner'||user.kind!=='staff')fail('Owner access required',403);
 const action=sub.slice('workspace/large-upload/'.length),u=new URL(req.url);
 if(action==='start'&&m==='POST'){
  const b=await body(req),size=Number(b.size),name=String(b.name||'');
  if(!Number.isSafeInteger(size)||size<1||size>LARGE_UPLOAD_MAX)fail('File must be 1 byte to 1 GiB',413);
  if(name.length<1||name.length>180||/[\\/\x00-\x1f]/.test(name)||name==='.'||name==='..')fail('Invalid filename',400);
  const id=crypto.randomUUID(),key='large-staging/'+user.id+'/'+id+'/'+name;
  const upload=await env.FILES.createMultipartUpload(key);
  const state={id,key,name,size,uploadId:upload.uploadId,user:user.id,status:'uploading',created:Date.now(),parts:[]};
  await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('large-upload:'+id,JSON.stringify(state)).run();
  await audit(env,user.username,'large-upload-start',id+' '+size);
  return json({id,name,size,part_size:LARGE_UPLOAD_PART,max_size:LARGE_UPLOAD_MAX,parts:[],status:'uploading'});
 }
 const id=u.searchParams.get('id');
 if(!/^[a-f0-9-]{36}$/.test(id||''))fail('Invalid upload ID',400);
 return withOperationLock(env,'large-upload:'+id,async()=>{
  const key='large-upload:'+id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
  if(!row)fail('Upload not found',404);
  const s=JSON.parse(row.value_json);
  if(s.user!==user.id)fail('Upload owner mismatch',403);
  const save=()=>env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(s),key).run();
  if(action==='status'&&m==='GET')return json({id:s.id,name:s.name,size:s.size,status:s.status,part_size:LARGE_UPLOAD_PART,parts:s.parts.map(p=>({partNumber:p.partNumber,size:p.size})),uploaded_bytes:s.parts.reduce((n,p)=>n+p.size,0)});
  if(s.status!=='uploading')fail('Upload is not active',409);
  if(Date.now()-s.created>24*3600000)fail('Upload expired. Start a new transfer.',410);
  const upload=env.FILES.resumeMultipartUpload(s.key,s.uploadId);
  if(action==='part'&&m==='PUT'){
   const n=Number(u.searchParams.get('part')),total=Math.ceil(s.size/LARGE_UPLOAD_PART);
   if(!Number.isSafeInteger(n)||n<1||n>total)fail('Invalid part number',400);
   const expected=n===total?s.size-(n-1)*LARGE_UPLOAD_PART:LARGE_UPLOAD_PART;
   const len=Number(req.headers.get('content-length'));
   if(!Number.isSafeInteger(len)||len!==expected)fail('Incorrect chunk size',413);
   if(s.parts.some(p=>p.partNumber===n))fail('Chunk already stored; refresh upload status',409);
   const bytes=await req.arrayBuffer();
   if(bytes.byteLength!==expected)fail('Chunk length mismatch',413);
   const part=await upload.uploadPart(n,bytes);
   s.parts.push({partNumber:n,etag:part.etag,size:expected});await save();
   return json({ok:true,part:n,uploaded_bytes:s.parts.reduce((sum,p)=>sum+p.size,0)});
  }
  if(action==='complete'&&m==='POST'){
   const total=Math.ceil(s.size/LARGE_UPLOAD_PART);
   const ordered=[...s.parts].sort((a,b)=>a.partNumber-b.partNumber);
   if(ordered.length!==total||ordered.some((p,i)=>p.partNumber!==i+1)||ordered.reduce((n,p)=>n+p.size,0)!==s.size)fail('Upload is incomplete',409);
   s.status='finalizing';await save();
   try{await upload.complete(ordered.map(p=>({partNumber:p.partNumber,etag:p.etag})));const obj=await env.FILES.head(s.key);if(!obj||obj.size!==s.size)throw Error('R2 size verification failed');s.status='stored';await save();await audit(env,user.username,'large-upload-stored',s.id+' '+s.size);return json({ok:true,id:s.id,status:'stored',name:s.name,size:s.size,notice:'Private R2 storage only. Separate scan, preview and owner approval are required before publication.'});}
   catch(e){s.status='uncertain';await save();fail('Completion outcome uncertain. Inspect object before retry.',502);}
  }
  if(action==='cancel'&&m==='POST'){await upload.abort();s.status='cancelled';await save();await audit(env,user.username,'large-upload-cancel',s.id);return json({ok:true,status:'cancelled'});}
  fail('Unsupported large upload action',405);
 });
}
