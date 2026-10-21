import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {coreProposeWorker,ownerApi,route,seal,toolCall,putChatAttachment} from './worker-test.mjs';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));
db.exec("INSERT INTO users(id,username,role,status,kind) VALUES(1,'owner','owner','active','staff');INSERT INTO agents(id,name,token_hash) VALUES(1,'tester','test');INSERT INTO sites(id,slug,name) VALUES(1,'package','Package');INSERT INTO proposals(id,agent_id,kind,title,site_id,sealed,status) VALUES(1,1,'upload','Full website',1,1,'waiting');");
const data=new Map();const env={VAULT_KEY:'package-test-vault-long-enough',SESSION_SECRET:'package-session-key-long-enough',ADMIN_USER:'owner',ADMIN_PASS:'test-package-password',DB:{prepare(sql){const st=db.prepare(sql);let args=[];return{bind(...a){args=a;return this},async first(){return st.get(...args)||null},async all(){return{results:st.all(...args)}},async run(){const r=st.run(...args);return{meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}},async batch(ss){return Promise.all(ss.map(s=>s.run()))}},FILES:{async put(k,v){const bytes=typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v);const etag=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');data.set(k,{bytes,etag});return{etag}},async get(k){const o=data.get(k);return o?{etag:o.etag,body:o.bytes,async text(){return new TextDecoder().decode(o.bytes)},async arrayBuffer(){return o.bytes.slice().buffer}}:null},async delete(k){data.delete(k)}}};
db.prepare('INSERT INTO cf_connections(id,label,account_id,token_enc) VALUES(1,?,?,?)').run('Account 3','a'.repeat(32),await seal(env,'account-secret-test'));
for(const [path,value]of [['index.html','<!doctype html><h1>Community</h1>'],['app.js','console.log("hello")'],['avatar.png',new Uint8Array([137,80,78,71,13,10,26,10])]]){const k='asset/'+path,o=await env.FILES.put(k,value);db.prepare('INSERT INTO upload_files(proposal_id,path,size,object_key,object_etag,deleted) VALUES(1,?,?,?,?,0)').run(path,data.get(k).bytes.length,k,o.etag);}
const actor={kind:'agent',agentId:1,a:{id:1,can_read:1,can_propose:1}},owner={id:1,username:'owner',role:'owner',kind:'staff'};
async function api(sub,method='GET',body){const url=new URL('https://control.example/api/owner/'+sub);return (await ownerApi(new Request(url,{method,...(body?{body:JSON.stringify(body)}:{})}),env,owner,sub,method,url)).json();}
const original=globalThis.fetch;let writes=[],mode='normal',manifest,uploadCount=0;
const settings={bindings:[{name:'DB',type:'d1',id:'existing-db'},{name:'SESSIONS',type:'kv_namespace',namespace_id:'existing-kv'},{name:'SESSION_SECRET',type:'secret_text'},{name:'MEDIA',type:'r2_bucket',bucket_name:'existing-media'}],compatibility_date:'2025-01-01',compatibility_flags:['nodejs_compat']};
globalThis.fetch=async(url,init)=>{
 const u=new URL(url);assert.equal(u.origin,'https://api.cloudflare.com');assert.equal(init.redirect,'manual');
 const ok=result=>Response.json({success:true,result});
 if(init.method==='GET'&&u.pathname.endsWith('/settings'))return ok(settings);
 if(init.method==='GET'&&u.pathname.endsWith('/workers/scripts'))return ok([{id:'community',modified_on:'stable-revision'}]);
 writes.push({url:u.pathname,init});
 if(u.pathname.endsWith('/assets-upload-session')){manifest=JSON.parse(init.body).manifest;assert.equal(init.headers.authorization,'Bearer account-secret-test');const hashes=[...new Set(Object.values(manifest).map(f=>f.hash))];return ok({jwt:'short-lived-upload-token',buckets:mode==='cached'?[]:mode==='unknown'?[['unknown']]:[hashes.slice(0,1),hashes.slice(1)]});}
 if(u.pathname.endsWith('/assets/upload')){assert.equal(init.headers.authorization,'Bearer short-lived-upload-token');assert.equal(u.search,'?base64=true');uploadCount++;for(const [hash,blob]of init.body){assert.match(hash,/^[0-9a-f]{32}$/);const bytes=Buffer.from(await blob.text(),'base64');assert.ok(bytes.length>0);}return Response.json({success:true,result:uploadCount%2===0?{jwt:'completion-token'}:{}},{status:mode==='incomplete'?200:uploadCount%2===0?201:200});}
 if(init.method==='PUT'){
  const meta=JSON.parse(await init.body.get('metadata').text());assert.equal(meta.assets.jwt,mode==='cached'?'short-lived-upload-token':'completion-token');assert.deepEqual(meta.assets.config.run_worker_first,['/api','/api/*']);assert.deepEqual(meta.compatibility_flags,['nodejs_compat']);assert.ok(!meta.keep_assets);for(const b of settings.bindings)assert.ok(meta.bindings.some(x=>x.name===b.name&&x.type==='inherit'));assert.ok(meta.bindings.some(x=>x.name==='ASSETS'&&x.type==='assets'));return ok({id:'community'});
 }
 throw Error('Unexpected request');
};
try{
 const args={connection:'1',name:'community',code:'export default {fetch(){return new Response("ok")}}',assets_proposal_id:1};
 await assert.rejects(coreProposeWorker(env,{...actor,a:{...actor.a,owner_id:4}},args),e=>e.status===403);
 const p=await coreProposeWorker(env,actor,args);assert.equal(writes.length,0);assert.equal(p.status,'waiting');
 const info=await api('proposals/'+p.proposal_id);assert.equal(info.worker.assets.files.length,3);
 const review=await api('proposals/'+p.proposal_id+'/stage','POST',{});
 const approval={decision:'approve',password:env.ADMIN_PASS,reviewed:true,review_token:review.review_token};
 await assert.rejects(api('proposals/'+p.proposal_id+'/decide','POST',approval),e=>e.status===409);
 const link=await api('proposals/'+p.proposal_id+'/preview-link');const page=await route(new Request('https://control.example'+link.url+'index.html'),env);assert.match(await page.text(),/Community/);assert.match(page.headers.get('content-security-policy'),/connect-src 'none'/);
 await api('proposals/'+p.proposal_id+'/decide','POST',approval);assert.equal(writes.filter(w=>w.init.method==='PUT').length,1);assert.equal(Object.keys(manifest).length,3);assert.equal(db.prepare('SELECT status FROM releases').get().status,'succeeded');
 console.log('PASS full Worker package: no proposal writes to Cloudflare, static preview required, multiple upload buckets, binary assets, isolated upload JWT, inherited D1/KV/R2/secrets, complete assets attached only after receipts');
 const p2=await coreProposeWorker(env,actor,args);await api('proposals/'+p2.proposal_id+'/stage','POST',{});const asset=data.get('asset/index.html');asset.bytes[0]^=1;await assert.rejects(api('proposals/'+p2.proposal_id+'/stage','POST',{}),e=>e.status===409);asset.bytes[0]^=1;
 db.prepare("UPDATE cf_connections SET account_id=? WHERE id=1").run('b'.repeat(32));await assert.rejects(api('proposals/'+p2.proposal_id+'/stage','POST',{}),e=>e.status===409);db.prepare("UPDATE cf_connections SET account_id=? WHERE id=1").run('a'.repeat(32));
 console.log('PASS reviewed package refuses changed stored bytes and account reassignment');
 const {deployWorker}=await import('./worker-test.mjs');const stored=JSON.parse(db.prepare('SELECT new_content_json FROM proposals WHERE id=?').get(p2.proposal_id).new_content_json);
 for(const bad of ['incomplete','unknown']){mode=bad;uploadCount=0;const before=writes.filter(w=>w.init.method==='PUT').length;await assert.rejects(deployWorker(env,1,'community',args.code,[],stored.assets,stored.account_id));assert.equal(writes.filter(w=>w.init.method==='PUT').length,before);}
 mode='cached';await deployWorker(env,1,'community',args.code,[],stored.assets,stored.account_id);
 console.log('PASS incomplete or foreign upload requests never replace Worker; cached assets use completion token without uploads');
 // The same proposal boundary accepts device/API code, current chat attachments,
 // pinned GitHub blobs and read-only Drive files; none publish on import.
 const fullCode='export default {fetch(){return new Response("source")}}'+ ' '.repeat(310000);
 const argsSource={connection:'1',name:'community',assets_proposal_id:1};
 const baselineWrites=writes.length;
 await assert.rejects(toolCall(env,actor,'propose_worker_package',{...argsSource,source:'unsupported'}));
 await assert.rejects(toolCall(env,{...actor,a:{...actor.a,can_read:0}},'propose_worker_package',{...argsSource,code:fullCode}),e=>e.status===403);
 const inline=await toolCall(env,actor,'propose_worker_package',{...argsSource,code:fullCode});assert.equal(inline.status,'waiting');
 const attachment=await putChatAttachment(new Request('https://control.example',{method:'PUT',body:fullCode}),env,owner,'worker.mjs');
 await assert.rejects(toolCall(env,actor,'propose_worker_package',{...argsSource,source:'attachment',attachment_id:attachment.id}),e=>e.status===403);
 const chatActor={...actor,chatUserId:1,chatAttachmentIds:[attachment.id]};
 const chat=await toolCall(env,chatActor,'propose_worker_package',{...argsSource,source:'attachment',attachment_id:attachment.id});assert.equal(chat.status,'waiting');
 db.prepare('INSERT INTO github_sites(id,label,repo,branch,dir,secret_enc) VALUES(1,?,?,?,?,?)').run('Build outputs','owner/repo','main','release',await seal(env,'github-secret-test'));
 const packageFetch=globalThis.fetch;
 const privateKey=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',privateKey.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
 db.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').run('project:drive',JSON.stringify({encrypted:await seal(env,JSON.stringify({folder:'projectfolder01',client_email:'reader@example.iam.gserviceaccount.com',private_key:pem}))}));
 globalThis.fetch=async(url,init)=>{
  const u=new URL(url);
  if(u.origin==='https://api.github.com'){
   assert.equal(init.headers.authorization,'Bearer github-secret-test');assert.equal(init.method,'GET');
   if(u.pathname.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:'c'.repeat(40)}});
   if(u.pathname.endsWith('/git/commits/'+'c'.repeat(40)))return Response.json({tree:{sha:'d'.repeat(40)}});
   if(u.pathname.endsWith('/git/trees/'+'d'.repeat(40)))return Response.json({truncated:false,tree:[{type:'blob',path:'release/worker.mjs',sha:'e'.repeat(40),size:Buffer.byteLength(fullCode)}]});
   if(u.pathname.endsWith('/git/blobs/'+'e'.repeat(40)))return Response.json({sha:'e'.repeat(40),encoding:'base64',content:Buffer.from(fullCode).toString('base64')});
   throw Error('Unexpected GitHub URL');
  }
  if(u.origin==='https://oauth2.googleapis.com')return Response.json({access_token:'drive-token-test'});
  if(u.origin==='https://www.googleapis.com'){
   assert.equal(init.headers.authorization,'Bearer drive-token-test');assert.ok(!init.method||init.method==='GET');
   if(u.searchParams.has('alt'))return new Response(fullCode);
   const id=u.pathname.split('/').pop();
   return Response.json(id==='projectfolder01'?{id,name:'Project',mimeType:'application/vnd.google-apps.folder'}:{id,name:'worker.mjs',mimeType:'text/javascript',parents:id==='outsiderfile01'?['anotherfolder01']:id==='anotherfolder01'?[]:['projectfolder01'],size:Buffer.byteLength(fullCode)});
  }
  return packageFetch(url,init);
 };
 const gh=await toolCall(env,actor,'propose_worker_package',{...argsSource,source:'github',github_site:'1',path:'worker.mjs'});assert.equal(gh.status,'waiting');
 const meta=JSON.parse(db.prepare('SELECT new_content_json FROM proposals WHERE id=?').get(gh.proposal_id).new_content_json);assert.equal(meta.source.commit,'c'.repeat(40));
 await assert.rejects(toolCall(env,actor,'propose_worker_package',{...argsSource,source:'github',github_site:'1',path:'src.ts'}));
 const drive=await toolCall(env,actor,'propose_worker_package',{...argsSource,source:'drive',file_id:'projectfile0001'});assert.equal(drive.status,'waiting');
 await assert.rejects(toolCall(env,actor,'propose_worker_package',{...argsSource,source:'drive',file_id:'outsiderfile01'}),e=>e.status===403);
 assert.equal(writes.length,baselineWrites);
 console.log('PASS package channels: direct code, authorized chat originals, >300 KB pinned GitHub blobs and read-only Drive; foreign chat, source files, missing read permission and outside-folder access denied without publication');
}finally{globalThis.fetch=original;db.close();}
