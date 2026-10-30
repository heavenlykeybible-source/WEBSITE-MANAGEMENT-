import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'scripts/bundle-control-room.mjs')]);
const {default:app}=await import(pathToFileURL(path.join(root,'build/meeting-worker.mjs')));
test('complete Control Room bundle serves exact public assets and excludes private sources',async()=>{
 for(const name of ['index.html','studio-theme.css','bg/globe-doves.jpg','icons/icon-192.png']){
  // Icon naming differs between supplied packages; check the actual manifest below.
  if(!fs.existsSync(path.join(root,'site',name)))continue;
  const r=await app.fetch(new Request('https://meeting/'+name),{},{});assert.equal(r.status,200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),fs.readFileSync(path.join(root,'site',name)));
 }
 for(const name of ['_worker.js','_headers','server/setup-accounts.mjs','../schema.sql'])assert.equal((await app.fetch(new Request('https://meeting/'+name),{},{})).status,404);
 const r=await app.fetch(new Request('https://meeting/'),{},{});const etag=r.headers.get('etag');assert.ok(etag);
 assert.equal((await app.fetch(new Request('https://meeting/',{headers:{'if-none-match':etag}}),{},{})).status,200);
 for(const pathname of ['/', '/join.html']) {
  const first=await app.fetch(new Request('https://meeting'+pathname),{},{});
  const conditional=await app.fetch(new Request('https://meeting'+pathname,{headers:{'if-none-match':first.headers.get('etag')}}),{},{});
  assert.equal(conditional.status,200,'private meeting pages must ignore conditional cache requests');
  assert.equal(conditional.headers.get('cache-control'),'no-store');
 }

 assert.equal((await app.fetch(new Request('https://meeting/',{method:'HEAD'}),{},{})).status,200);
 assert.equal((await app.fetch(new Request('https://meeting/',{method:'POST'}),{},{})).status,405);
 for (const pathname of ['/', '/index.html', '/join.html']) {
   const response=await app.fetch(new Request('https://meeting'+pathname),{},{});
   assert.equal(response.headers.get('cache-control'),'no-store');
   assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   assert.equal(response.headers.get('x-frame-options'),'DENY');
   assert.equal(response.headers.get('referrer-policy'),'no-referrer');
   assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
 }
 const staticAsset=await app.fetch(new Request('https://meeting/studio-theme.css'),{},{});
 assert.equal(staticAsset.headers.get('x-content-type-options'),'nosniff');

});
function database(){
 const raw=new DatabaseSync(':memory:');let migrations=0;
 const DB={async exec(sql){migrations++;raw.exec(sql);return{};},prepare(sql){const q=raw.prepare(sql);let a=[];return{bind(...x){a=x;return this},async first(){return q.get(...a)||null},async all(){return{results:q.all(...a)}},async run(){const r=q.run(...a);return{meta:{changes:r.changes}}}}}};
 DB.batch=async(st)=>{raw.exec('BEGIN');try{const results=[];for(const q of st)results.push(await q.run());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e}};
 return{raw,DB,get migrations(){return migrations}};
}
const secret='fixture-control-room-shared-secret-only';
function ticket(n='11111111-1111-4111-8111-111111111111',extra={}){const p=Buffer.from(JSON.stringify({k:'control-owner',e:'owner@studio.local',n,exp:Date.now()+60000,...extra})).toString('base64url');return p+'.'+createHmac('sha256',secret).update(p).digest('hex');}
const login=(env,t)=>app.fetch(new Request('https://meeting/api/control-login',{method:'POST',body:new URLSearchParams({ticket:t})}),env,{});
test('first health request initializes additive schema; repeated requests retain data',async()=>{
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret};
 assert.equal((await app.fetch(new Request('https://meeting/api/health'),env,{})).status,200);
 d.raw.exec("INSERT INTO programs(id,owner,title,created) VALUES('existing','existing','Keep me',1)");
 const r=await app.fetch(new Request('https://meeting/api/health'),env,{});assert.equal((await r.json()).accountsConfigured,true);assert.equal(d.migrations,1);assert.equal(d.raw.prepare('SELECT title FROM programs').get().title,'Keep me');d.raw.close();
});
test('owner launch requires a signed single-use ticket and never overrides another identity',async()=>{
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret};
 assert.equal((await login(env,'bad')).status,403);
 assert.equal((await login(env,ticket(undefined,{k:'wrong'}))).status,403);
 assert.equal((await login(env,ticket(undefined,{exp:Date.now()-1}))).status,403);
 const t=ticket(),r=await login(env,t);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/localStorage.setItem/);
 assert.equal(d.raw.prepare('SELECT role FROM users').get().role,'owner');assert.equal((await login(env,t)).status,403);
 d.raw.exec("UPDATE users SET role='user'");assert.equal((await login(env,ticket('22222222-2222-4222-8222-222222222222'))).status,409);assert.equal(d.raw.prepare('SELECT role FROM users').get().role,'user');d.raw.close();
});
test('missing database yields a clear setup failure while public template still loads',async()=>{
 assert.equal((await app.fetch(new Request('https://meeting/'),{},{})).status,200);
 assert.equal((await app.fetch(new Request('https://meeting/api/health'),{},{})).status,503);
});

