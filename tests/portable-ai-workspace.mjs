import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';
const temp=new URL('./portable-worker-test.mjs',import.meta.url);fs.writeFileSync(temp,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {toolCall,reviewSnapshot,connectRedirect,scanConnectedSource,stageConnectedSource,seal,isPageNavigation,friendlyNavigationResponse};');
try{
const w=await import(temp.href),db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));db.exec("INSERT INTO agents(id,name,token_hash,can_read,can_propose)VALUES(1,'Test AI','fixture',1,1),(2,'Other AI','other',1,1);INSERT INTO sites(id,slug,name,entry)VALUES(1,'demo','Demo','index.html');");
const DB={prepare(sql){const q=db.prepare(sql);let a=[];return {bind(...v){a=v;return this},async first(){return q.get(...a)||null},async all(){return {results:q.all(...a)}},async run(){const r=q.run(...a);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}},async batch(q){return Promise.all(q.map(x=>x.run()))}};
const objects=new Map(),env={DB,VAULT_KEY:'fixture-vault-key-12345',FILES:{async put(k,v){const bytes=new Uint8Array(typeof v==='string'?new TextEncoder().encode(v):v),etag=createHash('sha256').update(bytes).digest('hex');objects.set(k,{bytes,etag});return {etag}},async get(k){const f=objects.get(k);return f?{...f,body:f.bytes,arrayBuffer:async()=>f.bytes.slice().buffer}:null}}};
const a={id:1,can_read:1,can_propose:1},actor={kind:'agent',agentId:1,a};
const call=(name,args)=>w.toolCall(env,actor,name,args);
const draft=await call('begin_site_update',{site:'demo',title:'Full app frontend'});assert.equal(draft.limits.files,1000);assert.equal(draft.limits.bytes,125*1024*1024);
await call('upload_site_file',{proposal_id:draft.proposal_id,path:'index.html',content:'<h1>New website</h1>'});
await call('upload_site_file',{proposal_id:draft.proposal_id,path:'app.js',content:'console.log("app")'});
await call('upload_site_file',{proposal_id:draft.proposal_id,path:'styles.css',content:'h1{color:green}'});
assert.equal((await call('get_site_update',{proposal_id:draft.proposal_id})).files.length,3);assert.equal(db.prepare('SELECT count(*) n FROM site_files').get().n,0);
await assert.rejects(w.toolCall(env,{kind:'agent',agentId:2,a:{...a,id:2}},'upload_site_file',{proposal_id:draft.proposal_id,path:'hijack.html',content:'bad'}));
await assert.rejects(call('upload_site_file',{proposal_id:draft.proposal_id,path:'../secret',content:'bad'}));
await assert.rejects(w.toolCall(env,{...actor,a:{...a,can_propose:0}},'finish_site_update',{proposal_id:draft.proposal_id}),e=>e.status===403);
await call('finish_site_update',{proposal_id:draft.proposal_id});assert.equal(db.prepare('SELECT sealed FROM proposals WHERE id=?').get(draft.proposal_id).sealed,1);assert.equal(db.prepare('SELECT count(*) n FROM site_files').get().n,0);
await assert.rejects(call('upload_site_file',{proposal_id:draft.proposal_id,path:'late.html',content:'late'}));
const proposal=db.prepare('SELECT * FROM proposals WHERE id=?').get(draft.proposal_id);await w.reviewSnapshot(env,proposal);
db.prepare("INSERT INTO site_files(site_id,path,r2_key,size)VALUES(1,'index.html','changed',4)").run();await assert.rejects(w.reviewSnapshot(env,proposal),e=>e.status===409&&/changed after this draft/.test(e.message));
for(const uri of ['https://assistant.example/callback','http://127.0.0.1:9922/callback'])assert.equal(w.connectRedirect(uri),uri);
for(const uri of ['javascript:alert(1)','http://evil.example/callback','https://user:pass@example.com/callback','https://example.com/callback#x'])assert.throws(()=>w.connectRedirect(uri));
const req=new Request('https://site.example/missing',{headers:{accept:'text/html'}});assert.equal(w.isPageNavigation(req),true);const fallback=w.friendlyNavigationResponse(req);assert.equal(fallback.status,404);assert.match(await fallback.text(),/Back to homepage/);assert.equal(fallback.headers.get('cache-control'),'no-store');
for(const path of ['/api/missing','/mcp','/missing.js','/connect/token'])assert.equal(w.isPageNavigation(new Request('https://site.example'+path,{headers:{accept:'text/html'}})),false);
assert.equal((await w.friendlyNavigationResponse(new Request('https://site.example/missing',{method:'HEAD'})).text()),'');
db.close();console.log('PASS portable AI updates: complete multi-file draft, ownership, permissions, sealing, stale edit rejection, safe callbacks and HTML-only friendly errors');
}finally{fs.unlinkSync(temp);}
