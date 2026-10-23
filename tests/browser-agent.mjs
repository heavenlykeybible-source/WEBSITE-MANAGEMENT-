import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {allowedUrl,publicAddress,validateAction} from '../browser-agent/policy.js';
for(const url of ['http://example.com','https://127.0.0.1','https://example.com@localhost','https://other.com','https://example.com:444'])assert.throws(()=>allowedUrl(url,['example.com']));
assert.equal(allowedUrl('https://example.com/page',['example.com']).hostname,'example.com');
for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.1','172.16.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
assert.equal(publicAddress('1.1.1.1'),true);assert.throws(()=>validateAction({type:'evaluate'}));assert.throws(()=>validateAction({type:'press',key:'Enter'}));
const temp=new URL('./browser-test-worker.mjs',import.meta.url);fs.writeFileSync(temp,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {browserTool,browserWorkspaceRoutes};');
try{
const w=await import(temp.href),db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));db.exec("INSERT INTO users(id,username,role,status,kind)VALUES(1,'owner','owner','active','staff'),(2,'other','admin','active','staff');");
const DB={prepare(sql){const q=db.prepare(sql);let v=[];return {bind(...a){v=a;return this},async first(){return q.get(...v)||null},async all(){return {results:q.all(...v)}},async run(){const r=q.run(...v);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}}};
let calls=0;const env={DB,VAULT_KEY:'fixture-browser-vault-key-long',BROWSER_AGENT:{async fetch(url,init){calls++;const payload=JSON.parse(init.body);assert.ok(!JSON.stringify(payload).includes('fixture-password'));return Response.json({session:'private-session',snapshot:'snapshot',url:'https://example.com/',elements:[{id:0,tag:'input',label:'Name'}],screenshot:'owner-only'});}}},actor={agentId:7,chatUserId:1,a:{can_read:true}},user={id:1,username:'owner',role:'owner',kind:'staff'};
const task=(await w.browserTool(env,actor,'browser_request_task',{goal:'Fill the public form',hosts:['example.com']})).task;assert.equal(task.status,'awaiting-owner');assert.equal(calls,0);
await assert.rejects(w.browserTool(env,actor,'browser_action',{id:task.id,type:'click',element:0}),e=>e.status===409);
await assert.rejects(w.browserTool(env,{...actor,agentId:8},'browser_task_status',{id:task.id}),e=>e.status===403);
await assert.rejects(w.browserTool(env,{...actor,chatUserId:2},'browser_task_status',{id:task.id}),e=>e.status===403);
await assert.rejects(w.browserTool(env,{...actor,a:{can_read:true,owner_id:3}},'browser_request_task',{goal:'x',hosts:['example.com']}),e=>e.status===403);
const key='workspace:browser:1:'+task.id;let j=JSON.parse(db.prepare('SELECT value_json FROM settings WHERE key=?').get(key).value_json);j.status='active';j.expires=Date.now()+100000;db.prepare('UPDATE settings SET value_json=? WHERE key=?').run(JSON.stringify(j),key);
const queued=await w.browserTool(env,actor,'browser_action',{id:task.id,type:'fill',element:0,snapshot:'snapshot',value:'Public form value'});assert.equal(queued.task.pending.type,'fill');assert.equal(calls,0);assert.ok(!JSON.stringify(queued).includes('Public form value'));
const req=new Request('https://room/api/owner/browser/decide',{method:'POST',body:JSON.stringify({id:task.id,decision:'approve'})});const approved=await (await w.browserWorkspaceRoutes(req,env,user,'browser/decide','POST')).json();assert.equal(approved.screenshot,'owner-only');assert.equal(calls,1);
const observed=await w.browserTool(env,actor,'browser_action',{id:task.id,type:'observe'});assert.equal(calls,2);assert.ok(!JSON.stringify(observed).includes('owner-only'));assert.ok(!JSON.stringify(observed).includes('private-session'));
const stored=db.prepare('SELECT value_json FROM settings WHERE key=?').get(key).value_json;assert.ok(!stored.includes('private-session'));assert.ok(!stored.includes('owner-only'));
await assert.rejects(w.browserWorkspaceRoutes(new Request('https://room'),env,{...user,role:'admin'},'browser','GET'),e=>e.status===403);
const status=await (await w.browserWorkspaceRoutes(new Request('https://room'),{DB},user,'browser','GET')).json();assert.equal(status.available,false);
db.close();console.log('PASS browser policy, owner/AI isolation, explicit action decisions, private screenshots, sealed sessions, runtime availability and no credential storage');
}finally{fs.unlinkSync(temp);}