const {MeetingRooms}=await import(pathToFileURL(path.join(root,'build/meeting-worker.mjs')));
function socket(data){return {readyState:1,messages:[],serializeAttachment(d){assert.ok(Buffer.byteLength(JSON.stringify(d))<=2048,'hibernation attachment fits platform limit');this.d=structuredClone(d)},deserializeAttachment(){return structuredClone(this.d)},send(m){this.messages.push(JSON.parse(m))},close(){this.readyState=3},d:structuredClone(data)};}
function meeting(){const all=[],state={getWebSockets(){return all},storage:{async setAlarm(){}}};return {all,state,room:new MeetingRooms(state,{AUTH_SECRET:secret}),add(data={}){const w=socket({role:'',room:'11111111-1111-4111-8111-111111111111',until:Date.now()+15000,...data});all.push(w);return w}};}
test('meeting room rejects excess peers before allocating WebSockets',async()=>{
 const s=meeting();for(let i=0;i<8;i++)s.add();
 const req=new Request('https://meeting/meeting/11111111-1111-4111-8111-111111111111/room',{headers:{upgrade:'websocket',origin:'https://meeting'}});
 const response=await s.room.fetch(req);
 assert.equal(response.status,429);
});
function roomToken(extra={}){const p=Buffer.from(JSON.stringify({k:'meeting',u:'owner@test.local',r:'11111111-1111-4111-8111-111111111111',exp:Date.now()+60000,pe:Date.now()+86400000,...extra})).toString('base64url');return p+'.'+createHmac('sha256',secret).update(p).digest('hex');}
const message=(room,w,m)=>room.webSocketMessage(w,JSON.stringify(m));
async function openRoom(){const s=meeting(),host=s.add();await message(s.room,host,{t:'host',token:roomToken()});return {...s,host,key:host.messages.at(-1).key};}
test('meeting host requires purpose, matching room and unexpired signed access',async()=>{
 for(const token of ['bad',roomToken({k:'control-owner'}),roomToken({r:'another'}),roomToken({exp:Date.now()-1}),roomToken({pe:Date.now()-1})]){const s=meeting(),w=s.add();await message(s.room,w,{t:'host',token});assert.equal(w.readyState,3);}
 const s=await openRoom();assert.equal(s.host.messages[0].t,'created');const other=s.add();await message(s.room,other,{t:'host',token:roomToken()});assert.equal(other.readyState,3);
});
test('waiting guests cannot chat or signal until host admission; hibernation keeps room controls',async()=>{
 const s=await openRoom(),guest=s.add();await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,name:'Visitor',pass:'test-pass'});
 assert.equal(s.host.messages.at(-2)?.t==='waiting'||s.host.messages.some(m=>m.t==='waiting'),true);
 await message(s.room,guest,{t:'chat',text:'blocked'});await message(s.room,guest,{t:'sig',data:{offer:'blocked'}});assert.ok(!s.host.messages.some(m=>m.text==='blocked'||m.data?.offer==='blocked'));
 const restored=new MeetingRooms(s.state,{AUTH_SECRET:secret});await message(restored,s.host,{t:'admit',gid:guest.d.id});assert.equal(guest.d.stage,true);
 await message(restored,guest,{t:'sig',data:{sdp:{type:'offer',sdp:'v=0'}}});assert.equal(s.host.messages.at(-1).data.sdp.type,'offer');
 await message(restored,s.host,{t:'lock',on:true});const denied=s.add();await message(restored,denied,{t:'join',room:s.host.d.room,key:s.key});assert.equal(denied.readyState,3);
 await message(restored,s.host,{t:'sig',to:'wrong-room',data:{secret:'private'}});assert.ok(!guest.messages.some(m=>m.data?.secret));
});
test('audience moderation, promotion, expiry and host disconnect work across hibernation',async()=>{
 const s=await openRoom(),aud=s.add();await message(s.room,aud,{t:'join',room:s.host.d.room,key:s.key,aud:true,name:'Viewer'});assert.equal(aud.d.ok,true);assert.equal(aud.d.stage,false);
 await message(s.room,s.host,{t:'audchat',on:false});await message(s.room,aud,{t:'chat',text:'not allowed'});assert.equal(aud.messages.at(-1).t,'note');
 await message(s.room,s.host,{t:'promote',gid:aud.d.id});await message(s.room,aud,{t:'ready',ao:true});assert.equal(aud.d.stage,true);
 await message(s.room,s.host,{t:'demote',gid:aud.d.id});assert.equal(aud.d.aud,true);assert.equal(aud.d.stage,false);
 const late=s.add();await message(s.room,late,{t:'join',room:s.host.d.room,key:'wrong',aud:true});assert.equal(late.readyState,3);
 s.host.d.until=Date.now()-1;await new MeetingRooms(s.state,{AUTH_SECRET:secret}).alarm();assert.equal(aud.readyState,3);assert.equal(s.host.readyState,3);
 const another=await openRoom(),g=another.add();await message(another.room,g,{t:'join',room:another.host.d.room,key:another.key,aud:true});another.host.readyState=3;another.room.webSocketClose(another.host);assert.equal(g.readyState,3);
});
test('meeting transport rejects wrong origins and non-WebSocket requests; unauthenticated sockets expire',async()=>{
 const s=meeting();assert.equal((await s.room.fetch(new Request('https://meeting/meeting/r/room'))).status,426);
 assert.equal((await s.room.fetch(new Request('https://meeting/meeting/r/room',{headers:{upgrade:'websocket',origin:'https://elsewhere'}}))).status,403);
 const w=s.add({until:Date.now()-1});await s.room.alarm();assert.equal(w.readyState,3);
});
test('native meeting token uses current account permissions and does not claim RTMP is configured',async()=>{
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret,MEETING_ROOMS:{}};
 const loginResponse=await login(env,ticket());const html=await loginResponse.text(),token=JSON.parse(html.match(/localStorage.setItem\("ls_tok",("[^"]+")\)/)[1]);
 const r=await app.fetch(new Request('https://meeting/api/meeting-token',{headers:{authorization:'Bearer '+token}}),env,{}),j=await r.json();assert.equal(r.status,200);assert.match(j.url,/^wss:\/\/meeting\/meeting\/[a-f0-9-]{36}$/);
 const health=await (await app.fetch(new Request('https://meeting/api/health'),env,{})).json();assert.equal(health.meetingConfigured,true);assert.equal(health.relayConfigured,false);
 assert.equal((await app.fetch(new Request('https://meeting/api/meeting-token'),env,{})).status,401);d.raw.close();
});

test('fresh Control Room owner launch permits one private password setup and invalidates old sessions',async()=>{
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret};
 const html=await (await login(env,ticket())).text();
 const extract=key=>JSON.parse(html.match(new RegExp('localStorage\\.setItem\\("'+key+'",("[^"]+")\\)'))[1]);
 const auth=extract('ls_tok'),setup=extract('ls_owner_setup'),password='a'.repeat(64);
 const save=(token,body,origin='https://meeting')=>app.fetch(new Request('https://meeting/api/control-password',{method:'POST',headers:{authorization:'Bearer '+token,origin,'content-type':'application/json'},body:JSON.stringify(body)}),env,{});
 assert.equal((await save(auth,{ticket:'wrong',password})).status,403);
 assert.equal((await save(auth,{ticket:setup,password},'https://elsewhere')).status,403);
 const r=await save(auth,{ticket:setup,password});assert.equal(r.status,200);const fresh=(await r.json()).token;
 assert.equal(d.raw.prepare('SELECT tv FROM users').get().tv,1);
 assert.equal((await save(fresh,{ticket:setup,password})).status,403);
 assert.equal((await app.fetch(new Request('https://meeting/api/me',{headers:{authorization:'Bearer '+auth}}),env,{})).status,401);
 const signIn=await app.fetch(new Request('https://meeting/api/login',{method:'POST',headers:{origin:'https://meeting','content-type':'application/json'},body:JSON.stringify({email:'owner',password})}),env,{});assert.equal(signIn.status,200);d.raw.close();
});


test('Control Room bundle refuses symbolic links to files outside public assets',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'meeting-bundle-'));
 try {
  fs.mkdirSync(path.join(tmp,'site'));
  fs.mkdirSync(path.join(tmp,'scripts'));
  fs.mkdirSync(path.join(tmp,'server'));
  fs.mkdirSync(path.join(tmp,'migrations'));
  fs.writeFileSync(path.join(tmp,'site','_worker.js'),'export default { fetch() {} };');
  fs.writeFileSync(path.join(tmp,'server','control-room-runtime.mjs'),'');
  fs.writeFileSync(path.join(tmp,'server','meeting-rooms.mjs'),'');
  fs.writeFileSync(path.join(tmp,'migrations','0001_zoom_studio.sql'),'CREATE TABLE sample(id TEXT);');
  fs.writeFileSync(path.join(tmp,'secret.txt'),'DO NOT PACKAGE');
  fs.symlinkSync(path.join(tmp,'secret.txt'),path.join(tmp,'site','secret.js'));
  fs.copyFileSync(path.join(root,'scripts','bundle-control-room.mjs'),path.join(tmp,'scripts','bundle-control-room.mjs'));
  const result=spawnBundle(path.join(tmp,'scripts','bundle-control-room.mjs'));
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unsafe public asset entry rejected: secret.js/);
  assert.equal(fs.existsSync(path.join(tmp,'build','meeting-worker.mjs')),false);
  fs.unlinkSync(path.join(tmp,'site','secret.js'));
  fs.writeFileSync(path.join(tmp,'site','oversize.png'),Buffer.alloc(10*1024*1024+1));
  const oversized=spawnBundle(path.join(tmp,'scripts','bundle-control-room.mjs'));
  assert.notEqual(oversized.status,0);
  assert.match(oversized.stderr,/Public asset exceeds 10 MiB safety limit/);
  assert.equal(fs.existsSync(path.join(tmp,'build','meeting-worker.mjs')),false);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
