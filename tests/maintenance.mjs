import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {maintenanceRun,maintenanceRoutes,seal} from './worker-test.mjs';
const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));
const DB={prepare(sql){const q=raw.prepare(sql);let a=[];return {bind(...x){a=x;return this},async first(){return q.get(...a)||null},async all(){return {results:q.all(...a)}},async run(){const r=q.run(...a);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}}};
const env={DB,VAULT_KEY:'a'.repeat(64)};let calls=[];const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({success:true,result:[{id:'my-site',modified_on:'2026-10-18'}]}),{headers:{'content-type':'application/json'}})};
raw.prepare('INSERT INTO cf_connections(label,account_id,token_enc) VALUES(?,?,?)').run('one','b'.repeat(32),await seal(env,'fake-token'));
const grant={agent_id:7,workers:['my-site'],zone:'c'.repeat(32),hosts:['example.org'],expires:Date.now()+3600000};
function set(g=grant){raw.prepare('INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').run('maintenance:grant:1',JSON.stringify(g))}
raw.prepare("INSERT INTO agents(id,name,token_hash) VALUES(7,'test-ai','fake')").run();
const actor={a:{id:7,can_read:1,owner_id:null}};let count=0;async function test(n,f){await f();console.log('PASS '+n);count++}
try{
await test('maintenance denies absent, expired, wrong-agent and member grants before fetch',async()=>{for(const g of [null,{...grant,expires:1},{...grant,agent_id:8}]){if(g)set(g);else raw.prepare("DELETE FROM settings WHERE key='maintenance:grant:1'").run();await assert.rejects(maintenanceRun(env,actor,{connection:1,action:'worker_status',worker:'my-site'}),e=>e.status===403)}set();await assert.rejects(maintenanceRun(env,{a:{...actor.a,owner_id:99}},{connection:1,action:'worker_status',worker:'my-site'}),e=>e.status===403);assert.equal(calls.length,0)});
await test('maintenance rejects ungranted workers, foreign hosts and arbitrary writes',async()=>{for(const args of [{action:'worker_status',worker:'another'},{action:'purge_urls',urls:['https://evil.org/']},{action:'purge_urls',urls:['https://example.org.evil.org/']},{action:'purge_urls',urls:['https://user:pass@example.org/']},{action:'purge_urls',urls:['http://example.org/']},{action:'delete_worker'},{action:'change_dns'}])await assert.rejects(maintenanceRun(env,actor,{connection:1,...args}));assert.equal(calls.length,0)});
await test('granted status checks return metadata only and write durable action records',async()=>{const r=await maintenanceRun(env,actor,{connection:1,action:'worker_status',worker:'my-site'});assert.equal(r.exists,true);assert.equal(r.status,'succeeded');assert.equal(r.token,undefined);assert.equal(calls[0].init.method,'GET');const record=JSON.parse(raw.prepare('SELECT value_json FROM settings WHERE key=?').get('maintenance:run:'+r.action_id).value_json);assert.equal(record.status,'succeeded')});
await test('approval-only mode blocks even granted cache purges without a network write',async()=>{const n=calls.length;await assert.rejects(maintenanceRun(env,actor,{connection:1,action:'purge_urls',urls:['https://example.org/style.css']}),e=>e.status===403);assert.equal(calls.length,n)});
await test('read-only network failures produce a failed persistent record without automatic retry',async()=>{let n=0;globalThis.fetch=async()=>{n++;throw Error('timeout')};await assert.rejects(maintenanceRun(env,actor,{connection:1,action:'worker_status',worker:'my-site'}),e=>e.status===502&&e.message.includes('failed'));assert.equal(n,1);assert.ok(raw.prepare("SELECT value_json FROM settings WHERE key LIKE 'maintenance:run:%'").all().some(x=>JSON.parse(x.value_json).status==='failed'))});
await test('only owners can administer grants, including through direct API calls',async()=>{for(const user of [{role:'admin',kind:'staff'},{role:'owner',kind:'member'}])await assert.rejects(maintenanceRoutes(new Request('https://room/'),env,user,'connections/1/maintenance','GET'),e=>e.status===403)});
await test('revoked grants stop subsequent operations',async()=>{raw.prepare("DELETE FROM settings WHERE key='maintenance:grant:1'").run();await assert.rejects(maintenanceRun(env,actor,{connection:1,action:'worker_status',worker:'my-site'}),e=>e.status===403)});
}finally{globalThis.fetch=oldFetch;raw.close()}
console.log(count+' maintenance checks passed');
