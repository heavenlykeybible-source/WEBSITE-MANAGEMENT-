import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {scanGitHubImport,githubImport,toolCall,seal,UI,aiChat} from './worker-test.mjs';
const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));
raw.exec("INSERT INTO agents(id,name,token_hash) VALUES(1,'Importer','import-test'); INSERT INTO sites(id,slug,name) VALUES(1,'demo','Demo')");
const DB={prepare(sql){const q=raw.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return q.get(...args)||null;},async all(){return {results:q.all(...args)};},async run(){const r=q.run(...args);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}};}};},async batch(a){return Promise.all(a.map(x=>x.run()));}};
const objects=new Map(),env={DB,VAULT_KEY:'test-github-import-vault',FILES:{async put(k,v){objects.set(k,new Uint8Array(v));return {etag:'test-etag'};}}},actor={kind:'agent',agentId:1,a:{id:1,can_read:1,can_propose:1}};
const data=new TextEncoder().encode('<h1>Preview</h1>'),blob=Buffer.concat([Buffer.from('blob '+data.length+'\0'),data]),sha=Buffer.from(await crypto.subtle.digest('SHA-1',blob)).toString('hex'),revision='a'.repeat(40);
let tree=[{path:'dist/index.html',type:'blob',mode:'100644',size:data.length,sha}],truncated=false,corrupt=false,calls=[];
const original=globalThis.fetch;
globalThis.fetch=async(url,init)=>{calls.push({url,init});assert.equal(init.redirect,'manual');if(url.includes('/commits/'))return Response.json({sha:revision,commit:{tree:{sha:'b'.repeat(40)}}});if(url.includes('/git/trees/'))return Response.json({tree,truncated});if(url.includes('/git/blobs/'))return new Response(corrupt?'wrong':data);throw Error('Unexpected network request');};
try{
 const args={site:'demo',repo:'https://github.com/example/website',ref:'main',dir:'dist'};
 const scanned=await githubImport(env,actor,{...args,scan_only:true});assert.equal(scanned.scan.revision,revision);assert.equal(objects.size,0);assert.equal(raw.prepare('SELECT count(*) n FROM proposals').get().n,0);
 for(const bad of [{...tree[0],path:'dist/.env'},{...tree[0],mode:'120000'},{...tree[0],path:'dist/app.tsx'},{...tree[0],size:3e6}]){tree=[tree[0],bad];await assert.rejects(scanGitHubImport(env,actor,args));}tree=tree.slice(0,1);
 truncated=true;await assert.rejects(scanGitHubImport(env,actor,args));truncated=false;
 corrupt=true;await assert.rejects(githubImport(env,actor,args));assert.equal(objects.size,0);assert.equal(raw.prepare('SELECT count(*) n FROM proposals').get().n,0);corrupt=false;
 await assert.rejects(toolCall(env,{...actor,a:{...actor.a,site_id:1}},'propose_github_import',args),e=>e.status===403);
 await assert.rejects(toolCall(env,{...actor,a:{...actor.a,can_propose:0}},'propose_github_import',args),e=>e.status===403);
 const encrypted=await seal(env,'private-token-for-test');raw.prepare("INSERT INTO github_sites(id,label,repo,branch,dir,secret_enc) VALUES(1,'Private','example/private','release','dist',?)").run(encrypted);
 await githubImport(env,actor,{site:'demo',source:'1',scan_only:true});assert.equal(calls.at(-1).init.headers.authorization,'Bearer private-token-for-test');
 const result=await toolCall(env,actor,'propose_github_import',{...args,ref:revision});assert.equal(result.status,'waiting');assert.equal(result.imported,1);assert.equal(raw.prepare('SELECT sealed FROM proposals WHERE id=?').get(result.proposal_id).sealed,1);assert.equal(raw.prepare('SELECT count(*) n FROM site_files').get().n,0);assert.equal(objects.size,1);assert.ok(calls.some(c=>c.url.endsWith('/commits/'+revision)));assert.match(UI,/Scan GitHub repository/);
 raw.exec("INSERT INTO users(id,username,role,status,kind) VALUES(1,'owner','owner','active','staff')");
 let turn=0;env.CLOUDFLARE_AI_ENABLED='true';env.AI={async run(model,payload){turn++;assert.match(payload.messages[0].content,/Never replace the requested repository website/);assert.ok(payload.tools.some(t=>(t.name||t.function?.name)==='propose_github_import'));if(turn===1)return {tool_calls:[{name:'propose_github_import',arguments:{...args,scan_only:true}}]};if(turn===2)return {tool_calls:[{name:'propose_github_import',arguments:{...args,ref:revision}}]};return {response:'Imported to Waiting for your preview and approval.'};}};
 const chat=await aiChat(env,{id:1,username:'owner',role:'owner',kind:'staff'},{messages:[{role:'user',content:'Import example/website dist into demo and send to Waiting'}]});assert.equal(turn,3);assert.equal(chat.proposals.length,1);assert.equal(raw.prepare('SELECT count(*) n FROM site_files').get().n,0);assert.match(chat.reply,/Waiting/);assert.match(UI,/Prepare GitHub import request/);
 console.log('PASS direct GitHub import: immutable revision, private connection, scan without writes, integrity, unsafe sources, scope, dashboard AI scan-to-Waiting and no publication');
}finally{globalThis.fetch=original;raw.close();}
