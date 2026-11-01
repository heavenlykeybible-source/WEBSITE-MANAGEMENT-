// Native GitHub -> private immutable scan -> reviewed destination. No browser service.
async function importSource(env,user,id){return ghById(env,id,scopeOf({kind:'owner',user,ow:null}));}
async function sourceTree(env,g){const head=await ghHead(env,g),result=await gh(env,g,'GET','/git/trees/'+head.tree+'?recursive=1');if(result.truncated)fail('Repository listing is incomplete. Choose a smaller connected project.',409);const pre=g.dir?g.dir+'/':'';return {head,files:(result.tree||[]).filter(f=>f.type==='blob'&&f.path.startsWith(pre)).map(f=>({...f,path:f.path.slice(pre.length)}))};}
function sourceFolder(value){const path=String(value||'').replace(/^\/+|\/+$/g,'');if(path&&(path.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f\\]/.test(path)||path.length>250))fail('Choose a valid project folder');return path;}
async function sourceCandidates(env,user,id){const g=await importSource(env,user,id),tree=await sourceTree(env,g);return {source:ghPublic(g),commit:tree.head.commit,candidates:tree.files.filter(f=>/(^|\/)index\.html?$/.test(f.path)||/(^|\/)[^/]*worker\.(?:m?js)$/.test(f.path)).slice(0,150).map(f=>({path:f.path,kind:/\.html?$/.test(f.path)?'static':'worker',directory:f.path.includes('/')?f.path.slice(0,f.path.lastIndexOf('/')):''} )).concat(sourceBuildCandidates(tree.files)),notice:'Application source requires a reviewed build workflow; built websites and standalone Workers can be imported directly. Source projects needing compilation cannot be deployed as static files.'};}
function sourceBuildCandidates(files){const paths=new Set(files.filter(f=>f.mode!=='120000'&&(!f.size||f.size<=5*1024*1024)).map(f=>f.path));return files.filter(f=>/(^|\/)package\.json$/.test(f.path)&&!f.path.split('/').some(p=>['node_modules','vendor','dist','build','coverage','.next','.nuxt'].includes(p))&&paths.has(f.path.replace(/package\.json$/,'package-lock.json'))).slice(0,100).map(f=>({path:f.path,kind:'application',directory:f.path.includes('/')?f.path.slice(0,f.path.lastIndexOf('/')):'',requiresBuild:true}));}
async function queueConnectedApplication(env,user,b){
 const g=await importSource(env,user,b.source),tree=await sourceTree(env,g);
 const directory=sourceFolder(b.directory),prefix=directory?directory+'/':'';
 if(!tree.files.some(f=>f.path===prefix+'package.json'))fail('Application package.json missing',400);
 if(tree.files.some(f=>f.path.startsWith(prefix+'node_modules/')))fail('Dependencies must not be included in application source',400);
 const npmLock=tree.files.find(f=>f.path===prefix+'package-lock.json');
 if(!npmLock||npmLock.mode==='120000'||npmLock.size>5*1024*1024)fail('Application requires a regular npm lockfile of at most 5 MB',409);
 await verifyNpmBuildManifest(env,g,tree.files,prefix);
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
async function reviewWorkflowRuns(env,g,id,dispatchedAt){
 const wanted='Review '+id,found=[];
 for(let page=1;page<=5;page++){
  const data=await gh(env,g,'GET','/actions/workflows/review-application-build.yml/runs?event=workflow_dispatch&per_page=100&page='+page);
  const runs=data.workflow_runs||[];
  found.push(...runs.filter(run=>run.display_title===wanted&&run.event==='workflow_dispatch'&&run.head_branch==='feature/complete-reviewed-import-pipeline'&&Date.parse(run.created_at)>=dispatchedAt-120000&&Date.parse(run.created_at)<=dispatchedAt+3600000));
  if(found.length||runs.length<100||runs.every(run=>Date.parse(run.created_at)<dispatchedAt-120000))break;
 }
 return found.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
}
async function verifyNpmBuildManifest(env,g,files,prefix){
 const entry=files.find(f=>f.path===prefix+'package.json');
 if(!entry||entry.mode==='120000'||entry.size>262144)fail('Application package.json is missing or oversized',409);
 const blob=await gh(env,g,'GET','/git/blobs/'+entry.sha);
 if(blob.encoding!=='base64')fail('GitHub package manifest encoding is unsupported',502);
 const raw=String(blob.content||'').replace(/\s/g,'');
 if(raw.length>350000||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))fail('Invalid or oversized GitHub manifest encoding',409);
 const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
 if(bytes.length>262144)fail('Application package manifest exceeds 256 KB',413);
 const header=new TextEncoder().encode('blob '+bytes.length+'\0'),input=new Uint8Array(header.length+bytes.length);
 input.set(header);input.set(bytes,header.length);
 if(hex(await crypto.subtle.digest('SHA-1',input))!==entry.sha)fail('Application package.json integrity check failed',409);
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('Application package.json is not valid UTF-8 JSON',409);}
 if(!manifest||typeof manifest.scripts?.build!=='string'||!manifest.scripts.build.trim())fail('Application must provide an npm build script',409);
 if(manifest.packageManager&&typeof manifest.packageManager==='string'&&!/^npm(?:@|$)/.test(manifest.packageManager))fail('Review build currently supports npm only',409);
 return manifest;
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
function dnsRecordInput(b){const name=String(b?.name||'').trim().toLowerCase(),type=String(b?.type||'').toUpperCase(),content=String(b?.target||'').trim().toLowerCase();if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)||!['A','CNAME'].includes(type))fail('Invalid DNS record name or type',400);if(type==='A'&&(!/^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$/.test(content)||content.split('.').some(v=>Number(v)>255)))fail('Invalid IPv4 destination',400);if(type==='CNAME'&&(!/^[a-z0-9.-]{4,253}$/.test(content)||!content.includes('.')||content.split('.').some(x=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))))fail('Invalid CNAME destination',400);return {type,name:name+'.heavenlykey.org',content,ttl:1,proxied:true};}
async function dnsCloudflare(env,method,path,payload){const zone=String(env.DNS_ZONE_ID||''),token=String(env.DNS_API_TOKEN||'');if(!/^[a-f0-9]{32}$/i.test(zone)||token.length<20)fail('DNS management is not configured with a zone-scoped token',503);const response=await fetch('https://api.cloudflare.com/client/v4/zones/'+zone+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000)});const result=await response.json();if(!response.ok||!result.success)fail('Cloudflare DNS operation failed',502);return result.result;}
async function importWorkspaceRoutes(req,env,user,sub,m){
 if(!sub.startsWith('workspace/'))return null;if(user.role!=='owner'||user.kind==='member')fail('Owner access required',403);const u=new URL(req.url);
 if(sub==='workspace/dns/capabilities'&&m==='GET')return json({zone:'heavenlykey.org',configured:!!(env.DNS_ZONE_ID&&env.DNS_API_TOKEN),actions:['propose-create','approve-create'],requiresOwnerApproval:true});
 if(sub==='workspace/dns/propose-create'&&m==='POST'){const record=dnsRecordInput(await body(req)),id=crypto.randomUUID(),proposal={id,record,status:'pending-owner-approval',createdBy:user.id,createdAt:Date.now(),expiresAt:Date.now()+900000};await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('workspace:dns:'+id,JSON.stringify(proposal)).run();await audit(env,user.username,'dns-create-proposed',record.name);return json({id,status:proposal.status,record,notice:'Review and approve separately before DNS is changed.'});}
 if(sub==='workspace/dns/approve-create'&&m==='POST'){const input=await body(req),id=String(input?.id||'');if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid proposal',400);return withOperationLock(env,'dns-create:'+id,async()=>{const key='workspace:dns:'+id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();if(!row)fail('DNS proposal not found',404);const p=JSON.parse(row.value_json);if(p.createdBy!==user.id||p.status!=='pending-owner-approval'||p.expiresAt<Date.now())fail('Proposal is not available for owner approval',409);if(input?.confirm!==p.record.name)fail('Confirm the exact subdomain name to approve',400);const existing=await dnsCloudflare(env,'GET','/dns_records?name='+encodeURIComponent(p.record.name));if(existing.length)fail('A DNS record already exists for this subdomain',409);p.status='applying';await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(p),key).run();try{const result=await dnsCloudflare(env,'POST','/dns_records',p.record);p.status='created';p.recordId=result.id;p.completedAt=Date.now();await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(p),key).run();await audit(env,user.username,'dns-create-approved',p.record.name);return json({id,status:p.status,record:p.record});}catch(e){p.status='needs-reconciliation';await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(p),key).run();throw e;}});}
 if(sub==='workspace/tinyfish/status'&&m==='GET'){
  return json({configured:!!String(env.BROWSER_ENGINE_KEY||'').trim(),provider:'Heavenly Key Browser Engine',requiresOwnerApproval:true,notice:env.BROWSER_ENGINE_KEY?'Heavenly Key Browser Engine credential configured. Run a task to verify connectivity.':'Set the BROWSER_ENGINE_KEY Cloudflare Worker secret before running Heavenly Key Browser Engine.'});
 }
 if(sub==='workspace/tinyfish/run'&&m==='POST'){
  const b=await body(req),url=String(b?.url||'').trim(),goal=String(b?.goal||'').trim(),key=String(env.BROWSER_ENGINE_KEY||'').trim();
  if(!/^https:\/\/[^/?#]+/.test(String(env.BROWSER_ENGINE_URL||'')))fail('Configure a public HTTPS BROWSER_ENGINE_URL',503);
  if(!key)fail('Heavenly Key Browser Engine API key is not configured in Cloudflare Worker secrets',503);
  let target;try{target=new URL(url);}catch{fail('Enter a valid HTTPS website URL',400);}
  if(target.protocol!=='https:'||target.username||target.password||target.port||target.href.length>2000||!target.hostname.includes('.')||target.hostname.endsWith('.local')||target.hostname.endsWith('.internal')||target.hostname.endsWith('.localhost')||target.hostname.endsWith('.test')||target.hostname.endsWith('.invalid')||target.hostname==='localhost'||target.hostname.startsWith('[')||/^(?:\d{1,3}\.){3}\d{1,3}$/.test(target.hostname)||target.hostname==='metadata.google.internal')fail('Heavenly Key Browser Engine requires a public HTTPS domain, not a private network address',400);
  if(goal.length<8||goal.length>3000)fail('Enter a clear task of 8 to 3000 characters',400);
  const active=await env.DB.prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'workspace:tinyfish:%' AND json_extract(value_json,'$.createdBy')=? AND json_extract(value_json,'$.status') NOT IN ('COMPLETED','FAILED','CANCELLED')").bind(user.id).first();
  if(Number(active?.n||0)>=3)fail('At most three uncompleted Heavenly Key Browser Engine tasks are allowed. Check or cancel existing tasks first.',429);
  const response=await fetch(String(env.BROWSER_ENGINE_URL||'').replace(/\/$/,'')+'/v1/automation/run-async',{method:'POST',headers:{'X-API-Key':key,'Content-Type':'application/json'},body:JSON.stringify({url:target.href,goal}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)fail('Heavenly Key Browser Engine could not start this task (HTTP '+response.status+'). Check API key and wallet.',502);
  const result=await response.json();
  const runId=String(result.run_id||result.runId||result.id||'');
  if(!/^[a-zA-Z0-9_-]{1,160}$/.test(runId))fail('Heavenly Key Browser Engine returned no valid run identifier',502);
  const id=crypto.randomUUID(),item={id,runId,createdBy:user.id,createdAt:Date.now(),url:target.href,goal,status:'submitted'};
  await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('workspace:tinyfish:'+id,JSON.stringify(item)).run();
  await audit(env,user.username,'tinyfish-run','Heavenly Key Browser Engine task '+id+' submitted');
  return json({id,runId,status:'submitted',notice:'Heavenly Key Browser Engine task started. No deployment is authorized.'});
 }
 if(sub==='workspace/tinyfish/cancel'&&m==='POST'){
  const b=await body(req),id=String(b?.id||'');
  if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid Heavenly Key Browser Engine task',400);
  const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('workspace:tinyfish:'+id).first();
  if(!row)fail('Heavenly Key Browser Engine task not found',404);
  const item=JSON.parse(row.value_json);if(item.createdBy!==user.id)fail('Heavenly Key Browser Engine task owner mismatch',403);
  const key=String(env.BROWSER_ENGINE_KEY||'').trim();if(!key)fail('Heavenly Key Browser Engine API key not configured',503);
  if(['COMPLETED','FAILED','CANCELLED'].includes(item.status))return json({id,status:item.status,notice:'This task has already finished.'});
  const response=await fetch(String(env.BROWSER_ENGINE_URL||'').replace(/\/$/,'')+'/v1/runs/'+encodeURIComponent(item.runId)+'/cancel',{method:'POST',headers:{'X-API-Key':key},signal:AbortSignal.timeout(15000)});
  if(!response.ok)fail('Heavenly Key Browser Engine cancellation unavailable (HTTP '+response.status+')',502);
  const result=await response.json(),status=String(result.status||'unknown').toUpperCase();
  if(['COMPLETED','FAILED','CANCELLED'].includes(status)){
   item.status=status;
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(item),'workspace:tinyfish:'+id).run();
  }
  await audit(env,user.username,'tinyfish-cancel','Requested cancellation of Heavenly Key Browser Engine task '+id);
  return json({id,status});
 }
 if(sub==='workspace/tinyfish/runs'&&m==='GET'){
  const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'workspace:tinyfish:%' AND json_extract(value_json,'$.createdBy')=? ORDER BY CAST(json_extract(value_json,'$.createdAt') AS INTEGER) DESC LIMIT 30").bind(user.id).all();
  return json({runs:(rows.results||[]).map(r=>JSON.parse(r.value_json)).map(({id,url,goal,createdAt,status})=>({id,url,goal,createdAt,status}))});
 }
 if(sub==='workspace/tinyfish/result'&&m==='GET'){
  const id=String(u.searchParams.get('id')||'');
  if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid Heavenly Key Browser Engine task',400);
  const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('workspace:tinyfish:'+id).first();
  if(!row)fail('Heavenly Key Browser Engine task not found',404);
  const item=JSON.parse(row.value_json);if(item.createdBy!==user.id)fail('Heavenly Key Browser Engine task owner mismatch',403);
  const key=String(env.BROWSER_ENGINE_KEY||'').trim();if(!key)fail('Heavenly Key Browser Engine API key not configured',503);
  const response=await fetch(String(env.BROWSER_ENGINE_URL||'').replace(/\/$/,'')+'/v1/runs/'+encodeURIComponent(item.runId),{headers:{'X-API-Key':key},signal:AbortSignal.timeout(15000)});
  if(!response.ok)fail('Heavenly Key Browser Engine status unavailable (HTTP '+response.status+')',502);
  const result=await response.json();
  const status=String(result.status||'unknown').toUpperCase();
  if(['COMPLETED','FAILED','CANCELLED'].includes(status)&&item.status!==status){
   item.status=status;
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(item),'workspace:tinyfish:'+id).run();
  }
  return json({id,status,result:result.resultJson??result.result??null,error:result.error||null,createdAt:item.createdAt,url:item.url,goal:item.goal});
 }
 if(sub==='workspace/github/reuse'&&m==='POST'){
  const b=await body(req),sourceId=Number(b?.source),repo=String(b?.repo||'').trim(),label=String(b?.label||'').trim(),branch=String(b?.branch||'main').trim();
  if(!Number.isSafeInteger(sourceId)||sourceId<1)fail('Select an existing authorized GitHub connection',400);
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)||repo.length>200||repo.split('/').some(x=>x==='.'||x==='..'))fail('Enter an owner/repository name',400);
  if(!label||label.length>100||/[\x00-\x1f]/.test(label))fail('Enter a connection label',400);
  if(!/^[a-zA-Z0-9_./-]{1,120}$/.test(branch)||branch.startsWith('/')||branch.endsWith('/')||branch.includes('//')||branch.split('/').some(x=>x==='.'||x==='..'))fail('Enter a valid Git branch',400);
  const g=await importSource(env,user,sourceId);
  const target={...g,repo,branch,dir:''};
  const head=await ghHead(env,target);
  if(!/^[a-f0-9]{40}$/.test(head.commit))fail('GitHub branch could not be verified',409);
  const duplicate=await env.DB.prepare('SELECT id FROM github_sites WHERE owner_id IS NULL AND repo=? AND branch=? AND dir=?').bind(repo,branch,'').first();
  if(duplicate)fail('This GitHub repository and branch are already connected',409);
  const original=await env.DB.prepare('SELECT secret_enc FROM github_sites WHERE id=? AND owner_id IS NULL').bind(sourceId).first();
  if(!original?.secret_enc)fail('Authorized GitHub connection is unavailable',404);
  const existingLabel=await env.DB.prepare('SELECT id FROM github_sites WHERE owner_id IS NULL AND label=?').bind(label).first();
  if(existingLabel)fail('A GitHub connection with this label already exists',409);
  const inserted=await env.DB.prepare('INSERT INTO github_sites(label,repo,branch,dir,secret_enc,owner_id) VALUES(?,?,?,?,?,NULL)').bind(label,repo,branch,'',original.secret_enc).run();
  await audit(env,user.username,'github-repository-added','Added authorized repository '+repo+' from connection '+sourceId);
  return json({id:inserted.meta.last_row_id,label,repo,branch,authenticated:true,tokenReused:true});
 }
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
   if((g.dir||'')!==(item.root||''))fail('Connected repository root has changed',409);
   const workflow=await gh(env,g,'GET','/actions/workflows/review-application-build.yml').catch(()=>null);
   if(!workflow||workflow.state!=='active')fail('Review workflow must first be active on the default GitHub branch',409);
   const tree=await sourceTree(env,g);
   if(tree.head.commit!==item.commit)fail('Source changed since build request',409);
   const directory=[item.root||'',item.directory||''].filter(Boolean).join('/')||'.';
   if(directory!=='.'&&(directory.split('/').some(part=>!part||part==='.'||part==='..'||!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))))fail('Invalid application directory',400);
   const prefix=item.directory?item.directory+'/':'';
   if(tree.files.some(f=>f.path.startsWith(prefix+'node_modules/')))fail('Pinned source contains bundled node_modules',409);
   const npmLock=tree.files.find(f=>f.path===prefix+'package-lock.json');
   if(!npmLock||npmLock.mode==='120000'||npmLock.size>5*1024*1024)fail('Pinned npm lockfile is missing or unsafe',409);
   await verifyNpmBuildManifest(env,g,tree.files,prefix);
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
  if(['cancelled','review-cancellation-requested'].includes(item.status))fail('Build request cancelled or cancellation pending',409);
  const g=await importSource(env,user,item.source);
  if(g.repo!==item.repo)fail('Connected repository changed since build request',409);
  if((g.dir||'')!==(item.root||''))fail('Connected application root changed since build request',409);
  const tree=await sourceTree(env,g);
  const prefix=item.directory?item.directory+'/':'';
  const lock=tree.files.find(f=>f.path===prefix+'package-lock.json');
  const valid=tree.head.commit===item.commit&&tree.files.some(f=>f.path===prefix+'package.json')&&!!lock&&lock.mode!=='120000'&&lock.size<=5*1024*1024&&!tree.files.some(f=>f.path.startsWith(prefix+'node_modules/'));
  if(!valid)fail('Pinned application source has changed or package.json is missing',409);
  await verifyNpmBuildManifest(env,g,tree.files,prefix);
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
   if(item.createdBy!==user.id)fail('Build request owner mismatch',403);
   if(!['build-required','build-dispatched'].includes(item.status))fail('Build request is already closed',409);
   if(item.status==='build-dispatched'){
    const g=await importSource(env,user,item.source);
    if(g.repo!==item.repo||(g.dir||'')!==(item.root||''))fail('Connected build repository changed',409);
    const matching=await reviewWorkflowRuns(env,g,id,item.dispatchedAt);
    if(!matching.length)fail('GitHub run is not yet discoverable; cancellation cannot be confirmed',409);
    const run=matching[0];
    if(run.status!=='completed')await gh(env,g,'POST','/actions/runs/'+encodeURIComponent(run.id)+'/cancel',{});
    item.cancellationRequested=run.status!=='completed';item.cancelledReviewRun=run.id;item.cancelledReviewAt=Date.now();
   }
   item.status=item.cancellationRequested?'review-cancellation-requested':'cancelled';item.deploymentAuthorized=false;item.cancelledAt=Date.now();
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(item),key).run();
   await audit(env,user.username,'application-build-cancel','Cancelled build request '+id);
   return json({id,status:item.status,deploymentAuthorized:false});
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
  if(['build-dispatched','review-cancellation-requested'].includes(b.status)&&b.repo==='heavenlykeybible-source/WEBSITE-MANAGEMENT-'){
   const g=await importSource(env,user,b.source);
   if(g.repo!==b.repo||(g.dir||'')!==(b.root||''))fail('Connected build repository or root no longer matches',409);
   const runs=await reviewWorkflowRuns(env,g,b.id,b.dispatchedAt);
   if(runs.length){
    const run=runs.sort((x,y)=>Date.parse(y.created_at)-Date.parse(x.created_at))[0];
    review={runId:run.id,status:run.status,conclusion:run.conclusion||null,url:run.html_url||null,artifactAvailable:false};
    if(run.status==='completed'&&run.conclusion==='success'){
     const artifacts=await gh(env,g,'GET','/actions/runs/'+encodeURIComponent(run.id)+'/artifacts');
     const artifact=(artifacts.artifacts||[]).find(a=>a.name==='review-build-'+b.id&&!a.expired&&a.workflow_run?.id===run.id);
     review.artifactAvailable=!!artifact;
     if(artifact)review.artifact={id:artifact.id,sizeBytes:artifact.size_in_bytes,expiresAt:artifact.expires_at||null};
    }
   }
  }
  return json({id:b.id,repo:b.repo,commit:b.commit,worker:b.worker,status:(b.status==='review-cancellation-requested'&&review&&review.status==='completed'?(review.conclusion==='cancelled'?'cancelled':'review-closed-after-cancel-request'):b.status),review,ownerApprovalRequired:true,deploymentAuthorized:false});
 }
 if(sub==='workspace/application-builds'&&m==='GET'){
 const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'workspace:application:%' AND json_extract(value_json,'$.createdBy')=? ORDER BY CAST(json_extract(value_json,'$.createdAt') AS INTEGER) DESC LIMIT 100").bind(user.id).all();
 return json({builds:(rows.results||[]).map(r=>JSON.parse(r.value_json)).filter(b=>b.createdBy===user.id).map(b=>({id:b.id,repo:b.repo,commit:b.commit,status:b.status,worker:b.worker}))});
 }
 if(sub==='workspace/application-build'&&m==='POST')return json(await queueConnectedApplication(env,user,await body(req)));
 if(sub==='workspace/scan'&&m==='POST')return json(await scanConnectedSource(env,user,await body(req)));
 if(sub==='workspace/stage'&&m==='POST')return json(await stageConnectedSource(env,user,await body(req)));
 return null;
}