function spawnBundle(script){return spawnSync(process.execPath,[script],{encoding:'utf8'});}

test('WebSocket signalling refuses HTTP transport and untrusted origins',async()=>{
 const s=meeting();
 for(const [url,origin] of [
  ['http://meeting/meeting/11111111-1111-4111-8111-111111111111/room','http://meeting'],
  ['https://meeting/meeting/11111111-1111-4111-8111-111111111111/room','https://untrusted.example']
 ]){
  const response=await s.room.fetch(new Request(url,{headers:{upgrade:'websocket',origin}}));
  assert.equal(response.status,403);
  assert.equal(s.all.length,0);
 }
});

test('locked meeting rejects new audience viewers as well as regular guests',async()=>{
 const s=await openRoom();
 await message(s.room,s.host,{t:'lock',on:true});
 const audience=s.add();
 await message(s.room,audience,{t:'join',room:s.host.d.room,key:s.key,aud:true,name:'Late audience'});
 assert.equal(audience.readyState,3);
 assert.ok(audience.messages.some(m=>m.t==='error'&&/locked/.test(m.msg)));
 const stageGuest=s.add();
 await message(s.room,stageGuest,{t:'join',room:s.host.d.room,key:s.key,aud:false,name:'Late participant'});
 assert.equal(stageGuest.readyState,3);
 assert.ok(stageGuest.messages.some(m=>m.t==='error'&&/locked/.test(m.msg)));
});

