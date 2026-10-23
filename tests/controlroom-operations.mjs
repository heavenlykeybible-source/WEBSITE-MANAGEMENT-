import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const temp=new URL('./controlroom-operations-worker.mjs',import.meta.url);
fs.writeFileSync(temp,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {controlOperationsRoutes,controlSitePackage,controlWorkerHistory,controlZip,scanWebsiteZip,seal,applyProposal,reviewSnapshot,minRole,UI};');
const originalFetch=globalThis.fetch;
try{
 const {controlOperationsRoutes:routes,controlSitePackage,scanWebsiteZip,seal,applyProposal,minRole,UI}=await import(temp.href);
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));db.exec("INSERT INTO users(id,username,role,status,kind)VALUES(1,'owner','owner','active','staff');INSERT INTO sites(id,slug,name)VALUES(1,'demo','Demo');");
 const DB={prepare(sql){const q=db.prepare(sql);let args=[];return {bind(...v){args=v;return this},async first(){return q.get(...args)||null},async all(){return {results:q.all(...args)}},async run(){const r=q.run(...args);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}},async batch(rows){db.exec('BEGIN');try{const r=[];for(const row of rows)r.push(await row.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const objects=new Map([['old-html',new TextEncoder().encode('<!DOCTYPE html><html><body>Original</body></html>')],['old-css',new TextEncoder().encode('body{color:red}')]]);
 const FILES={async get(key){const bytes=objects.get(key);return bytes?{body:new Blob([bytes]).stream(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),text:async()=>new TextDecoder().decode(bytes)}:null;},async put(key,content){const bytes=new Uint8Array(await new Response(content).arrayBuffer());objects.set(key,bytes);return {etag:'test-etag'};}};
 const env={DB,FILES,ADMIN_PASS:'fixture-password',VAULT_KEY:'fixture-vault-key-long-enough',CONTROL_WORKER_NAME:'website-management'},owner={id:1,username:'owner',role:'owner',kind:'staff'};
 db.prepare('INSERT INTO cf_connections(id,label,account_id,token_enc)VALUES(?,?,?,?)').run(1,'Account 7','a'.repeat(32),await seal(env,'fixture-cloudflare-token'));
 db.prepare('INSERT INTO github_sites(id,label,repo,branch,secret_enc)VALUES(?,?,?,?,?)').run(1,'Code','owner/repo','main',await seal(env,'fixture-github-token'));
 db.exec("INSERT INTO site_files VALUES(1,'index.html','old-html',48),(1,'style.css','old-css',15)");
 let live='deployment-5',deployments=0,backupRef=null;
 const versions=[5,4,3,2,1].map(n=>({id:'deployment-'+n,created_on:'2026-10-'+String(10+n)+'T00:00:00Z',versions:[{version_id:'version-'+n,percentage:100}]}));
 globalThis.fetch=async(input,init={})=>{const u=new URL(input),body=init.body?JSON.parse(init.body):{};
  if(u.host==='api.cloudflare.com'){
   if(u.pathname.endsWith('/deployments')&&init.method==='GET')return Response.json({success:true,result:{deployments:[{...versions[0],id:live},...versions.slice(1)]}});
   if(u.pathname.includes('/versions/'))return Response.json({success:true,result:{id:u.pathname.split('/').at(-1)}});
   if(u.pathname.endsWith('/deployments')&&init.method==='POST'){assert.deepEqual(body.versions,[{version_id:'version-4',percentage:100}]);deployments++;return Response.json({success:true,result:{id:'recovered-deployment'}});}
  }
  if(u.host==='api.github.com'){
   if(u.pathname.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:'commit-live'}});
   if(u.pathname.endsWith('/git/commits/commit-live'))return Response.json({tree:{sha:'tree-live'}});
   if(u.pathname.endsWith('/git/refs')){backupRef=body;return Response.json({object:{sha:body.sha}});}
  }
  throw Error('Unexpected request '+u.href);
 };
 async function api(sub,body,user=owner){const method=body?'POST':'GET',req=new Request('https://control.test/api/owner/'+sub,{method,body:body?JSON.stringify(body):undefined});const response=await routes(req,env,user,sub.split('?')[0],method);return response.headers.get('content-type')?.includes('json')?response.json():response;}
 assert.equal(minRole('operations/github-backup','POST'),4);
 await assert.rejects(api('operations/github-backup',{site:1},{...owner,role:'admin'}),e=>e.status===403);
 const pack=await controlSitePackage(env,'demo'),scan=await scanWebsiteZip(pack.bytes);assert.equal(scan.files.length,2);assert.equal(scan.files.find(f=>f.path==='style.css').bytes.length,15);
 assert.equal((await api('operations/site-backup?site=demo')).headers.get('content-type'),'application/zip');
 const backup=await api('operations/github-backup',{site:1});assert.equal(backup.commit,'commit-live');assert.equal(backupRef.sha,'commit-live');assert.match(backupRef.ref,/^refs\/heads\/controlroom-backup\//);assert.equal(deployments,0);
 assert.equal((await api('operations/worker-history?connection=1&worker=radio')).previous.length,3);
 await assert.rejects(api('operations/worker-recovery',{connection:1,worker:'website-management',version:'version-4'}),e=>e.status===403);
 const review=await api('operations/worker-recovery',{connection:1,worker:'radio',version:'version-4'});
 assert.equal(deployments,0);await assert.rejects(api('operations/worker-recovery/decide',{id:review.review.id,decision:'approve',reviewed:true,password:'wrong'}),e=>e.status===403);
 live='changed';await assert.rejects(api('operations/worker-recovery/decide',{id:review.review.id,decision:'approve',reviewed:true,password:'fixture-password'}),e=>e.status===409);assert.equal(deployments,0);
 live='deployment-5';const decision=await api('operations/worker-recovery/decide',{id:review.review.id,decision:'approve',reviewed:true,password:'fixture-password'});assert.equal(decision.status,'succeeded');assert.equal(deployments,1);
 await assert.rejects(api('operations/worker-recovery/decide',{id:review.review.id,decision:'approve',reviewed:true,password:'fixture-password'}),e=>e.status===409);
 db.exec("INSERT INTO proposals(id,agent_id,site_id,kind,title,status)VALUES(1,1,1,'upload','Update','applying');INSERT INTO upload_files(proposal_id,path,size,object_key,object_etag)VALUES(1,'index.html',3,'new-html','etag')");objects.set('new-html',new TextEncoder().encode('new'));await applyProposal(env,{id:1,kind:'upload',site_id:1});
 const history=await api('operations/site-versions?site=demo');assert.equal(history.versions[0].files.length,2);assert.equal(history.versions[0].files[0].r2_key,'old-html');
 const recovery=await api('operations/site-recovery',{site:'demo',version:'1'});assert.ok(recovery.proposal_id);assert.equal(db.prepare('SELECT r2_key FROM site_files WHERE path=?').get('index.html').r2_key,'new-html','Preparing recovery must not change live files');
 assert.match(UI,/Inline proposal review/);assert.doesNotMatch(UI,/popup\.showModal\(\)/);assert.match(UI,/item\('Home','⌂',controlHome\)/);
 db.close();console.log('PASS Control Room operations: complete ZIP integrity, source backup, owner isolation, three-version history, protected control plane, stale review, wrong password, exact recovery approval, replay denial, atomic file snapshots and staged full-site recovery. Provider calls mocked.');
}finally{globalThis.fetch=originalFetch;fs.unlinkSync(temp);}
