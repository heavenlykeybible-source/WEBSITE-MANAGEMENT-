import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const temp=new URL('./workspace-test-worker.mjs',import.meta.url);fs.writeFileSync(temp,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {requestAIWorkspaceAccess,aiWorkspaceRoutes,aiPolicy,UI};');
try{
const {requestAIWorkspaceAccess,aiWorkspaceRoutes,aiPolicy,UI}=await import(temp.href);
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));db.exec("INSERT INTO users(id,username,role,status,kind)VALUES(1,'owner','owner','active','staff'),(2,'admin','admin','active','staff');INSERT INTO cf_connections(id,label,account_id,token_enc)VALUES(4,'Account 4','account4','encrypted'),(7,'Account 7','account7','encrypted')");
const DB={prepare(sql){const q=db.prepare(sql);let v=[];return {bind(...a){v=a;return this},async first(){return q.get(...v)||null},async all(){return {results:q.all(...v)}},async run(){const r=q.run(...v);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}}};
const env={DB,ADMIN_PASS:'fixture-password'},user={id:1,username:'owner',role:'owner',kind:'staff'},actor={chatUserId:1,agentId:1,a:{},aiPolicy:{max_tools:12},chatConversationId:crypto.randomUUID()};
async function api(sub,b,u=user){const r=new Request('https://room.example/api/owner/'+sub,{method:b?'POST':'GET',body:b?JSON.stringify(b):undefined});return (await aiWorkspaceRoutes(r,env,u,sub,b?'POST':'GET')).json();}
const before=await aiPolicy(env,user),request=await requestAIWorkspaceAccess(env,actor,{connections:[7],hours:720,reason:'Repair the Radio Worker'});assert.deepEqual(await aiPolicy(env,user),before);assert.equal((await api('ai/access-requests')).requests.length,1);
await assert.rejects(api('ai/access-requests/decide',{id:request.permission_request.id,decision:'approve',password:'wrong'}),e=>e.status===403);assert.deepEqual(await aiPolicy(env,user),before);
await api('ai/access-requests/decide',{id:request.permission_request.id,decision:'decline'});assert.deepEqual(await aiPolicy(env,user),before);await assert.rejects(api('ai/access-requests/decide',{id:request.permission_request.id,decision:'approve',password:'fixture-password'}),e=>e.status===409);
const next=await requestAIWorkspaceAccess(env,actor,{connections:[7],hours:24,reason:'Inspect and repair Radio'});await api('ai/access-requests/decide',{id:next.permission_request.id,decision:'approve',password:'fixture-password'});assert.deepEqual((await aiPolicy(env,user)).connections,[7]);assert.ok((await aiPolicy(env,user)).expires_at>Date.now());
await assert.rejects(api('ai/access-requests',null,{...user,id:2,role:'admin'}),e=>e.status===403);await assert.rejects(requestAIWorkspaceAccess(env,{...actor,ow:2},{connections:[4],reason:'Denied'}),e=>e.status===403);
const chat=crypto.randomUUID();db.prepare('INSERT INTO settings(key,value_json)VALUES(?,?)').run('ai:context:1:cloudflare:'+chat,JSON.stringify({title:'Owner history',messages:[{role:'user',content:'Private owner task'}]}));assert.equal((await api('ai/history')).conversations.length,1);assert.equal((await api('ai/history',null,{...user,id:2,role:'admin'})).conversations.length,0);
assert.ok(UI.includes('Review and approve'));assert.ok(UI.includes('AI requests your permission'));assert.ok(UI.includes('Saved AI conversations'));assert.ok(UI.includes('Choose target account'));assert.ok(UI.includes('Register Face ID / passkey'));assert.ok(UI.includes('permission-grid'));
db.close();console.log('PASS chat access: no self-grant, password verification, exact account, expiry, approve/decline, replay denial, owner-only grants and private per-AI histories');
}finally{fs.unlinkSync(temp);}