test('malformed structured WebSocket fields cannot crash meeting handlers',async()=>{
 const s=await openRoom();
 await message(s.room,s.host,{t:'watch',url:{toString:null}});
 assert.equal(s.host.messages.at(-1).url,'');
 await message(s.room,s.host,{t:'chat',text:{toString:null}});
 assert.equal(s.host.messages.at(-1).text,'');
 const guest=s.add();
 await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,name:{toString:null},aud:true});
 assert.equal(guest.readyState,1);
 assert.equal(guest.d.name,'Viewer');
});
test('host watch links reject URL credentials and malformed addresses',async()=>{
 const s=await openRoom();
 for(const url of [
  'https://user:password@example.com/video',
  'https://user@example.com/video',
  'https://example.com/video\u000apayload',
  'https://',
  'javascript:alert(1)'
 ]){
  await message(s.room,s.host,{t:'watch',url});
  assert.equal(s.host.messages.at(-1).url,'');
 }
 await message(s.room,s.host,{t:'watch',url:'https://example.com/video'});
 assert.equal(s.host.messages.at(-1).url,'https://example.com/video');
});

test('meeting watch links only allow HTTPS and reject HTTP',async()=>{
 const s=await openRoom();
 await message(s.room,s.host,{t:'watch',url:'http://example.com/video'});
 assert.equal(s.host.messages.at(-1).url,'');
 await message(s.room,s.host,{t:'watch',url:'https://example.com/video'});
 assert.equal(s.host.messages.at(-1).url,'https://example.com/video');
});
test('nonfinite room capacity remains bounded and slow mode normalizes invalid inputs',async()=>{
 const s=meeting();
 s.room.env.MEETING_ROOM_CAP='Infinity';
 for(let i=0;i<8;i++)s.add();
 const request=new Request('https://meeting/meeting/11111111-1111-4111-8111-111111111111/room',{headers:{upgrade:'websocket',origin:'https://meeting'}});
 assert.equal((await s.room.fetch(request)).status,429);
 const active=await openRoom();
 await message(active.room,active.host,{t:'slow',sec:'Infinity'});
 assert.equal(active.host.messages.at(-1).sec,0);
 await message(active.room,active.host,{t:'slow',sec:2.9});
 assert.equal(active.host.messages.at(-1).sec,2);
});

