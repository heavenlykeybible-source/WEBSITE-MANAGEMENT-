import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'scripts/bundle-control-room.mjs')]);
const {default:app}=await import(pathToFileURL(path.join(root,'build/meeting-worker.mjs')));
test('TURN readiness requires a valid relay URL and a sufficiently long secret',async()=>{
 const health=async vars=>{const d=database();try{return (await (await app.fetch(new Request('https://meeting/api/health'),{...vars,TEAMDB:d.DB},{})).json()).turnConfigured}finally{d.raw.close()}};
 assert.equal(await health({TURN_URLS:'invalid',TURN_SHARED_SECRET:'x'.repeat(40)}),false);
 assert.equal(await health({TURN_URLS:'turn:relay.example.org:3478',TURN_SHARED_SECRET:'short'}),false);
 assert.equal(await health({TURN_URLS:'turn:relay.example.org:3478',TURN_SHARED_SECRET:'x'.repeat(40)}),true);
});
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
test('invalid meeting room capacity uses a safe finite default',async()=>{
 const s=await openRoom();
 for(const bad of ['Infinity','NaN','-9','']){
  s.room.env.MEETING_ROOM_CAP=bad;
  for(let i=0;i<24;i++)if(s.room.guests().length<24){const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true});}
  const overflow=s.add();await message(s.room,overflow,{t:'join',room:s.host.d.room,key:s.key,aud:true});
  assert.equal(overflow.readyState,3,'invalid cap '+bad+' must not allow unlimited guests');
 }
});
test('invalid meeting capacity settings fall back safely and fractional limits round down',async()=>{
 const s=await openRoom();
 for(const bad of ['NaN','Infinity','-3','0']){
  s.room.env.MEETING_ROOM_CAP=bad;
  for(let i=0;i<24;i++){const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true});assert.equal(g.d.role,'guest');g.readyState=3;}
 }
 s.room.env.MEETING_ROOM_CAP='3.9';
 const a=s.add(),b=s.add();
 await message(s.room,a,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 await message(s.room,b,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 assert.equal(a.d.role,'guest');assert.equal(b.d.role,'guest');
 const c=s.add();await message(s.room,c,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 assert.equal(c.readyState,3);
});
test('meeting room counts audience and speaker guests together against capacity',async()=>{
 const s=await openRoom();s.room.env.MEETING_ROOM_CAP='4';
 const first=s.add(),second=s.add(),third=s.add();
 await message(s.room,first,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 await message(s.room,second,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 await message(s.room,third,{t:'join',room:s.host.d.room,key:s.key,aud:false});
 assert.equal(first.d.role,'guest');assert.equal(second.d.role,'guest');assert.equal(third.d.role,'guest');
 const extra=s.add();await message(s.room,extra,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 assert.equal(extra.readyState,3);assert.match(extra.messages.at(-1).msg,/full/);
});
test('meeting room rejects excess peers before allocating WebSockets',async()=>{
 const s=meeting();for(let i=0;i<25;i++)s.add();
 const req=new Request('https://meeting/meeting/11111111-1111-4111-8111-111111111111/room',{headers:{upgrade:'websocket',origin:'https://meeting'}});
 const response=await s.room.fetch(req);
 assert.equal(response.status,429);
});
function roomToken(extra={}){const p=Buffer.from(JSON.stringify({k:'meeting',u:'owner@test.local',r:'11111111-1111-4111-8111-111111111111',exp:Date.now()+60000,pe:Date.now()+86400000,...extra})).toString('base64url');return p+'.'+createHmac('sha256',secret).update(p).digest('hex');}
const message=(room,w,m)=>room.webSocketMessage(w,JSON.stringify(m));
async function openRoom(){const s=meeting(),host=s.add();await message(s.room,host,{t:'host',token:roomToken()});return {...s,host,key:host.messages.at(-1).key};}
test('short TURN secrets never generate unusable relay credentials',async()=>{
 const s=meeting();s.room.env.TURN_URLS='turn:relay.example:3478';s.room.env.TURN_SHARED_SECRET='short';
 const host=s.add();await message(s.room,host,{t:'host',token:roomToken()});
 const config=host.messages.at(-1);assert.equal(config.t,'created');assert.equal(config.ice.length,1);
});
test('Invalid TURN endpoints are excluded from guest and host ICE configuration',async()=>{
 const s=meeting();s.room.env.TURN_URLS='turn:bad-user@relay.example,turn:relay.example:99999,turn:relay.example:3478';
 s.room.env.TURN_SHARED_SECRET='test-only-long-enough-turn-secret';
 const host=s.add();await message(s.room,host,{t:'host',token:roomToken()});
 const ice=host.messages.at(-1).ice;
 assert.equal(ice.length,2);
 assert.deepEqual(ice[1].urls,['turn:relay.example:3478']);
});
test('TURN relay credentials are time-limited and never expose the shared secret',async()=>{
 const s=meeting();s.room.env.TURN_URLS='turn:relay.example:3478,turns:relay.example:5349';
 s.room.env.TURN_SHARED_SECRET='test-only-turn-secret-with-32-chars';
 const host=s.add();await message(s.room,host,{t:'host',token:roomToken()});
 const config=host.messages.at(-1);
 assert.equal(config.t,'created');
 assert.equal(config.ice.length,2);
 const relay=config.ice[1];
 assert.deepEqual(relay.urls,['turn:relay.example:3478','turns:relay.example:5349']);
 assert.ok(relay.username.endsWith(':'+host.d.room));
 const expires=Number(relay.username.split(':')[0]);
 assert.ok(expires*1000>Date.now()+3500_000 && expires*1000<Date.now()+3700_000);
 assert.equal(relay.credential,createHmac('sha1',s.room.env.TURN_SHARED_SECRET).update(relay.username).digest('base64'));
 assert.equal(JSON.stringify(config).includes(s.room.env.TURN_SHARED_SECRET),false);
 const guest=s.add();await message(s.room,guest,{t:'join',room:host.d.room,key:config.key,aud:true});
 assert.deepEqual(guest.messages.find(m=>m.t==='welcome').ice,config.ice.map(x=>x.urls ? x : x));
});
test('TURN falls back to STUN when no relay secret is installed',async()=>{
 const s=await openRoom();assert.equal(s.host.messages[0].ice.length,1);
});
test('meeting host requires purpose, matching room and unexpired signed access',async()=>{
 for(const token of ['bad',roomToken({k:'control-owner'}),roomToken({r:'another'}),roomToken({exp:Date.now()-1}),roomToken({pe:Date.now()-1})]){const s=meeting(),w=s.add();await message(s.room,w,{t:'host',token});assert.equal(w.readyState,3);}
 const s=await openRoom();assert.equal(s.host.messages[0].t,'created');const other=s.add();await message(s.room,other,{t:'host',token:roomToken()});assert.equal(other.readyState,3);
});
test('waiting guests cannot chat or signal until host admission; hibernation keeps room controls',async()=>{
 const s=await openRoom(),guest=s.add();await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,name:'Visitor',pass:'test-pass'});
 assert.equal(s.host.messages.at(-2)?.t==='waiting'||s.host.messages.some(m=>m.t==='waiting'),true);
 await message(s.room,guest,{t:'chat',text:'blocked'});await message(s.room,guest,{t:'sig',data:{offer:'blocked'}});assert.ok(!s.host.messages.some(m=>m.text==='blocked'||m.data?.offer==='blocked'));
 const restored=new MeetingRooms(s.state,{AUTH_SECRET:secret});await message(restored,s.host,{t:'admit',gid:guest.d.id});assert.equal(guest.d.stage,true);
 await message(restored,guest,{t:'sig',data:{sdp:{type:'offer',sdp:'v=0'}}});assert.equal(s.host.messages.at(-1).data.sdp.sdp,'v=0');
 await message(restored,s.host,{t:'lock',on:true});const denied=s.add();await message(restored,denied,{t:'join',room:s.host.d.room,key:s.key});assert.equal(denied.readyState,3);
 await message(restored,s.host,{t:'sig',to:'wrong-room',data:{secret:'private'}});assert.ok(!guest.messages.some(m=>m.data?.secret));
});
test('locked meeting rejects both audience and speaker newcomers while existing viewers remain',async()=>{
 const s=await openRoom(),existing=s.add();
 await message(s.room,existing,{t:'join',room:s.host.d.room,key:s.key,aud:true,name:'Already here'});
 assert.equal(existing.d.ok,true);
 await message(s.room,s.host,{t:'lock',on:true});
 for(const aud of [true,false]){
  const guest=s.add();await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,aud,name:'Late guest'});
  assert.equal(guest.readyState,3);
  assert.equal(guest.messages.at(-1)?.t,'error');
 }
 assert.equal(existing.readyState,1);
 await message(s.room,s.host,{t:'lock',on:false});
 const reopened=s.add();await message(s.room,reopened,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 assert.equal(reopened.d.ok,true);
});
test('expired speaker invitations free slots and cannot be accepted late',async()=>{
 const s=await openRoom(),audience=[];
 for(let i=0;i<7;i++){const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true});audience.push(g);}
 for(const g of audience.slice(0,6))await message(s.room,s.host,{t:'promote',gid:g.d.id});
 audience[0].d.invitedAt=Date.now()-61000;
 await message(s.room,s.host,{t:'promote',gid:audience[6].d.id});
 assert.equal(audience[6].d.invited,true);
 await message(s.room,audience[0],{t:'ready'});
 assert.equal(audience[0].d.stage,false);
 assert.equal(audience[0].d.invited,false);
 assert.match(audience[0].messages.at(-1).text,/invitation expired/i);
 await message(s.room,audience[6],{t:'ready'});
 assert.equal(audience[6].d.stage,true);
});
test('host admission respects speaker slots reserved for promoted audience',async()=>{
 const s=await openRoom(),audience=[];
 for(let i=0;i<6;i++){
  const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true});audience.push(g);
  await message(s.room,s.host,{t:'promote',gid:g.d.id});
 }
 const waiting=s.add();await message(s.room,waiting,{t:'join',room:s.host.d.room,key:s.key,aud:false});
 await message(s.room,s.host,{t:'admit',gid:waiting.d.id});
 assert.equal(waiting.d.stage,false);
 assert.equal(waiting.d.ok,false);
 assert.match(s.host.messages.at(-1).text,/stage is full/i);
 await message(s.room,audience[0],{t:'ready'});
 assert.equal(audience[0].d.stage,true);
 await message(s.room,s.host,{t:'admit',gid:waiting.d.id});
 assert.equal(waiting.d.stage,false);
});
test('reconnecting approved speaker cannot steal a reserved stage slot',async()=>{
 const s=await openRoom(),speakers=[];
 for(let i=0;i<5;i++){const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:false,pass:'approved-'+i});await message(s.room,s.host,{t:'admit',gid:g.d.id});speakers.push(g);}
 const leaving=speakers[0];leaving.readyState=3;s.room.webSocketClose(leaving);
 const viewer=s.add();await message(s.room,viewer,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 await message(s.room,s.host,{t:'promote',gid:viewer.d.id});assert.equal(viewer.d.invited,true);
 const returning=s.add();await message(s.room,returning,{t:'join',room:s.host.d.room,key:s.key,aud:false,pass:'approved-0'});
 assert.equal(returning.d.stage,false);
 assert.equal(returning.d.ok,false);
 await message(s.room,viewer,{t:'ready'});assert.equal(viewer.d.stage,true);
});
test('host admission respects stage reservations for invited audience',async()=>{
 const s=await openRoom(),audience=[];
 for(let i=0;i<6;i++){const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true});audience.push(g);}
 for(const g of audience)await message(s.room,s.host,{t:'promote',gid:g.d.id});
 const waiting=s.add();await message(s.room,waiting,{t:'join',room:s.host.d.room,key:s.key,aud:false});
 await message(s.room,s.host,{t:'admit',gid:waiting.d.id});
 assert.equal(waiting.d.stage,false);
 assert.equal(waiting.d.ok,false);
 assert.match(s.host.messages.at(-1).text,/stage is full/i);
});
test('pending audience promotions reserve stage capacity',async()=>{
 const s=await openRoom(),audience=[];
 for(let i=0;i<7;i++){
  const g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true});audience.push(g);
 }
 for(const g of audience.slice(0,6))await message(s.room,s.host,{t:'promote',gid:g.d.id});
 assert.equal(audience.slice(0,6).filter(g=>g.d.invited).length,6);
 await message(s.room,s.host,{t:'promote',gid:audience[6].d.id});
 assert.equal(audience[6].d.invited,false);
 assert.match(s.host.messages.at(-1).text,/stage is full/i);
 await message(s.room,audience[0],{t:'ready'});
 assert.equal(audience[0].d.stage,true);
 await message(s.room,s.host,{t:'promote',gid:audience[6].d.id});
 assert.equal(audience[6].d.invited,false);
});
test('promoted audience reconnects as an admitted speaker and demotion revokes the shortcut',async()=>{
 const s=await openRoom(),g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:true,pass:'persistent-viewer'});
 await message(s.room,s.host,{t:'promote',gid:g.d.id});await message(s.room,g,{t:'ready',ao:true});
 assert.equal(g.d.stage,true);assert.ok(s.host.d.admitted.includes('persistent-viewer'));
 g.readyState=3;s.room.webSocketClose(g);
 const reconnect=s.add();await message(s.room,reconnect,{t:'join',room:s.host.d.room,key:s.key,aud:false,pass:'persistent-viewer'});
 assert.equal(reconnect.d.stage,true);
 await message(s.room,s.host,{t:'demote',gid:reconnect.d.id});
 assert.equal(reconnect.d.stage,false);assert.ok(!s.host.d.admitted.includes('persistent-viewer'));
});
test('empty and malformed meeting chat never reaches participants',async()=>{
 const s=await openRoom(),guest=s.add();
 await message(s.room,guest,{t:'join',room:s.host.d.room,key:s.key,aud:true});
 const before=guest.messages.filter(m=>m.t==='chat').length;
 for(const value of ['', '   ', null, 42, '<>'])await message(s.room,s.host,{t:'chat',text:value});
 assert.equal(guest.messages.filter(m=>m.t==='chat').length,before);
 await message(s.room,s.host,{t:'chat',text:'Welcome everyone'});
 assert.equal(guest.messages.filter(m=>m.t==='chat').at(-1).text,'Welcome everyone');
});
test('meeting signaling ignores malformed SDP/ICE payloads',async()=>{
 const s=await openRoom(),g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:false});
 await message(s.room,s.host,{t:'admit',gid:g.d.id});
 const n=g.messages.length;await message(s.room,s.host,{t:'sig',to:g.d.id,data:null});
 await message(s.room,s.host,{t:'sig',to:g.d.id,data:['malformed']});assert.equal(g.messages.length,n);
 const count=s.host.messages.length;await message(s.room,g,{t:'sig',data:'invalid'});assert.equal(s.host.messages.length,count);
 await message(s.room,s.host,{t:'sig',to:g.d.id,data:{sdp:{type:'offer',sdp:42}}});
 await message(s.room,s.host,{t:'sig',to:g.d.id,data:{c:{candidate:42}}});
 await message(s.room,s.host,{t:'sig',to:g.d.id,data:{unknown:'payload'}});
 assert.equal(g.messages.length,n);
 await message(s.room,s.host,{t:'sig',to:g.d.id,data:{sdp:{type:'offer',sdp:'v=0'}}});
 assert.equal(g.messages.at(-1).data.sdp.sdp,'v=0');
});
test('WebRTC relay rejects unknown, malformed and oversized signaling data',async()=>{
 const s=await openRoom(),g=s.add();await message(s.room,g,{t:'join',room:s.host.d.room,key:s.key,aud:false});
 await message(s.room,s.host,{t:'admit',gid:g.d.id});
 const bad=[{}, {other:'unexpected'}, {sdp:{type:'pranswer',sdp:'v=0'}}, {sdp:{type:'offer',sdp:''}}, {sdp:{type:'offer',sdp:'x'.repeat(18001)}}, {c:{candidate:12}}, {c:{candidate:'x'.repeat(12001)}}];
 for(const data of bad){const n=g.messages.length;await message(s.room,s.host,{t:'sig',to:g.d.id,data});assert.equal(g.messages.length,n);}
 for(const data of [{sdp:{type:'offer',sdp:'v=0'}},{sdp:{type:'answer',sdp:'v=0'}},{c:{candidate:'candidate:1 1 udp 1 127.0.0.1 1234 typ host'}}]){
  const n=g.messages.length;await message(s.room,s.host,{t:'sig',to:g.d.id,data});assert.equal(g.messages.length,n+1);
 }
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
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret,MEETING_ROOMS:{idFromName(){return 'test-room-id'},get(){return {fetch(){}}}}};
 const loginResponse=await login(env,ticket());const html=await loginResponse.text(),token=JSON.parse(html.match(/localStorage.setItem\("ls_tok",("[^"]+")\)/)[1]);
 const r=await app.fetch(new Request('https://meeting/api/meeting-token',{headers:{authorization:'Bearer '+token}}),env,{}),j=await r.json();assert.equal(r.status,200);assert.match(j.url,/^wss:\/\/meeting\/meeting\/[a-f0-9-]{36}$/);
 const invalidHealth=await (await app.fetch(new Request('https://meeting/api/health'),{...env,MEETING_ROOMS:{}},{})).json();assert.equal(invalidHealth.meetingConfigured,false);
 const health=await (await app.fetch(new Request('https://meeting/api/health'),env,{})).json();assert.equal(health.meetingConfigured,true);assert.equal(health.relayConfigured,false);assert.equal(health.turnConfigured,false);
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
