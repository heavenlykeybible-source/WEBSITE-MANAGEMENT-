// Native GitHub -> private immutable scan -> reviewed destination. No browser service.
async function importSource(env,user,id){return ghById(env,id,scopeOf({kind:'owner',user,ow:null}));}
async function sourceTree(env,g){const head=await ghHead(env,g),result=await gh(env,g,'GET','/git/trees/'+head.tree+'?recursive=1');if(result.truncated)fail('Repository listing is incomplete. Choose a smaller connected project.',409);const pre=g.dir?g.dir+'/':'';return {head,files:(result.tree||[]).filter(f=>f.type==='blob'&&f.path.startsWith(pre)).map(f=>({...f,path:f.path.slice(pre.length)}))};}
function sourceFolder(value){const path=String(value||'').replace(/^\/+|\/+$/g,'');if(path&&(path.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f\\]/.test(path)||path.length>250))fail('Choose a valid project folder');return path;}
async function sourceCandidates(env,user,id){const g=await importSource(env,user,id),tree=await sourceTree(env,g);return {source:ghPublic(g),commit:tree.head.commit,candidates:tree.files.filter(f=>/(^|\/)index\.html?$/.test(f.path)||/(^|\/)[^/]*worker\.(?:m?js)$/.test(f.path)).slice(0,150).map(f=>({path:f.path,kind:/\.html?$/.test(f.path)?'static':'worker',directory:f.path.includes('/')?f.path.slice(0,f.path.lastIndexOf('/')):''} )).concat(sourceBuildCandidates(tree.files)),notice:'Application source requires a reviewed build workflow; built websites and standalone Workers can be imported directly. Source projects needing compilation cannot be deployed as static files.'};}
function sourceBuildCandidates(files){return files.filter(f=>/(^|\/)package\.json$/.test(f.path)&&!f.path.split('/').some(p=>['node_modules','vendor','dist','build','coverage','.next','.nuxt'].includes(p))).slice(0,100).map(f=>({path:f.path,kind:'application',directory:f.path.includes('/')?f.path.slice(0,f.path.lastIndexOf('/')):'',requiresBuild:true}));}
async function queueConnectedApplication(env,user,b){
 const g=await importSource(env,user,b.source),tree=await sourceTree(env,g);
 const directory=sourceFolder(b.directory),prefix=directory?directory+'/':'';
 if(!tree.files.some(f=>f.path===prefix+'package.json'))fail('Application package.json missing',400);
 if(tree.files.some(f=>f.path.startsWith(prefix+'node_modules/')))fail('Dependencies must not be included in application source',400);
 if(!tree.files.some(f=>f.path===prefix+'package-lock.json'))fail('Review build requires npm package-lock.json',409);
 const conn=await connById(env,b.connection),worker=String(b.worker||'');
 if(!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(worker))fail('Choose a valid Cloudflare Worker name',400);
 protectWorker(env,worker);
 if(!/^[a-f0-9]{40}$/.test(tree.head.commit))fail('Pinned commit required',409);
 await cf(env,conn,'GET','/workers/scripts/'+encodeURIComponent(worker)+'/settings');
 const id=crypto.randomUUID();
 const manifest={id,kind:'application',status:'build-required',source:g.id,repo:g.repo,commit:tree.head.commit,root:g.dir||'',directory,connection:conn.id,worker,createdBy:user.id,createdAt:Date.now(),ownerApprovalRequired:true,deploymentAuthorized:false};
 await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('workspace:application:'+id,JSON.stringify(manifest)).run();
 await audit(env,user.username,'application-build-request','Queued '+g.repo+'@'+tree.head.commit+' for '+worker);
 return {id,status:'build-required',repo:g.repo,commit:tree.head.commit,notice:'Application registered for reviewed build. No production deployment or preview is available until a verified build is attached.'};
}
async function scanConnectedSource(env,user,b){
 const g=await importSource(env,user,b.source),tree=await sourceTree(env,g),kind=b.kind==='worker'?'worker':'static',directory=sourceFolder(b.directory),pre=directory?directory+'/':'';
 let selected=tree.files.filter(f=>f.path.startsWith(pre));
 if(kind==='worker'){const entry=String(b.entry||'');selected=tree.files.filter(f=>f.path===entry);if(!/\.m?js$/.test(entry))fail('Choose a JavaScript Worker entry file');}
 else if(selected.some(f=>/(^|\/)(package\.json|wrangler(?:\.[^/]*)?|[^/]+\.(tsx?|jsx|php))$/.test(f.path.slice(pre.length))))fail('This folder contains an application source project, not only built website output. Select its dist/build folder or use a reviewed build/deployment workflow. No files were imported.',409);
 const metadata=/^(?:README(?:\.[^/]*)?|LICENSE(?:\.[^/]*)?|\.gitignore|\.DS_Store)$/i;
 const omitted=selected.filter(f=>metadata.test(f.path.slice(pre.length))).map(f=>f.path);selected=selected.filter(f=>!metadata.test(f.path.slice(pre.length)));
 if(!selected.length||selected.length>40)fail('Choose a built project containing 1–40 files. Larger built websites can use the existing ZIP importer.');
 if(selected.some(f=>f.mode==='120000'))fail('Symlinks are not supported.');
 if(kind==='static'&&!selected.some(f=>f.path.slice(pre.length)==='index.html'))fail('No index.html entry page found. Choose the built website folder.');
 const existing=await env.DB.prepare("SELECT key,value_json FROM settings WHERE key LIKE ?").bind('workspace:scan:'+user.id+':%').all();let active=0;
 for(const r of existing.results){const scan=JSON.parse(r.value_json);if(scan.expires<Date.now()){for(const f of scan.files||[])await env.FILES.delete(f.key);await env.DB.prepare('DELETE FROM settings WHERE key=?').bind(r.key).run();}else active++;}if(active>=10)fail('Ten private scans are already open. Use an existing scan or wait for its expiry.',429);
 const id=crypto.randomUUID(),files=[];let total=0;
 try{for(const row of selected){
  const path=kind==='worker'?row.path.split('/').pop():cleanPath(row.path.slice(pre.length));if(kind==='static'){if(!MIME[ext(path)])fail('Unsupported file in built output: '+path);protectSourcePath(path);}
  if((row.size||0)>MAX_FILE)fail('File exceeds the 2 MB limit: '+path,413);
  const blob=await gh(env,g,'GET','/git/blobs/'+row.sha);if(blob.encoding!=='base64')fail('GitHub returned unsupported blob data',502);
  const bytes=Uint8Array.from(atob(String(blob.content||'').replace(/\s/g,'')),c=>c.charCodeAt(0));if(bytes.byteLength>MAX_FILE)fail('File exceeds the 2 MB limit',413);
  total+=bytes.byteLength;if(total>PACKAGE_LIMIT)fail('Built package exceeds 25 MB',413);
  const gitHeader=new TextEncoder().encode('blob '+bytes.byteLength+'\0'),gitBytes=new Uint8Array(gitHeader.length+bytes.length);gitBytes.set(gitHeader);gitBytes.set(bytes,gitHeader.length);if(hex(await crypto.subtle.digest('SHA-1',gitBytes))!==row.sha)fail('GitHub file integrity could not be verified',409);
  if(kind==='worker'){const code=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!/export\s+(?:default\b|\{[^}]*\bdefault\b)/s.test(code)||/\b(?:from\s*['"]|import\s*(?:\(|['"{*]))/.test(code))fail('Select a bundled, self-contained ES-module Worker. Multi-file projects need a build first.');}
  const key='workspace-scans/'+user.id+'/'+id+'/'+path,hash=hex(await crypto.subtle.digest('SHA-256',bytes));await env.FILES.put(key,bytes);files.push({path,key,size:bytes.byteLength,hash});
 }
 const manifest={id,user:user.id,kind,source:g.id,repo:g.repo,branch:g.branch,root:g.dir||'',directory,commit:tree.head.commit,files,bytes:total,omitted,expires:Date.now()+2*3600000};
 await env.DB.prepare('INSERT INTO settings(key,value_json)VALUES(?,?)').bind('workspace:scan:'+user.id+':'+id,JSON.stringify(manifest)).run();
 return {id,kind,commit:manifest.commit,repo:g.repo,files:files.map(({path,size})=>({path,size})),bytes:total,omitted,checks:['Exact source commit recorded','Every selected file downloaded and Git blob hash verified','Private immutable copy retained for two hours','File paths, type and size limits checked'],notice:'Integrity and compatibility checks only, not malware analysis. Static previews run in an isolated frame; Workers require code review and cannot execute inside the control plane.'};
 }catch(e){for(const f of files)await env.FILES.delete(f.key);throw e;}
}
async function stageConnectedSource(env,user,b){
 if(!/^[a-f0-9-]{36}$/.test(String(b.scan)))fail('Choose an existing scan');
 return withOperationLock(env,'source-import:'+b.scan,async()=>{
 const key='workspace:scan:'+user.id+':'+b.scan,r=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();if(!r)fail('Scan not found',404);const scan=JSON.parse(r.value_json);if(scan.expires<Date.now())fail('Scan expired. Rescan the source.',410);
 if(scan.proposal_id)return {proposal_id:scan.proposal_id,reused:true};
 const g=await importSource(env,user,scan.source);if(g.repo!==scan.repo||g.branch!==scan.branch||(g.dir||'')!==scan.root||(await ghHead(env,g)).commit!==scan.commit)fail('The source changed after scanning. Rescan before importing.',409);
 const actor={kind:'owner',user,ow:null,agentId:await userAgentId(env,user)},objects=[];for(const f of scan.files){const o=await env.FILES.get(f.key);if(!o)fail('Private scan data is missing. Rescan.',409);const bytes=await o.arrayBuffer();if(bytes.byteLength!==f.size||hex(await crypto.subtle.digest('SHA-256',bytes))!==f.hash)fail('Scanned data changed. Rescan.',409);objects.push({...f,bytes});}
 let result;
 if(scan.kind==='worker'){const conn=await connById(env,b.connection),name=String(b.worker||'');protectWorker(env,name);await cf(env,conn,'GET','/workers/scripts/'+encodeURIComponent(name)+'/settings');result=await coreProposeWorker(env,actor,{connection:conn.id,name,code:new TextDecoder().decode(objects[0].bytes),note:'Native source import '+scan.repo+'@'+scan.commit+'. Existing target bindings and secrets must be preserved.'});}
 else{const site=await siteBySlug(env,b.site);await limitWaiting(env,actor);const id=await newUpload(env,actor,site,'Import '+scan.repo,'Exact source commit '+scan.commit);try{for(const f of objects)await putFileUnlocked(new Request('https://upload.local/',{method:'PUT',body:f.bytes}),env,actor,id,f.path);await finalizeUnlocked(env,actor,id);await env.DB.prepare('INSERT INTO settings(key,value_json)VALUES(?,?)').bind('proposal:scan:'+id,JSON.stringify({files:objects.length,bytes:scan.bytes,entry:'index.html',checks:['Immutable GitHub commit '+scan.commit,'Full file integrity rechecked before preview'],notice:'Sandboxed live frontend preview; backend integrations must be tested separately.'})).run();result={proposal_id:id};}catch(e){await env.DB.prepare("UPDATE proposals SET status='rejected' WHERE id=?").bind(id).run();throw e;}}
 scan.proposal_id=result.proposal_id;await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(scan),key).run();await audit(env,user.username,'native-source-import','proposal '+result.proposal_id+' from '+scan.repo+'@'+scan.commit);return {...result,kind:scan.kind,status:'waiting'};
 });
}
async function importWorkspaceRoutes(req,env,user,sub,m){
 if(!sub.startsWith('workspace/'))return null;if(user.role!=='owner'||user.kind==='member')fail('Owner access required',403);const u=new URL(req.url);
 if(sub==='workspace/catalog'&&m==='GET')return json({sources:(await env.DB.prepare('SELECT id,label,repo,branch,dir FROM github_sites WHERE owner_id IS NULL').all()).results,sites:(await env.DB.prepare('SELECT slug,name FROM sites ORDER BY name').all()).results,accounts:(await env.DB.prepare('SELECT id,label FROM cf_connections ORDER BY label').all()).results});
 if(sub==='workspace/candidates'&&m==='GET')return json(await sourceCandidates(env,user,u.searchParams.get('source')));
 if(sub==='workspace/workers'&&m==='GET'){const c=await connById(env,u.searchParams.get('connection')),d=await cf(env,c,'GET','/workers/scripts');return json({workers:(d.result||[]).map(w=>({name:w.id}))});}
 // One authenticated request imports an already-connected GitHub project and stages
 // its immutable snapshot for owner approval. No unreviewed production deployment.
 if(sub==='workspace/import-from-github'&&m==='POST'){
  const b=await body(req);
  if(!b||!b.source||!['static','worker'].includes(b.kind))fail('Select a connected GitHub source and project type',400);
  if(b.kind==='worker'&&(!b.connection||!b.worker))fail('Select a connected Cloudflare account and Worker',400);
  if(b.kind==='static'&&!b.site)fail('Select the destination site',400);
  const scan=await scanConnectedSource(env,user,b);
  const staged=await stageConnectedSource(env,user,{scan:scan.id,connection:b.connection,worker:b.worker,site:b.site});
  return json({ok:true,status:'waiting',proposal_id:staged.proposal_id,source:{repo:scan.repo,commit:scan.commit,files:scan.files.length,bytes:scan.bytes},notice:'Imported and staged for owner approval; production has not been deployed.'});
 }
 if(sub==='workspace/application-build/dispatch'&&m==='POST'){
  const input=await body(req),id=String(input?.id||'');
  if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid build identifier',400);
  return withOperationLock(env,'application-build:'+id,async()=>{
   const key='workspace:application:'+id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
   if(!row)fail('Build request not found',404);
   const item=JSON.parse(row.value_json);
   if(item.createdBy!==user.id)fail('Build request owner mismatch',403);
   if(item.status!=='build-required')fail('Build request is not awaiting dispatch',409);
   if(!/^[a-f0-9]{40}$/.test(item.commit))fail('Invalid pinned source commit',409);
   if(item.repo!=='heavenlykeybible-source/WEBSITE-MANAGEMENT-')fail('Review-only build is not installed for this repository',409);
   const g=await importSource(env,user,item.source);
   if(g.repo!==item.repo)fail('Repository connection has changed',409);
   const workflow=await gh(env,g,'GET','/actions/workflows/review-application-build.yml').catch(()=>null);
   if(!workflow||workflow.state!=='active')fail('Review workflow must first be active on the default GitHub branch',409);
   const tree=await sourceTree(env,g);
   if(tree.head.commit!==item.commit)fail('Source changed since build request',409);
   const directory=[item.root||'',item.directory||''].filter(Boolean).join('/')||'.';
   if(directory!=='.'&&(directory.split('/').some(part=>!part||part==='.'||part==='..'||!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))))fail('Invalid application directory',400);
   const prefix=item.directory?item.directory+'/':'';
   if(!tree.files.some(f=>f.path===prefix+'package.json')||!tree.files.some(f=>f.path===prefix+'package-lock.json'))fail('Pinned application manifest or npm lockfile is missing',409);
   await gh(env,g,'POST','/actions/workflows/review-application-build.yml/dispatches',{ref:'feature/complete-reviewed-import-pipeline',inputs:{request_id:id,source_sha:item.commit,directory}});
   item.status='build-dispatched';item.dispatchedAt=Date.now();item.deploymentAuthorized=false;
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(item),key).run();
   await audit(env,user.username,'application-build-dispatched','Review-only build '+id);
   return json({id,status:item.status,source:item.commit,notice:'Review build dispatched; production remains locked.'});
  });
 }
 if(sub==='workspace/application-build/verify-source'&&m==='POST'){
  const b=await body(req),id=String(b?.id||'');
  if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid build identifier',400);
  const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('workspace:application:'+id).first();
  if(!row)fail('Build request not found',404);
  const item=JSON.parse(row.value_json);
  if(item.createdBy!==user.id)fail('Build request owner mismatch',403);
  if(item.status==='cancelled')fail('Build request cancelled',409);
  const g=await importSource(env,user,item.source);
  if(g.repo!==item.repo)fail('Connected repository changed since build request',409);
  const tree=await sourceTree(env,g);
  const prefix=item.directory?item.directory+'/':'';
  const valid=tree.head.commit===item.commit&&tree.files.some(f=>f.path===prefix+'package.json');
  if(!valid)fail('Pinned application source has changed or package.json is missing',409);
  return json({id,sourceVerified:valid,commit:item.commit,status:item.status,buildVerified:false,deploymentAuthorized:false});
 }
 if(sub==='workspace/application-build/cancel'&&m==='POST'){
  const b=await body(req),id=String(b?.id||'');
  if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid build identifier',400);
  return withOperationLock(env,'application-build:'+id,async()=>{
   const key='workspace:application:'+id;
   const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
   if(!row)fail('Build request not found',404);
   const item=JSON.parse(row.value_json);
   if(item.status!=='build-required')fail('Only unstarted build requests can be cancelled',409);
   if(item.createdBy!==user.id)fail('Build request owner mismatch',403);
   item.status='cancelled';item.deploymentAuthorized=false;item.cancelledAt=Date.now();
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(item),key).run();
   await audit(env,user.username,'application-build-cancel','Cancelled build request '+id);
   return json({id,status:'cancelled',deploymentAuthorized:false});
  });
 }
 if(sub==='workspace/application-build/status'&&m==='GET'){
  const id=u.searchParams.get('id');
  if(!/^[a-f0-9-]{36}$/.test(id||''))fail('Invalid build identifier',400);
  const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('workspace:application:'+id).first();
  if(!row)fail('Build request not found',404);
  const b=JSON.parse(row.value_json);
  if(b.createdBy!==user.id)fail('Build request owner mismatch',403);
  let review=null;
  if(b.status==='build-dispatched'&&b.repo==='heavenlykeybible-source/WEBSITE-MANAGEMENT-'){
   const g=await importSource(env,user,b.source);
   if(g.repo!==b.repo)fail('Connected build repository no longer matches',409);
   const data=await gh(env,g,'GET','/actions/workflows/review-application-build.yml/runs?event=workflow_dispatch&per_page=50').catch(()=>({workflow_runs:[]}));
   const wanted='Review '+b.id;
   const runs=(data.workflow_runs||[]).filter(run=>run.display_title===wanted&&run.event==='workflow_dispatch');
   if(runs.length){
    const run=runs.sort((x,y)=>Date.parse(y.created_at)-Date.parse(x.created_at))[0];
    review={runId:run.id,status:run.status,conclusion:run.conclusion||null,url:run.html_url||null,artifactAvailable:false};
    if(run.status==='completed'&&run.conclusion==='success'){
     const artifacts=await gh(env,g,'GET','/actions/runs/'+encodeURIComponent(run.id)+'/artifacts').catch(()=>({artifacts:[]}));
     review.artifactAvailable=(artifacts.artifacts||[]).some(a=>a.name==='review-build-'+b.id&&!a.expired);
    }
   }
  }
  return json({id:b.id,repo:b.repo,commit:b.commit,worker:b.worker,status:b.status,review,ownerApprovalRequired:true,deploymentAuthorized:false});
 }
 if(sub==='workspace/application-builds'&&m==='GET'){
 const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'workspace:application:%' LIMIT 100").all();
 return json({builds:(rows.results||[]).map(r=>JSON.parse(r.value_json)).filter(b=>b.createdBy===user.id).map(b=>({id:b.id,repo:b.repo,commit:b.commit,status:b.status,worker:b.worker}))});
 }
 if(sub==='workspace/application-build'&&m==='POST')return json(await queueConnectedApplication(env,user,await body(req)));
 if(sub==='workspace/scan'&&m==='POST')return json(await scanConnectedSource(env,user,await body(req)));
 if(sub==='workspace/stage'&&m==='POST')return json(await stageConnectedSource(env,user,await body(req)));
 return null;
}