test('signalling rejects oversized and binary WebSocket messages before processing',async()=>{
 const huge=await openRoom();
 await huge.room.webSocketMessage(huge.host,'x'.repeat(20001));
 assert.equal(huge.host.readyState,3);
 assert.ok(huge.host.messages.some(m=>m.t==='error'&&m.msg==='Invalid message.'));
 const binary=await openRoom();
 await binary.room.webSocketMessage(binary.host,new Uint8Array([1,2,3]));
 assert.equal(binary.host.readyState,3);
 assert.ok(binary.host.messages.some(m=>m.t==='error'&&m.msg==='Invalid message.'));
});
test('signalling disconnects sustained message flooding',async()=>{
 const s=await openRoom();
 for(let i=0;i<101&&s.host.readyState===1;i++){
  await message(s.room,s.host,{t:'hand',on:true});
 }
 assert.equal(s.host.readyState,3);
 assert.ok(s.host.messages.some(m=>m.t==='error'&&/Too many messages/.test(m.msg)));
});

test('signalling relays valid WebRTC descriptions and rejects malformed payloads',async()=>{
 const s=await openRoom(),guest=s.add();
 await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,name:'Test participant'});
 await message(s.room,s.host,{t:'admit',gid:guest.d.id});
 const guestCount=guest.messages.length;
 for(const data of [null,[],{offer:'raw'},{sdp:{type:'invalid',sdp:'v=0'}},{sdp:{type:'offer',sdp:12}},{c:{candidate:12}}]){
  await message(s.room,s.host,{t:'sig',to:guest.d.id,data});
 }
 assert.equal(guest.messages.length,guestCount,'malformed host signalling must not reach guest');
 const hostCount=s.host.messages.length;
 await message(s.room,guest,{t:'sig',data:{sdp:{type:'answer',sdp:'v=0'}}});
 assert.equal(s.host.messages.length,hostCount+1);
 assert.equal(s.host.messages.at(-1).data.sdp.type,'answer');
 await message(s.room,s.host,{t:'sig',to:guest.d.id,data:{c:{candidate:'candidate:1 1 udp 1 127.0.0.1 1234 typ host'}}});
 assert.equal(guest.messages.at(-1).data.c.candidate.startsWith('candidate:'),true);
});

