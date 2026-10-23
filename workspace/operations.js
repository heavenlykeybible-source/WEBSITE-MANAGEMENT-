// Owner operations use saved encrypted connections; no provider credential reaches the browser.
function controlZip(files){
 const chunks=[],central=[];let offset=0,centralSize=0;
 for(const f of files){const name=new TextEncoder().encode(f.path),bytes=f.bytes,crc=zipCRC(bytes),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,bytes);
  const header=new Uint8Array(46+name.length),c=new DataView(header.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);header.set(name,46);central.push(header);centralSize+=header.length;offset+=local.length+bytes.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 const out=new Uint8Array(offset+centralSize+22);let pos=0;for(const b of [...chunks,...central,end]){out.set(b,pos);pos+=b.length;}return out;
}
async function controlSitePackage(env,slug){
 const site=await siteBySlug(env,slug),rows=(await env.DB.prepare('SELECT path,r2_key,size FROM site_files WHERE site_id=? ORDER BY path').bind(site.id).all()).results;
 if(!rows.length||rows.length>MAX_FILES||rows.reduce((n,f)=>n+f.size,0)>PACKAGE_LIMIT)fail('Backup supports a complete managed site up to '+MAX_FILES+' files and 25 MB. No partial backup was made.',413);
 const files=[];let total=0;for(const f of rows){cleanPath(f.path);const object=await env.FILES.get(f.r2_key);if(!object)fail('Backup source missing: '+f.path,409);const bytes=new Uint8Array(await object.arrayBuffer());total+=bytes.length;if(total>PACKAGE_LIMIT)fail('Site exceeds backup limit; no partial backup was made.',413);files.push({path:f.path,bytes});}
 return {site,bytes:controlZip(files),count:files.length};
}
async function controlWorkerHistory(env, connection, worker) {
 const c=await connById(env,connection);
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(worker))fail('Choose an existing Worker');
 const data=await cf(env,c,'GET','/workers/scripts/'+worker+'/deployments');
 const deployments=data.result?.deployments;
 if(!Array.isArray(deployments)||!deployments.length)fail('No deployment history returned',409);
 deployments.sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
 const current=deployments[0], active=new Set((current.versions||[]).map(v=>v.version_id)), seen=new Set(), previous=[];
 for(const d of deployments.slice(1))for(const v of d.versions||[]){
  if(!active.has(v.version_id)&&!seen.has(v.version_id)){seen.add(v.version_id);previous.push({id:v.version_id,created_on:d.created_on});}
 }
 return {c,current,previous:previous.slice(0,3)};
}
async function controlOperationsRoutes(req,env,user,sub,method) {
 if(!sub.startsWith('operations/'))return null;
 if(user.role!=='owner'||user.kind==='member')fail('Owner access required',403);
 const url=new URL(req.url),actor={kind:'owner',agentId:await userAgentId(env,user),user,ow:null};
 if(sub==='operations/worker-health'&&method==='GET'){
  const c=await connById(env,url.searchParams.get('connection')),worker=url.searchParams.get('worker')||'';
  if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(worker))fail('Invalid Worker name');
  const account=await cf(env,c,'GET','/workers/subdomain'),suffix=account.result?.subdomain;
  if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(suffix||''))fail('No public Workers subdomain is configured',409);
  const r=await fetch('https://'+worker+'.'+suffix+'.workers.dev/',{redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(r.body)await r.body.cancel();return json({checked_at:new Date().toISOString(),status:r.status,responding:r.status<500,notice:'Public HTTP response only; this does not verify every feature or custom-domain routing.'});
 }
 if(sub==='operations/site-backup'&&(method==='POST'||method==='GET')){
  const b=method==='POST'?await body(req):{site:url.searchParams.get('site'),destination:'download'},pack=await controlSitePackage(env,b.site),name=pack.site.slug+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip';
  if(b.destination==='download')return new Response(pack.bytes,{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="'+name+'"','cache-control':'no-store'}});
  if(b.destination==='github'){
   const g=await ghById(env,b.github,scopeOf(actor)),branch='controlroom-backup/'+crypto.randomUUID(),blob=await gh(env,g,'POST','/git/blobs',{content:bytesBase64(pack.bytes),encoding:'base64'});
   const tree=await gh(env,g,'POST','/git/trees',{tree:[{path:name,mode:'100644',type:'blob',sha:blob.sha}]});
   const commit=await gh(env,g,'POST','/git/commits',{message:'Managed site backup: '+pack.site.name,tree:tree.sha,parents:[]});
   const receipt=await gh(env,g,'POST','/git/refs',{ref:'refs/heads/'+branch,sha:commit.sha});if(receipt.object?.sha!==commit.sha)fail('Backup receipt mismatch',502);
   await audit(env,user.username,'site-github-backup',pack.site.slug+' '+commit.sha);
   return json({ok:true,url:'https://github.com/'+g.repo+'/blob/'+branch+'/'+name,files:pack.count,coverage:'All managed site files. External databases and secret values are excluded.'});
  }
  if(b.destination==='drive'){
   const c=await driveConfig(env),token=await driveToken(c,'https://www.googleapis.com/auth/drive.file'),metadata={name,parents:[driveId(c.folder)]},boundary='backup-'+crypto.randomUUID();
   const content=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/zip\r\n\r\n',pack.bytes,'\r\n--'+boundary+'--\r\n']);
   const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,webViewLink',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{authorization:'Bearer '+token,'content-type':'multipart/related; boundary='+boundary},body:content});
   if(!r.ok)fail('Google Drive did not confirm backup. The connected service account needs permission to create files in a shared drive folder; a Viewer-only folder cannot accept backups. Existing source access was preserved.',502);
   const receipt=await r.json();if(!receipt.id||Number(receipt.size)!==pack.bytes.length)fail('Drive backup size could not be verified; inspect Drive before retrying.',502);
   await audit(env,user.username,'site-drive-backup',pack.site.slug+' '+receipt.id);return json({ok:true,url:'https://drive.google.com/file/d/'+driveId(receipt.id)+'/view',files:pack.count,coverage:'All managed site files. External databases and secret values are excluded.'});
  }
  fail('Choose download, GitHub or Google Drive');
 }
 if(sub==='operations/site-versions'&&method==='GET'){
  const site=await siteBySlug(env,url.searchParams.get('site')),r=await env.DB.prepare("SELECT key,value_json FROM settings WHERE key LIKE ? ORDER BY rowid DESC LIMIT 3").bind('control:site-version:'+site.id+':%').all();
  return json({versions:r.results.map(r=>({id:r.key.split(':').at(-1),...JSON.parse(r.value_json)}))});
 }
 if(sub==='operations/site-recovery'&&method==='POST'){
  const b=await body(req),site=await siteBySlug(env,b.site),r=await env.DB.prepare("SELECT key,value_json FROM settings WHERE key LIKE ? ORDER BY rowid DESC LIMIT 3").bind('control:site-version:'+site.id+':%').all(),saved=r.results.find(r=>r.key.split(':').at(-1)===String(b.version));
  if(!saved)fail('Choose one of the three previous site versions',409);
  const previous=JSON.parse(saved.value_json),current=(await env.DB.prepare('SELECT path,r2_key,size FROM site_files WHERE site_id=? ORDER BY path').bind(site.id).all()).results;
  const paths=new Set(previous.files.map(f=>f.path));for(const f of [...previous.files,...current])protectSourcePath(cleanPath(f.path));
  const id=await newUpload(env,actor,site,'Restore site version '+b.version,'Full managed-site file recovery. Review the live preview before approval.');
  try{
   for(const f of previous.files){const object=await env.FILES.get(f.r2_key);if(!object)fail('A version file is missing. Recovery blocked.',409);const copy=await storeUploadObject(env,id,f.path,object.body);await env.DB.prepare(UPSERT_FILE).bind(id,f.path,f.size,copy.key,copy.etag).run();}
   for(const f of current)if(!paths.has(f.path))await env.DB.prepare('INSERT INTO upload_files(proposal_id,path,size,deleted) VALUES(?,?,0,1)').bind(id,f.path).run();
   await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('proposal:site-recovery:'+id,JSON.stringify(current)).run();
   await coreFinalize(env,actor,id);return json({ok:true,proposal_id:id});
  }catch(e){await env.DB.prepare("UPDATE proposals SET status='rejected',sealed=1 WHERE id=?").bind(id).run();throw e;}
 }
 if(sub==='operations/github-backup'&&method==='POST'){
  const b=await body(req),g=await ghById(env,b.site,scopeOf(actor)),head=await ghHead(env,g);
  // A new branch preserves every repository file and commit ancestry without rewriting production.
  const branch='controlroom-backup/'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8);
  const ref=await gh(env,g,'POST','/git/refs',{ref:'refs/heads/'+branch,sha:head.commit});
  if(ref.object?.sha!==head.commit)fail('GitHub backup receipt did not match the source',502);
  await audit(env,user.username,'github-source-backup',g.repo+' '+head.commit+' '+branch);
  return json({ok:true,branch,commit:head.commit,url:'https://github.com/'+g.repo+'/tree/'+branch,coverage:'Complete Git repository source and history. External databases, uploads and secret values are excluded.'});
 }
 if(sub==='operations/worker-history'&&method==='GET'){
  const h=await controlWorkerHistory(env,url.searchParams.get('connection'),url.searchParams.get('worker')||'');
  return json({current:h.current,previous:h.previous});
 }
 if(sub==='operations/worker-recovery'&&method==='POST'){
  const b=await body(req),worker=String(b.worker||'');protectWorker(env,worker);
  const history=await controlWorkerHistory(env,b.connection,worker);
  if(!history.previous.some(v=>v.id===b.version))fail('Choose one of the three previous deployed versions',409);
  const version=await cf(env,history.c,'GET','/workers/scripts/'+worker+'/versions/'+encodeURIComponent(b.version));
  if(version.result?.id!==b.version)fail('Version could not be verified',409);
  const id=crypto.randomUUID(),review={id,user:user.id,connection:history.c.id,worker,version:b.version,baseline:history.current.id,status:'waiting',expires:Date.now()+15*60000};
  await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('control:recovery:'+id,JSON.stringify(review)).run();
  await audit(env,user.username,'worker-recovery-review',worker+' '+b.version);
  return json({review,notice:'Review the selected version in Cloudflare before approving. Code rollback does not restore database or uploaded-file contents.'});
 }
 if(sub==='operations/worker-recovery/decide'&&method==='POST'){
  const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(String(b.id))||!['approve','decline'].includes(b.decision))fail('Choose a recovery decision');
  return withOperationLock(env,'publication:global',async()=>{
   const key='control:recovery:'+b.id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
   if(!row)fail('Review not found',404);const review=JSON.parse(row.value_json);
   if(review.user!==user.id||review.status!=='waiting'||review.expires<Date.now())fail('Review expired or already decided',409);
   if(b.decision==='decline'){review.status='declined';await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(review),key).run();return json({ok:true,status:'declined'});}
   if(b.reviewed!==true)fail('Confirm you reviewed the selected version');
   await reauthenticate(env,user,b.password);protectWorker(env,review.worker);
   const current=await controlWorkerHistory(env,review.connection,review.worker);
   if(current.current.id!==review.baseline)fail('Deployment changed. Prepare a new review.',409);
   review.status='applying';await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(review),key).run();
   try{
    const result=await cf(env,current.c,'POST','/workers/scripts/'+review.worker+'/deployments',{strategy:'percentage',versions:[{version_id:review.version,percentage:100}],annotations:{'workers/message':'Control Room approved recovery'}});
    if(!result.result?.id)throw Error('Cloudflare did not return a deployment receipt');
    review.status='succeeded';review.deployment=result.result.id;
   }catch(e){review.status='uncertain';await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(review),key).run();await audit(env,user.username,'worker-recovery-uncertain',review.worker+' '+review.id);fail('Recovery outcome needs verification in Cloudflare. Do not retry this review.',502);}
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(review),key).run();await audit(env,user.username,'worker-recovered',review.worker+' '+review.version);
   return json({ok:true,status:review.status,deployment:review.deployment});
  });
 }
 fail('Unsupported control operation',405);
}
