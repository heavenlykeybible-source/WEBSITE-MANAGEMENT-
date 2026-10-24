import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {seal,ownerApi,coreProposeResource,cloudflareResources,workerBindings,deployWorker,coreProposeWorker} from './worker-test.mjs';
let checks=0;async function test(name,f){await f();checks++;console.log('PASS '+name);}
function setup(){
 const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));
 raw.exec("INSERT INTO users(id,username,role,status,kind) VALUES(1,'owner','owner','active','staff');INSERT INTO agents(id,name,token_hash) VALUES(1,'assistant','fixture');");
 const DB={prepare(sql){const q=raw.prepare(sql);let a=[];return{bind(...x){a=x;return this},async first(){return q.get(...a)||null},async all(){return{results:q.all(...a)}},async run(){const r=q.run(...a);return{meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}}},async batch(st){return Promise.all(st.map(x=>x.run()))}};
 const data=new Map(),FILES={async put(k,v){data.set(k,v)},async get(k){return data.has(k)?{text:async()=>data.get(k)}:null}};
 const env={DB,FILES,VAULT_KEY:'resource-test-vault-long-enough',ADMIN_USER:'owner',ADMIN_PASS:'resource-test-password'};
 const user={id:1,kind:'staff',username:'owner',role:'owner'},actor={kind:'agent',agentId:1,a:{id:1,can_read:1,can_propose:1}};
 const url=new URL('https://room');
 const call=(sub,method='GET',body)=>ownerApi(new Request(url,{method,...(body?{body:JSON.stringify(body)}:{})}),env,user,sub,method,url);
 const stage=async id=>(await call('proposals/'+id+'/stage','POST',{})).json();
 const approve=(id,r)=>call('proposals/'+id+'/decide','POST',{decision:'approve',password:env.ADMIN_PASS,reviewed:true,review_token:r.review_token});
 return {raw,env,user,actor,call,stage,approve};
}
const e=setup(),account='6401a8f41a41f5325ba5bd4d006b4ff5',database='11111111-1111-4111-8111-111111111111';
e.raw.prepare('INSERT INTO cf_connections(id,label,account_id,token_enc) VALUES(1,?,?,?)').run('Account 7 Meeting App',account,await seal(e.env,'resource-test-private-token'));
const realFetch=globalThis.fetch;let writes=[],exists=false,r2Exists=false,oldSettings=null,revision='first';
function ok(result,extra={}){return Response.json({success:true,result,...extra});}
globalThis.fetch=async(input,init)=>{
 const u=new URL(input);assert.equal(u.origin,'https://api.cloudflare.com');assert.ok(u.pathname.startsWith('/client/v4/accounts/'+account+'/'));assert.equal(init.redirect,'manual');
 if(init.method!=='GET')writes.push({url:u.pathname,init});
 if(u.pathname.endsWith('/workers/scripts'))return ok([]);
 if(u.pathname.endsWith('/time_travel/bookmark'))return ok({bookmark:'test-pre-release-bookmark'});
 if(u.pathname.endsWith('/deployments')&&init.method==='GET')return ok({deployments:[{created_on:'2026-10-24',versions:[{version_id:'previous-version',percentage:100}]}]});
 if(u.pathname.endsWith('/settings'))return oldSettings?ok(oldSettings):Response.json({success:false},{status:404});
 if(u.pathname.endsWith('/subdomain'))return ok({subdomain:'account-seven'});
 if(u.pathname.endsWith('/d1/database')&&init.method==='GET')return ok(exists?[{uuid:database,name:'meeting-db'}]:[]);
 if(u.pathname.endsWith('/d1/database')&&init.method==='POST'){assert.equal(init.headers['content-type'],'application/json');assert.deepEqual(JSON.parse(init.body),{name:'meeting-db'});exists=true;return ok({uuid:database,name:'meeting-db'});}
 if(u.pathname.endsWith('/d1/database/'+database))return ok({uuid:database,name:'meeting-db'});
 if(u.pathname.endsWith('/r2/buckets/meeting-files'))return r2Exists?ok({name:'meeting-files'}):Response.json({success:false},{status:404});
 if(u.pathname.endsWith('/r2/buckets')&&init.method==='POST'){assert.deepEqual(JSON.parse(init.body),{name:'meeting-files'});r2Exists=true;return ok({name:'meeting-files'});}
 if(u.pathname.endsWith('/r2/buckets'))return ok({buckets:[{name:'meeting-files',jurisdiction:'default'}]},{result_info:{cursor:'next'}});
 if(init.method==='PUT')return ok({});
 throw Error('Unexpected API call '+u.pathname);
};
try{
 await test('direct meeting installer queues the complete verified package on Account 7 without external writes',async()=>{
  const before=writes.length,r=await(await e.call('connections/1/meeting-install','POST',{})).json();assert.equal(r.status,'waiting');assert.equal(writes.length,before);
  const p=e.raw.prepare('SELECT * FROM proposals WHERE id=?').get(r.proposal_id),m=JSON.parse(p.new_content_json);
  assert.equal(m.connection_id,1);assert.equal(m.name,'heavenly-key-zoom-studio');assert.equal(m.bindings.find(x=>x.name==='TEAMDB').id,'9549fc74-f6a8-4cf8-a066-7cb965c59b91');assert.equal(m.bindings.find(x=>x.name==='FILES').bucket_name,'heavenlymedia');
  const stored=await e.env.FILES.get('worker/'+r.proposal_id+'/worker.js');assert.ok((await stored.text()).includes('const MEETING_ASSETS='));assert.ok((await stored.text()).includes('controlRoomOwnerLogin'));
  e.raw.prepare('UPDATE cf_connections SET account_id=? WHERE id=1').run('b'.repeat(32));await assert.rejects(e.call('connections/1/meeting-install','POST',{}),x=>x.status===403);e.raw.prepare('UPDATE cf_connections SET account_id=? WHERE id=1').run(account);
  const url=new URL('https://room');await assert.rejects(ownerApi(new Request(url,{method:'POST',body:'{}'}),e.env,{...e.user,role:'admin'},'connections/1/meeting-install','POST',url),x=>x.status===403);
 });
 await test('D1 creation queues without any Cloudflare writes, then exact owner approval creates one empty database',async()=>{
  const p=await coreProposeResource(e.env,e.actor,{connection:'1',kind:'d1',name:'meeting-db'});assert.equal(writes.length,0);
  const d=await(await e.call('proposals/'+p.proposal_id)).json();assert.equal(d.resource.account_id,account);
  const review=await e.stage(p.proposal_id);assert.equal(writes.length,0);await e.approve(p.proposal_id,review);
  assert.equal(writes.length,1);assert.equal(e.raw.prepare('SELECT status FROM releases').get().status,'succeeded');
  assert.equal(JSON.parse(e.raw.prepare('SELECT result_json FROM releases').get().result_json).id,database);
 });
 await test('existing databases cannot be replaced or seeded by a creation proposal',async()=>{
  const p=await coreProposeResource(e.env,e.actor,{connection:'1',kind:'d1',name:'meeting-db'});const before=writes.length;
  await assert.rejects(e.stage(p.proposal_id),x=>x.status===409);assert.equal(writes.length,before);
 });
 await test('R2 creation uses the reviewed account and does not enable public access',async()=>{
  const p=await coreProposeResource(e.env,e.actor,{connection:'1',kind:'r2',name:'meeting-files'});const review=await e.stage(p.proposal_id);await e.approve(p.proposal_id,review);
  assert.equal(writes.at(-1).url,'/client/v4/accounts/'+account+'/r2/buckets');
  assert.deepEqual(JSON.parse(writes.at(-1).init.body),{name:'meeting-files'});
 });
 await test('resource appearance after review invalidates approval without a write',async()=>{
  r2Exists=false;const p=await coreProposeResource(e.env,e.actor,{connection:'1',kind:'r2',name:'meeting-files'});const r=await e.stage(p.proposal_id);r2Exists=true;
  const before=writes.length;await assert.rejects(e.approve(p.proposal_id,r),x=>x.status===409);assert.equal(writes.length,before);
 });
 await test('scoped agents and member accounts cannot inspect or propose infrastructure',async()=>{
  for(const a of [{...e.actor,a:{...e.actor.a,site_id:1}},{...e.actor,a:{...e.actor.a,owner_id:1}},{kind:'owner',user:{kind:'member'}}]){
   await assert.rejects(coreProposeResource(e.env,a,{connection:'1',kind:'r2',name:'meeting-files'}),x=>x.status===403);
   await assert.rejects(cloudflareResources(e.env,a,{connection:1,kind:'r2'}),x=>x.status===403);
  }
 });
 await test('resource listing returns pagination and does not claim verified write permission',async()=>{
  const r=await cloudflareResources(e.env,e.actor,{connection:1,kind:'r2'});assert.equal(r.next_cursor,'next');assert.match(r.permission,/Read access verified/);assert.equal(r.account_id,account);
 });
 await test('bad resource types, path injection and unsafe binding types fail locally',async()=>{
  for(const b of [{kind:'delete',name:'meeting-db'},{kind:'d1',name:'../bad'},{kind:'r2',name:'UPPER'}])await assert.rejects(coreProposeResource(e.env,e.actor,{connection:'1',...b}));
  for(const b of [[{type:'secret_text',name:'SECRET',text:'bad'}],[{type:'ai',name:'AI'},{type:'ai',name:'AI'}],[{type:'d1',name:'DB',id:'../bad'}]])assert.throws(()=>workerBindings(b));
 });
 await test('Worker additions preserve existing secrets, assets, flags and database bindings',async()=>{
  oldSettings={compatibility_date:'2026-01-01',compatibility_flags:['nodejs_compat'],bindings:[{type:'secret_text',name:'AUTH_SECRET'},{type:'assets',name:'ASSETS'},{type:'d1',name:'OLDDB',id:database}]};
  await deployWorker(e.env,1,'meeting-app','export default {}',[{type:'d1',name:'TEAMDB',id:database},{type:'r2_bucket',name:'FILES',bucket_name:'meeting-files'},{type:'ai',name:'AI'}]);
  const meta=JSON.parse(await writes.at(-1).init.body.get('metadata').text());assert.equal(meta.keep_assets,true);assert.deepEqual(meta.compatibility_flags,['nodejs_compat']);
  for(const name of ['AUTH_SECRET','ASSETS','OLDDB'])assert.deepEqual(meta.bindings.find(x=>x.name===name),{type:'inherit',name});
  assert.equal(meta.bindings.find(x=>x.name==='TEAMDB').id,database);assert.equal(meta.bindings.find(x=>x.name==='FILES').bucket_name,'meeting-files');
 });
 await test('SQLite Durable Object additions preserve namespaces and declarative exports on updates',async()=>{
  oldSettings={bindings:[{type:'secret_text',name:'AUTH_SECRET'}],exports:{Existing:{type:'durable-object',storage:'sqlite'}},compatibility_date:'2026-01-01'};
  const binding={type:'durable_object_namespace',name:'MEETING_ROOMS',class_name:'MeetingRooms'};
  await deployWorker(e.env,1,'meeting','export class MeetingRooms {}',[binding]);
  let meta=JSON.parse(await writes.at(-1).init.body.get('metadata').text());assert.deepEqual(meta.exports,{Existing:{type:'durable-object',storage:'sqlite'},MeetingRooms:{type:'durable-object',storage:'sqlite'}});assert.deepEqual(meta.bindings.find(b=>b.name==='MEETING_ROOMS'),binding);
  oldSettings.bindings.push({...binding,namespace_id:'existing-namespace'});oldSettings.exports=meta.exports;
  await deployWorker(e.env,1,'meeting','export class MeetingRooms {}',[binding]);meta=JSON.parse(await writes.at(-1).init.body.get('metadata').text());assert.deepEqual(meta.bindings.find(b=>b.name==='MEETING_ROOMS'),{type:'inherit',name:'MEETING_ROOMS'});
  const before=writes.length;oldSettings.exports.MeetingRooms.storage='legacy-kv';await assert.rejects(deployWorker(e.env,1,'meeting','code',[binding]),x=>x.status===409);assert.equal(writes.length,before);
  oldSettings={bindings:[],migration_tag:'legacy'};await assert.rejects(deployWorker(e.env,1,'meeting','code',[binding]),x=>x.status===409);assert.equal(writes.length,before);
 });
 await test('Worker binding replacement is blocked before deployment',async()=>{
  oldSettings={bindings:[{type:'d1',name:'OLDDB',id:database}]};
  const before=writes.length;await assert.rejects(deployWorker(e.env,1,'meeting-app','export default {}',[{type:'r2_bucket',name:'OLDDB',bucket_name:'meeting-files'}]),x=>x.status===409);assert.equal(writes.length,before);
 });
 await test('missing Worker refuses duplicate creation before any write',async()=>{oldSettings=null;const before=writes.length;await assert.rejects(deployWorker(e.env,1,'new-duplicate','export default {}',[]),e=>e.status===409);assert.equal(writes.length,before);});
 await test('generated Worker secrets stay encrypted, survive redeploy and support owner-only meeting launch',async()=>{
  oldSettings={bindings:[]};await deployWorker(e.env,1,'heavenly-key-zoom-studio','export default {}',[{type:'generated_secret',name:'AUTH_SECRET'}]);
  const upload=writes.findLast(x=>x.init.method==='PUT');
  const meta=JSON.parse(await upload.init.body.get('metadata').text()),secret=meta.bindings.find(x=>x.name==='AUTH_SECRET').text;
  assert.match(secret,/^[a-f0-9]{64}$/);
  const record=e.raw.prepare("SELECT value_json FROM settings WHERE key LIKE 'worker-secret:%'").get().value_json;
  assert.ok(!record.includes(secret));assert.ok(!JSON.stringify(e.raw.prepare('SELECT * FROM audit_log').all()).includes(secret));
  oldSettings={bindings:[{type:'secret_text',name:'AUTH_SECRET'}],compatibility_date:'2026-01-01'};
  await deployWorker(e.env,1,'heavenly-key-zoom-studio','export default {}',[{type:'generated_secret',name:'AUTH_SECRET'}]);
  assert.deepEqual(JSON.parse(await writes.at(-1).init.body.get('metadata').text()).bindings,[{type:'inherit',name:'AUTH_SECRET'}]);
  const launch=await(await e.call('connections/1/meeting-launch','POST',{})).json();
  assert.equal(launch.url,'https://heavenly-key-zoom-studio.account-seven.workers.dev/api/control-login');assert.ok(launch.ticket);assert.ok(!JSON.stringify(launch).includes(secret));
  const claims=JSON.parse(Buffer.from(launch.ticket.split('.')[0],'base64url'));assert.equal(claims.e,'owner@studio.local');assert.equal(claims.k,'control-owner');assert.ok(claims.exp<=Date.now()+60000);
  const url=new URL('https://room');await assert.rejects(ownerApi(new Request(url,{method:'POST',body:'{}'}),e.env,{...e.user,role:'admin'},'connections/1/meeting-launch','POST',url),x=>x.status===403);
 });
 await test('resource-specific permission errors preserve encrypted connections and never masquerade as missing resources',async()=>{
  const prev=globalThis.fetch,token=e.raw.prepare('SELECT token_enc FROM cf_connections').get().token_enc;
  globalThis.fetch=async()=>Response.json({success:false},{status:403});
  try{await assert.rejects(cloudflareResources(e.env,e.actor,{connection:1,kind:'d1'}),x=>x.message.includes('D1: Edit'));await assert.rejects(cloudflareResources(e.env,e.actor,{connection:1,kind:'r2'}),x=>x.message.includes('Workers R2 Storage: Edit'));}finally{globalThis.fetch=prev;}
  assert.equal(e.raw.prepare('SELECT token_enc FROM cf_connections').get().token_enc,token);
 });
 await test('dashboard resources route uses the saved account and returns real resource metadata',async()=>{
  const url=new URL('https://room/?kind=r2');
  const r=await ownerApi(new Request(url),e.env,e.user,'connections/1/resources','GET',url);
  assert.equal((await r.json()).resources[0].name,'meeting-files');
 });
 await test('an account mapping change blocks an already staged resource proposal',async()=>{
  exists=false;const p=await coreProposeResource(e.env,e.actor,{connection:'1',kind:'d1',name:'meeting-db'});const review=await e.stage(p.proposal_id);
  e.raw.prepare('UPDATE cf_connections SET account_id=? WHERE id=1').run('b'.repeat(32));const before=writes.length;
  await assert.rejects(e.approve(p.proposal_id,review),x=>x.status===409);assert.equal(writes.length,before);
  e.raw.prepare('UPDATE cf_connections SET account_id=? WHERE id=1').run(account);
 });
 await test('an interrupted creation is recorded as uncertain and approval cannot replay it',async()=>{
  exists=false;const p=await coreProposeResource(e.env,e.actor,{connection:'1',kind:'d1',name:'meeting-db'});const review=await e.stage(p.proposal_id);
  const prev=globalThis.fetch;let attempts=0;
  globalThis.fetch=async(url,init)=>{if(init.method==='POST'){attempts++;exists=true;throw Error('Response lost after creation');}return prev(url,init);};
  try{await assert.rejects(e.approve(p.proposal_id,review),x=>x.status===502);await assert.rejects(e.approve(p.proposal_id,review),x=>x.status===409);assert.equal(attempts,1);assert.equal(e.raw.prepare('SELECT status FROM proposals WHERE id=?').get(p.proposal_id).status,'uncertain');}finally{globalThis.fetch=prev;}
 });
 await test('account removal requires admin role and exact label while leaving remote resources alone',async()=>{
  const url=new URL('https://room');await assert.rejects(ownerApi(new Request(url,{method:'POST',body:JSON.stringify({confirm:'Account 7 Meeting App'})}),e.env,{...e.user,role:'editor'},'connections/1/remove','POST',url),x=>x.status===403);
  await assert.rejects(e.call('connections/1/remove','POST',{}));assert.equal(e.raw.prepare('SELECT count(*) n FROM cf_connections').get().n,1);
  const before=writes.length;await e.call('connections/1/remove','POST',{confirm:'Account 7 Meeting App'});assert.equal(writes.length,before);assert.equal(e.raw.prepare('SELECT count(*) n FROM cf_connections').get().n,0);
 });
}finally{globalThis.fetch=realFetch;e.raw.close();}
console.log(checks+' Cloudflare resource checks passed');
