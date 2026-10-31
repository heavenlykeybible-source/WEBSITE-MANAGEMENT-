import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const fixture=new URL('./unified-access-fixture.mjs',import.meta.url);
fs.writeFileSync(fixture,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {sharedAIGrant,requestAIWorkspaceAccess,aiWorkspaceRoutes,ownerApprovalSession,checkOwnerApprovalSession,checkNewWorkerDomain,domainApprovalRoutes,prepareWorkerDomain,seal,mcp,sha256};');
try{
const w=await import(fixture.href),raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));
raw.exec("INSERT INTO users(id,username,role,kind,status) VALUES(1,'owner','owner','staff','active'); INSERT INTO agents(id,name,token_hash,can_read,can_propose,status) VALUES(1,'AI One','one',1,1,'active'),(2,'AI Two','two',1,1,'active'); INSERT INTO cf_connections(id,label,account_id,token_enc) VALUES(5,'Account 4','account-four','unused'),(6,'Account 1','account-one','unused');");
const DB={prepare(sql){let a=[];return {bind(...v){a=v;return this},async first(){return raw.prepare(sql).get(...a)||null},async all(){return {results:raw.prepare(sql).all(...a)}},async run(){const r=raw.prepare(sql).run(...a);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}}},env={DB,ADMIN_PASS:'fixture-owner-password',VAULT_KEY:'fixture-vault-key-long-enough'},owner={id:1,username:'owner',role:'owner',kind:'staff',pass_ver:0};
const post=b=>new Request('https://control.test/api/owner/test',{method:'POST',body:JSON.stringify(b)}),a={id:1,can_read:1,can_propose:1};

raw.prepare('UPDATE agents SET token_hash=? WHERE id=1').run(await w.sha256('native-test-token'));
const hostCall=(method,params={},session)=>w.mcp(new Request('https://control.test/mcp',{method:'POST',headers:{Authorization:'Bearer native-test-token','Content-Type':'application/json',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:42,method,params})}),env);
const initialized=await hostCall('initialize',{capabilities:{elicitation:{url:{}}}}),hostSession=initialized.headers.get('mcp-session-id');
const hostPermission=await(await hostCall('tools/call',{name:'request_workspace_access',arguments:{connections:[5,6],hours:1,reason:'Inspect saved accounts from ChatGPT'}},hostSession)).json();
assert.equal(hostPermission.result.isError,true,'External MCP sessions cannot impersonate an internal owner conversation');
assert.match(hostPermission.result.content[0].text,/authenticated dashboard chat/i);
assert.equal(await w.sharedAIGrant(env,a,5),false,'MCP request cannot grant itself access');
const fallback=await(await hostCall('tools/call',{name:'request_workspace_access',arguments:{connections:[5,6],hours:1,reason:'Inspect saved accounts from ChatGPT'}})).json();
assert.equal(fallback.result.isError,true,'Missing MCP session must also fail closed');
assert.equal(await w.sharedAIGrant(env,a,6),false,'No implicit permission from fallback');
const args={connections:[5,6],hours:24,reason:'Inspect and repair the assigned websites'};
const request=(await w.requestAIWorkspaceAccess(env,{a,agentId:1},args)).permission_request;
assert.equal((await w.requestAIWorkspaceAccess(env,{a,agentId:1},args)).permission_request.id,request.id,'duplicate requests reuse the pending request');
assert.equal(await w.sharedAIGrant(env,a,5),false,'request does not authorize itself');
await assert.rejects(w.aiWorkspaceRoutes(post({id:request.id,decision:'approve',password:'wrong',all_agents:true}),env,owner,'ai/access-requests/decide','POST'),e=>e.status===403);
await w.aiWorkspaceRoutes(post({id:request.id,decision:'approve',password:env.ADMIN_PASS,all_agents:true}),env,owner,'ai/access-requests/decide','POST');
assert.equal(await w.sharedAIGrant(env,a,5),true);assert.equal(await w.sharedAIGrant(env,{...a,id:2},6),true);
assert.equal(await w.sharedAIGrant(env,{...a,owner_id:1},5),false);assert.equal(await w.sharedAIGrant(env,{...a,site_id:1},5),false);assert.equal(await w.sharedAIGrant(env,a,99),false);
await assert.rejects(w.aiWorkspaceRoutes(post({id:request.id,decision:'approve',password:env.ADMIN_PASS}),env,owner,'ai/access-requests/decide','POST'),e=>e.status===409);
const session=await(await w.ownerApprovalSession(post({password:env.ADMIN_PASS}),env,owner,'approval-session','POST')).json();assert.equal(await w.checkOwnerApprovalSession(env,owner,session.proof),true);
await assert.rejects(w.checkOwnerApprovalSession(env,{...owner,id:2},session.proof),e=>e.status===403);
raw.prepare('UPDATE users SET pass_ver=1 WHERE id=1').run();await assert.rejects(w.checkOwnerApprovalSession(env,owner,session.proof),e=>e.status===403);raw.prepare('UPDATE users SET pass_ver=0 WHERE id=1').run();
raw.prepare("UPDATE settings SET value_json=json_set(value_json,'$.expires',0) WHERE key LIKE 'owner:approval-session:%'").run();await assert.rejects(w.checkOwnerApprovalSession(env,owner,session.proof),e=>e.status===403);
// Provider operations are mocked: preparing writes only the request record; approval performs exactly one PUT.
const token=await w.seal(env,'fixture-cloudflare-token');raw.prepare('UPDATE cf_connections SET token_enc=?').run(token);
let writes=0,hasDNS=false;const old=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{const u=new URL(url);if(init.method==='PUT'){writes++;return Response.json({success:true,result:{id:'domain-id',hostname:'new.heavenlykey.org',service:'existing-worker'}});}if(u.pathname==='/client/v4/zones')return Response.json({success:true,result:[{id:'zone-id',name:'heavenlykey.org',status:'active',account:{id:'account-one'}}]});if(u.pathname.includes('/dns_records'))return Response.json({success:true,result:hasDNS?[{id:'existing-record'}]:[]});if(u.pathname.endsWith('/workers/domains'))return Response.json({success:true,result:[]});if(u.pathname.endsWith('/settings'))return Response.json({success:true,result:{bindings:[]}});throw Error('Unexpected provider request '+url);};
try{
await assert.rejects(w.checkNewWorkerDomain(env,6,'evil.example.com','existing-worker'));
hasDNS=true;await assert.rejects(w.checkNewWorkerDomain(env,6,'new.heavenlykey.org','existing-worker'),e=>e.status===409);hasDNS=false;
const domain=await w.prepareWorkerDomain(env,{a},{connection:6,hostname:'new.heavenlykey.org',worker:'existing-worker'});assert.equal(writes,0);
await assert.rejects(w.domainApprovalRoutes(post({id:domain.id,decision:'approve',password:'wrong'}),env,owner,'domains/decide','POST'),e=>e.status===403);assert.equal(writes,0);
const result=await(await w.domainApprovalRoutes(post({id:domain.id,decision:'approve',password:env.ADMIN_PASS}),env,owner,'domains/decide','POST')).json();assert.equal(result.status,'succeeded');assert.equal(writes,1);
await assert.rejects(w.domainApprovalRoutes(post({id:domain.id,decision:'approve',password:env.ADMIN_PASS}),env,owner,'domains/decide','POST'),e=>e.status===409);assert.equal(writes,1);
}finally{globalThis.fetch=old;}
raw.close();console.log('PASS unified multi-account/all-AI access, duplicate/replayed requests, owner verification sessions, expiry/password revocation, subdomain preparation/approval/no-overwrite and one external write');
}finally{fs.unlinkSync(fixture);}
