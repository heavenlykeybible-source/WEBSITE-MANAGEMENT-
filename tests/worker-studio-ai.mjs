import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const fixture=new URL('./worker-studio-ai-fixture.mjs',import.meta.url);
fs.writeFileSync(fixture,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {extraAITool,seal,sha256,checkAIToolPermission,verifyPinnedStudioWorker};');
const previousFetch=globalThis.fetch;
try{
 const {extraAITool,seal,sha256,checkAIToolPermission,verifyPinnedStudioWorker}=await import(fixture.href);
 const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));
 raw.exec("INSERT INTO users(id,username,role,kind,status) VALUES(1,'owner','owner','staff','active'); INSERT INTO agents(id,name,token_hash,can_read,can_propose,status) VALUES(1,'Worker Studio AI','test',1,1,'active'); INSERT INTO cf_connections(id,label,account_id,token_enc) VALUES(4,'Account 4','account-4','unused')");
 const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return raw.prepare(sql).get(...values)||null},async all(){return {results:raw.prepare(sql).all(...values)}},async run(){const r=raw.prepare(sql).run(...values);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}}};
 const objects=new Map(),FILES={async put(k,v){objects.set(k,v)},async get(k){return objects.has(k)?{async text(){return objects.get(k)}}:null},async delete(k){objects.delete(k)}};
 const env={DB,FILES,VAULT_KEY:'fixture-vault-key-very-long-123456789',ADMIN_PASS:'fixture-owner-password'};
 raw.prepare('UPDATE cf_connections SET token_enc=? WHERE id=4').run(await seal(env,'fixture-token'));
 let live='export default {fetch(){return new Response("old")}}';
 let reads=0,writes=0;
 globalThis.fetch=async(url,init={})=>{
  if(!String(url).includes('/workers/scripts/worker-one/content'))throw Error('Unexpected provider call '+url);
  if(init.method&&init.method!=='GET')writes++;
  reads++;
  return new Response(live,{status:200,headers:{'content-type':'application/javascript'}});
 };
 const policy={mode:'work',connections:[4],expires_at:Date.now()+3600000};
 await checkAIToolPermission(env,{aiPolicy:policy},'read_worker_source',{connection:4});
 await assert.rejects(checkAIToolPermission(env,{aiPolicy:policy},'read_worker_source',{connection:9}),e=>e.status===404);
 await assert.rejects(checkAIToolPermission(env,{aiPolicy:policy},'list_workers',{connection:9}),e=>e.status===404);
 await assert.rejects(checkAIToolPermission(env,{aiPolicy:{...policy,connections:[]}},'read_worker_source',{connection:4}),e=>e.status===403);
 await assert.rejects(checkAIToolPermission(env,{aiPolicy:{...policy,expires_at:1}},'read_worker_source',{connection:4}),e=>e.status===403);
 const actor={kind:'agent',agentId:1,a:{id:1,can_read:1,can_propose:1}};
 const args={connection:4,worker:'worker-one',base_sha256:await sha256(live),code:'export default {fetch(){return new Response("new")}}'};
 const result=await extraAITool(env,actor,'propose_existing_worker_revision',args);
 assert.equal(result.status,'waiting');assert.equal(result.preview_available,false);assert.equal(writes,0);assert.ok(reads>0);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM proposals').get().n,1);
 assert.equal(objects.get('worker/'+result.proposal_id+'/worker.js'),args.code);
 const metadata=JSON.parse(raw.prepare('SELECT new_content_json FROM proposals WHERE id=?').get(result.proposal_id).new_content_json);
 assert.equal(metadata.base_sha256,args.base_sha256);
 assert.equal((await verifyPinnedStudioWorker(env,metadata)).verified_sha256,args.base_sha256);
 live='export default {fetch(){return new Response("changed after proposal")}}';
 await assert.rejects(verifyPinnedStudioWorker(env,metadata),e=>e.status===409);
 await assert.rejects(verifyPinnedStudioWorker(env,{...metadata,base_sha256:'not-a-digest'}),e=>e.status===409);
 live='export default {fetch(){return new Response("old")}}';

 await assert.rejects(extraAITool(env,actor,'propose_existing_worker_revision',{...args,base_sha256:'b'.repeat(64)}),e=>e.status===409);
 await assert.rejects(extraAITool(env,actor,'propose_existing_worker_revision',{...args,worker:'../bad'}));
 await assert.rejects(extraAITool(env,{...actor,a:{...actor.a,can_propose:0}},'propose_existing_worker_revision',args),e=>e.status===403);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM proposals').get().n,1);
 raw.close();console.log('PASS Worker Studio AI: verify live source digest, save exactly one Waiting revision, deny stale source and unauthorized writes, no Cloudflare publishing');
}finally{globalThis.fetch=previousFetch;fs.unlinkSync(fixture);}
