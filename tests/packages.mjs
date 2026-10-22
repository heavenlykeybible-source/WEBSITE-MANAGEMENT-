import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {scanWebsiteZip,zipCRC,UI,minRole} from './worker-test.mjs';
function zip(items, compressed=false){let at=0;const local=[],central=[];for(const [name,text] of items){const n=Buffer.from(name),data=Buffer.from(text),packed=compressed?deflateRawSync(data):data,crc=zipCRC(data),l=Buffer.alloc(30),c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(compressed?8:0,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(n.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(compressed?8:0,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(at,42);local.push(l,n,packed);central.push(c,n);at+=l.length+n.length+packed.length;}const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(items.length,8);end.writeUInt16LE(items.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(at,16);return Buffer.concat([...local,cd,end]);}
for(const compressed of [false,true]){const s=await scanWebsiteZip(zip([['website/index.html','<h1>Welcome</h1>'],['website/css/main.css','body{color:red}']],compressed));assert.equal(s.report.files,2);assert.equal(s.files[0].path,'index.html');assert.equal(new TextDecoder().decode(s.files[0].bytes),'<h1>Welcome</h1>');}
for(const entries of [ [['../index.html','bad']], [['index.html','ok'],['private/.env','password']], [['index.php','<?php']], [['index.html','ok'],['app.tsx','source']], [['a.txt','no entry']], [['index.html','ok'],['INDEX.html','duplicate']] ])await assert.rejects(scanWebsiteZip(zip(entries)));
const broken=zip([['index.html','content']]);broken[40]^=1;await assert.rejects(scanWebsiteZip(broken));
await assert.rejects(scanWebsiteZip(Buffer.alloc(40)));
assert.equal(minRole('drive-package','POST'),4);
assert.match(UI,/Scan ZIP/);assert.match(UI,/Import to Waiting Room/);assert.match(UI,/Open website preview and approval/);
console.log('PASS website ZIP: stored/deflated, root stripping, CRC, unsafe paths, private/server/source rejection, duplicate files and missing entry');

// Exercise the real import, staged review, preview acknowledgement and publication paths.
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {importWebsiteZip,ownerApi,route,putChatAttachment,toolCall,hmac,secret} from './worker-test.mjs';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));
db.exec("INSERT INTO users(id,username,role,status,kind) VALUES(1,'owner','owner','active','staff'); INSERT INTO agents(id,name,token_hash) VALUES(1,'Package tester','package-token'); INSERT INTO sites(id,slug,name) VALUES(1,'package-demo','Package demo')");
const objects=new Map();const env={ADMIN_USER:'owner',ADMIN_PASS:'test-password-only',SESSION_SECRET:'test-signing-key-only-1234567890',VAULT_KEY:'test-vault-key-only-1234567890',DB:{prepare(sql){const st=db.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return st.get(...args)||null;},async all(){return {results:st.all(...args)};},async run(){const r=st.run(...args);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}};}};},async batch(rows){return Promise.all(rows.map(r=>r.run()));}},FILES:{async put(k,value){const b=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);const etag=Buffer.from(await crypto.subtle.digest('SHA-256',b)).toString('hex');objects.set(k,{b,etag});return {etag};},async get(k){const o=objects.get(k);return o?{etag:o.etag,body:o.b,async arrayBuffer(){return o.b.slice().buffer;},async text(){return new TextDecoder().decode(o.b);}}:null;},async delete(k){objects.delete(k);}}};
const owner={id:1,username:'owner',role:'owner',kind:'staff'},actor={kind:'owner',user:owner,agentId:1,ow:null};
async function api(sub,method='GET',data){const url=new URL('https://control.example/api/owner/'+sub),req=new Request(url,{method,...(data?{body:JSON.stringify(data),headers:{'content-type':'application/json'}}:{})});return (await ownerApi(req,env,owner,sub.split('?')[0],method,url)).json();}
const packageBytes=zip([['index.html','<h1>Package preview</h1>'],['about.html','<h1>About ministry</h1>'],['style.css','h1{color:green}']],true);
await importWebsiteZip(env,actor,'package-demo',packageBytes,'phone',true);assert.equal(db.prepare('SELECT count(*) n FROM proposals').get().n,0);assert.equal(objects.size,0);
const imported=await importWebsiteZip(env,actor,'package-demo',packageBytes,'phone');assert.equal(imported.status,'waiting');assert.equal(db.prepare('SELECT count(*) n FROM site_files').get().n,0);assert.equal(db.prepare('SELECT sealed FROM proposals').get().sealed,1);
const proposal=await api('proposals/'+imported.proposal_id);assert.equal(proposal.scan.files,3);
const stage=await api('proposals/'+imported.proposal_id+'/stage','POST',{});
const approval={decision:'approve',password:env.ADMIN_PASS,reviewed:true,review_token:stage.review_token};
await assert.rejects(api('proposals/'+imported.proposal_id+'/decide','POST',approval),e=>e.status===409);
const link=await api('proposals/'+imported.proposal_id+'/preview-link');const preview=await route(new Request('https://control.example'+link.url+'index.html'),env);assert.equal(preview.status,200);assert.match(await preview.text(),/Package preview/);const secondary=await route(new Request('https://control.example'+link.url+'about.html'),env);assert.equal(secondary.status,200);assert.match(await secondary.text(),/About ministry/);
const published=await api('proposals/'+imported.proposal_id+'/decide','POST',approval);assert.equal(published.status,'approved');assert.equal(db.prepare('SELECT count(*) n FROM site_files').get().n,3);
console.log('PASS package lifecycle: scan writes nothing, import stays waiting, saved report, preview required, owner exact-version approval publishes');
// CMS drafts and visual edits use the same owner approval pipeline.
const cmsQuery='?site=package-demo&path=index.html';
const loaded=await api('cms/file'+cmsQuery);assert.match(loaded.content,/Package preview/);
await api('cms/draft'+cmsQuery,'POST',{base_key:loaded.base_key,content:'<h1>Private draft</h1>'});
assert.match((await api('cms/draft'+cmsQuery)).draft.content,/Private draft/);
assert.match((await api('cms/file'+cmsQuery)).content,/Package preview/);
const cmsProposal=await api('cms/propose'+cmsQuery,'POST',{base_key:loaded.base_key,content:'<h1>Edited visually</h1>'});
assert.equal(cmsProposal.status,'waiting');assert.match((await api('cms/file'+cmsQuery)).content,/Package preview/);
const stagedCMS=await api('proposals/'+cmsProposal.proposal_id+'/stage','POST',{});
const cmsLink=await api('proposals/'+cmsProposal.proposal_id+'/preview-link');await route(new Request('https://control.example'+cmsLink.url+'index.html'),env);
await api('proposals/'+cmsProposal.proposal_id+'/decide','POST',{decision:'approve',password:env.ADMIN_PASS,reviewed:true,review_token:stagedCMS.review_token});assert.match((await api('cms/file'+cmsQuery)).content,/Edited visually/);
await assert.rejects(api('cms/propose'+cmsQuery,'POST',{base_key:loaded.base_key,content:'stale edit'}),e=>e.status===409);
const current=await api('cms/file'+cmsQuery);const later=await api('cms/propose'+cmsQuery,'POST',{base_key:current.base_key,content:'next version'});
db.prepare("UPDATE site_files SET r2_key='external-change' WHERE path='index.html'").run();await assert.rejects(api('proposals/'+later.proposal_id+'/stage','POST',{}),e=>e.status===409);
const viewer={id:2,username:'viewer',role:'viewer',kind:'staff'},viewerURL=new URL('https://control.example/api/owner/cms/file'+cmsQuery);await assert.rejects(ownerApi(new Request(viewerURL),env,viewer,'cms/file','GET',viewerURL),e=>e.status===403);
await api('cms/draft?site=package-demo&path=about.html','POST',{base_key:null,content:'<!DOCTYPE html><h1>New page</h1>'});assert.equal((await api('cms/file?site=package-demo&path=about.html')).content,null);
const attached=await putChatAttachment(new Request('https://control.example/upload',{method:'PUT',body:packageBytes}),env,owner,'website.zip');assert.equal(attached.kind,'package');const zipProposal=await toolCall(env,{kind:'agent',agentId:1,a:{id:1,can_read:1,can_propose:1},chatUserId:1,chatAttachmentIds:[attached.id],aiPolicy:{mode:'work',max_tools:20,connections:[],expires_at:0}},'propose_attached_website',{site:'package-demo',attachment_id:attached.id});assert.equal(zipProposal.status,'waiting');assert.equal(db.prepare('SELECT sealed FROM proposals WHERE id=?').get(zipProposal.proposal_id).sealed,1);
console.log('PASS attached ZIP: private upload, integrity check and unchanged website import to Waiting');
console.log('PASS CMS API: private drafts, approved page edits, stale editor rejection, stale proposal rejection, viewer denial and new-page drafts');
// Owner toolbar is response-only, private, and points at the resolved page.
const liveKey=db.prepare("SELECT r2_key FROM site_files WHERE path='style.css'").get();
await env.FILES.put('onsite-test','<!doctype html><html><body><h1>Live page</h1></body></html>');
db.prepare("UPDATE site_files SET r2_key='onsite-test' WHERE path='index.html'").run();
const expiry=Date.now()+60000;
const signature=await hmac(secret(env),'s:1:'+expiry+':0');
const cookie='cr_session=1.'+expiry+'.0.'+signature;
const publicPage=await route(new Request('https://control.example/s/package-demo/'),env);
assert.doesNotMatch(await publicPage.text(),/control-room-owner-toolbar/);
const ownerPage=await route(new Request('https://control.example/s/package-demo/',{headers:{cookie}}),env);
assert.equal(ownerPage.headers.get('cache-control'),'private, no-store');
assert.equal(ownerPage.headers.get('vary'),'Cookie');
const ownerHTML=await ownerPage.text();assert.match(ownerHTML,/Edit this page/);assert.match(ownerHTML,/edit_path=index.html/);
assert.doesNotMatch(await (await env.FILES.get('onsite-test')).text(),/control-room-owner-toolbar/);
const invalidSession=await route(new Request('https://control.example/s/package-demo/',{headers:{cookie:cookie+'bad'}}),env);
assert.doesNotMatch(await invalidSession.text(),/control-room-owner-toolbar/);
assert.match(UI,/cmsOpenRequestedPage/);assert.match(UI,/Save changes/);
console.log('PASS on-site CMS: owner-only toolbar, exact resolved entry, private responses, invalid session rejection, unchanged stored content');
// OAuth discovery, owner consent, PKCE exchange and authenticated MCP tools.
const discovery=await (await route(new Request('https://control.example/.well-known/oauth-authorization-server'),env)).json();
assert.equal(discovery.code_challenge_methods_supported[0],'S256');
const resourceInfo=await (await route(new Request('https://control.example/.well-known/oauth-protected-resource/mcp'),env)).json();assert.equal(resourceInfo.resource,'https://control.example/mcp');
const challenge401=await route(new Request('https://control.example/mcp',{method:'POST',body:'{}'}),env);assert.equal(challenge401.status,401);assert.match(challenge401.headers.get('www-authenticate'),/resource_metadata/);
const callback='https://chatgpt.com/connector_platform_oauth_redirect';
async function register(redirect=callback){return route(new Request('https://control.example/connect/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({redirect_uris:[redirect],token_endpoint_auth_method:'none',client_name:'ChatGPT test'})}),env);}
await assert.rejects(register('https://evil.example/callback'));
const client=await (await register()).json();
const verifier='a'.repeat(64),challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
const authURL=new URL('https://control.example/connect/authorize');authURL.search=new URLSearchParams({client_id:client.client_id,redirect_uri:callback,response_type:'code',code_challenge_method:'S256',code_challenge:challenge,scope:'controlroom:work',resource:'https://control.example/mcp',state:'test-state'});
const authStart=await route(new Request(authURL),env);assert.equal(authStart.status,302);
const requestID=new URL(authStart.headers.get('location'),'https://control.example').searchParams.get('connect_request');
await assert.rejects(route(new Request('https://control.example/connect/consent?id='+requestID),env),e=>e.status===403);
const consent=await route(new Request('https://control.example/connect/consent?id='+requestID,{headers:{cookie}}),env);assert.equal((await consent.json()).scope,'controlroom:work');
async function approve(origin='https://control.example'){return route(new Request('https://control.example/connect/consent',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({id:requestID,decision:'approve',password:env.ADMIN_PASS})}),env);}
await assert.rejects(approve('https://evil.example'),e=>e.status===403);
const callbackURL=new URL((await (await approve()).json()).url);assert.equal(callbackURL.searchParams.get('state'),'test-state');assert.equal(callbackURL.searchParams.get('iss'),'https://control.example');
await assert.rejects(approve());
async function exchange(v=verifier,resource='https://control.example/mcp'){return route(new Request('https://control.example/connect/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client.client_id,redirect_uri:callback,resource,code:callbackURL.searchParams.get('code'),code_verifier:v})}),env);}
assert.equal((await exchange('b'.repeat(64))).status,400);assert.equal((await exchange(verifier,'https://evil.example/mcp')).status,400);
const token=await (await exchange()).json();assert.equal(token.expires_in,3600);assert.ok(token.access_token.startsWith('cr_oauth_'));assert.equal((await exchange()).status,400);
async function mcpCall(){return route(new Request('https://control.example/mcp',{method:'POST',headers:{authorization:'Bearer '+token.access_token,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/list'})}),env);}
const toolList=await (await mcpCall()).json();assert.ok(toolList.result.tools.length>0);assert.ok(!toolList.result.tools.some(t=>/approve|decide/.test(t.name)));
db.prepare("UPDATE agents SET status='revoked' WHERE name='ChatGPT connection'").run();assert.equal((await mcpCall()).status,401);
db.prepare("UPDATE agents SET status='active' WHERE name='ChatGPT connection'").run();const tk=db.prepare("SELECT key,value_json FROM settings WHERE key LIKE 'connect:token:%'").get();const expired=JSON.parse(tk.value_json);expired.expires=1;db.prepare('UPDATE settings SET value_json=? WHERE key=?').run(JSON.stringify(expired),tk.key);assert.equal((await mcpCall()).status,401);
assert.match(UI,/Connect ChatGPT/);assert.match(UI,/Authorize ChatGPT/);
console.log('PASS ChatGPT connection: discovery, callback restriction, owner-only consent, origin protection, PKCE, resource audience, code replay prevention, real tools, revoke and expiry');

db.close();