test('meeting security controls require booleans rather than truthy strings',async()=>{
 const s=await openRoom(),guest=s.add();
 await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,name:'Viewer',aud:true});
 assert.equal(s.host.d.locked,false);
 await message(s.room,s.host,{t:'lock',on:'true'});
 assert.equal(s.host.d.locked,false);
 await message(s.room,s.host,{t:'lock',on:true});
 assert.equal(s.host.d.locked,true);
 await message(s.room,s.host,{t:'lock',on:'false'});
 assert.equal(s.host.d.locked,true);
 await message(s.room,s.host,{t:'lock',on:false});
 assert.equal(s.host.d.locked,false);
 await message(s.room,s.host,{t:'audchat',on:false});
 assert.equal(s.host.d.audChat,false);
 await message(s.room,s.host,{t:'audchat',on:'true'});
 assert.equal(s.host.d.audChat,false);
 await message(s.room,s.host,{t:'mute',gid:guest.d.id,on:'false'});
 assert.equal(guest.messages.some(m=>m.t==='mute'),false);
 await message(s.room,guest,{t:'hand',on:'yes'});
 assert.equal(s.host.messages.some(m=>m.t==='hand'),false);
 await message(s.room,guest,{t:'hand',on:true});
 assert.equal(s.host.messages.at(-1).t,'hand');
});

test('WebRTC signalling forwards only allowlisted session and ICE fields',async()=>{
 const s=await openRoom(),guest=s.add();
 await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,name:'Participant'});
 await message(s.room,s.host,{t:'admit',gid:guest.d.id});
 await message(s.room,guest,{t:'sig',data:{sdp:{type:'offer',sdp:'v=0',secret:'remove'},unexpected:'remove'}});
 assert.deepEqual(s.host.messages.at(-1).data,{sdp:{type:'offer',sdp:'v=0'}});
 await message(s.room,s.host,{t:'sig',to:guest.d.id,data:{c:{candidate:'candidate:1',sdpMid:'0',sdpMLineIndex:0,usernameFragment:'abc',secret:'remove'},extra:'remove'}});
 assert.deepEqual(guest.messages.at(-1).data,{c:{candidate:'candidate:1',sdpMid:'0',sdpMLineIndex:0,usernameFragment:'abc'}});
});

test('malformed slow-mode values cannot crash a room or change moderation state',async()=>{
 const s=await openRoom();
 await message(s.room,s.host,{t:'slow',sec:15});
 assert.equal(s.host.d.slow,15);
 await message(s.room,s.host,{t:'slow',sec:{toString:null}});
 assert.equal(s.host.readyState,1);
 assert.equal(s.host.d.slow,0);
 await message(s.room,s.host,{t:'slow',sec:2});
 assert.equal(s.host.d.slow,2);
});
test('participant audio flags require a literal true value',async()=>{
 const s=await openRoom(),guest=s.add();
 await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,aud:false,ao:'false',name:'Guest'});
 assert.equal(guest.d.ao,false);
 await message(s.room,s.host,{t:'admit',gid:guest.d.id});
 assert.equal(s.host.messages.at(-1).ao,false);
});

test('promoted audience must remain an audience member when accepting promotion',async()=>{
 const s=await openRoom(),viewer=s.add();
 await message(s.room,viewer,{t:'join',room:s.host.d.room,key:s.key,aud:true,name:'Viewer'});
 await message(s.room,s.host,{t:'promote',gid:viewer.d.id});
 assert.equal(viewer.d.invited,true);
 viewer.d.aud=false;
 await message(s.room,viewer,{t:'ready',ao:true});
 assert.equal(viewer.d.stage,false);
 assert.equal(viewer.d.invited,true);
 viewer.d.aud=true;
 await message(s.room,viewer,{t:'ready',ao:true});
 assert.equal(viewer.d.stage,true);
 assert.equal(viewer.d.invited,false);
});

test('meeting alarm closes orphaned audience sockets when host is absent',async()=>{
 const s=await openRoom(),viewer=s.add();
 await message(s.room,viewer,{t:'join',room:s.host.d.room,key:s.key,aud:true,name:'Viewer'});
 s.host.readyState=3;
 await s.room.alarm();
 assert.equal(viewer.readyState,3);
 assert.ok(viewer.messages.some(m=>m.t==='closed'&&/host is no longer connected/i.test(m.why)));
});
