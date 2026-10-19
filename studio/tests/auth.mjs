import './resolve-ts.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pbkdf2Sync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {studioAuthRoute,studioOwner}=await import('../src/studio-auth.ts');
const {default:engine}=await import('../src/index.ts');
const target=new URL('../../tests/studio-worker-test.mjs',import.meta.url);
fs.writeFileSync(target,fs.readFileSync(new URL('../../control-room-worker.js',import.meta.url),'utf8')+'\nexport {studioIssue,studioRedeem,minRole,sessionCookie};');
try{
 const {studioIssue,studioRedeem,minRole,sessionCookie,default:control}=await import(target.href);
 const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync(new URL('../../schema.sql',import.meta.url),'utf8'));const migration=fs.readFileSync(new URL('../../migrations/0003_studio_signin.sql',import.meta.url),'utf8');raw.exec(migration);raw.exec(migration);
 raw.prepare("INSERT INTO users(username,role,status,pass_ver,kind) VALUES('owner','owner','active',1,'staff')").run();
 const user=raw.prepare("SELECT * FROM users WHERE username='owner'").get();
 const DB={prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async first(){return raw.prepare(sql).get(...this.args)||null;},async all(){return {results:raw.prepare(sql).all(...this.args)};},async run(){return raw.prepare(sql).run(...this.args);}};}};
 const kv=new Map(),LIVE_STATUS_KV={async get(k){return kv.get(k)||null;},async put(k,v){kv.set(k,v);},async delete(k){kv.delete(k);}};
 const secret='test-only-studio-bridge-secret-32-characters';
 const controlEnv={DB,ADMIN_USER:'owner',ADMIN_PASS:'sample-owner-password',SESSION_SECRET:'test-only-control-secret',STUDIO_URL:'https://studio.test',STUDIO_SSO_SECRET:secret};
 const env={DB,LIVE_STATUS_KV,ASSETS:{fetch:async()=>new Response(fs.readFileSync(new URL('../public/signin.html',import.meta.url),'utf8'),{headers:{'content-type':'text/html'}})},STUDIO_SSO_SECRET:secret,CONTROL_ROOM_URL:'https://room.test',MEDIA_ENGINE_SHARED_SECRET:'media-test-secret'};
 const req=(url,method='GET',data,headers={})=>new Request(url,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
 let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
 let state,stateCookie,callback;
 await test('missing configuration fails closed and Studio never redirects to the old website',async()=>{assert.equal((await studioAuthRoute(req('https://studio.test/auth/start'),{...env,STUDIO_SSO_SECRET:''})).status,503);const root=await engine.fetch(req('https://studio.test/'),env);assert.equal(root.status,200);assert.match(await root.text(),/Continue with control room/);assert.equal(root.headers.get('cache-control'),'no-store');});
 await test('Studio creates browser-bound state and targets only the configured control room',async()=>{const r=await studioAuthRoute(req('https://studio.test/auth/start'),env);const u=new URL(r.headers.get('location'));assert.equal(u.origin,'https://room.test');state=u.searchParams.get('state');stateCookie=r.headers.get('set-cookie').split(';')[0];assert.match(state,/^[a-f0-9]{64}$/);assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);});
 await test('staff and members cannot mint Studio owner grants',async()=>{for(const u of [{...user,role:'admin'},{...user,kind:'member'}])await assert.rejects(studioIssue(req('https://room.test/api/owner/studio/signin','POST',{state}),controlEnv,u),e=>e.status===403);assert.equal(minRole('studio/signin','POST'),4);});
 await test('owner grant uses a 60 second code without a password or provider credential',async()=>{const r=await studioIssue(req('https://room.test/api/owner/studio/signin','POST',{state}),controlEnv,user);callback=new URL((await r.json()).url);assert.equal(callback.origin,'https://studio.test');assert.equal(callback.pathname,'/auth/callback');assert.equal(raw.prepare('SELECT count(*) n FROM studio_signin_codes').get().n,1);assert.ok(!callback.href.includes(secret));assert.ok(!callback.href.includes(controlEnv.ADMIN_PASS));});
 await test('missing state cookie, foreign state and wrong backchannel key are denied',async()=>{assert.equal((await studioAuthRoute(req(callback.href),env)).status,401);assert.equal((await studioAuthRoute(req(callback.href,'GET',undefined,{cookie:'__Host-hk-studio-state='+'f'.repeat(64)}),env)).status,401);await assert.rejects(studioRedeem(req('https://room.test/api/studio/redeem','POST',{state,code:callback.searchParams.get('code'),audience:'https://studio.test'},{authorization:'Bearer wrong'}),controlEnv),e=>e.status===401);});
 const realFetch=globalThis.fetch;let sessionCookieValue;
 try{
  globalThis.fetch=async(url,options)=>control.fetch(new Request(url,options),controlEnv);
  await test('backchannel redemption creates an HttpOnly session and atomically consumes the code',async()=>{const r=await studioAuthRoute(req(callback.href,'GET',undefined,{cookie:stateCookie}),env);assert.equal(r.status,303);sessionCookieValue=r.headers.getSetCookie().find(x=>x.startsWith('__Host-hk-studio=')).split(';')[0];assert.equal((await studioOwner(req('https://studio.test/', 'GET',undefined,{cookie:sessionCookieValue}),env)).sub,'control-room:'+user.id);assert.equal(raw.prepare('SELECT count(*) n FROM studio_signin_codes').get().n,0);});
  await test('replaying the same callback cannot create another session',async()=>{assert.equal((await studioAuthRoute(req(callback.href,'GET',undefined,{cookie:stateCookie}),env)).status,401);});
 }finally{globalThis.fetch=realFetch;}
 await test('protected APIs deny anonymous and expired sessions; browser writes reject foreign origins',async()=>{assert.equal((await engine.fetch(req('https://studio.test/api/media'),env)).status,401);assert.equal((await engine.fetch(req('https://studio.test/api/broadcast/settings','POST',{}, {cookie:sessionCookieValue,origin:'https://evil.test'}),env)).status,403);const id=sessionCookieValue.split('=')[1],saved=kv.get('studio-session:'+id);kv.set('studio-session:'+id,JSON.stringify({...JSON.parse(saved),exp:1}));assert.equal(await studioOwner(req('https://studio.test/','GET',undefined,{cookie:sessionCookieValue}),env),null);kv.set('studio-session:'+id,saved);});
 await test('expired codes and changed owner password versions cannot be redeemed',async()=>{for(const kind of ['expired','password']){const r=await studioIssue(req('https://room.test/','POST',{state}),controlEnv,user);const c=new URL((await r.json()).url).searchParams.get('code');if(kind==='expired')raw.exec('UPDATE studio_signin_codes SET expires_at=1');else raw.exec('UPDATE users SET pass_ver=2');await assert.rejects(studioRedeem(req('https://room.test/api/studio/redeem','POST',{state,code:c,audience:'https://studio.test'},{authorization:'Bearer '+secret}),controlEnv),e=>e.status===401);}raw.exec('UPDATE users SET pass_ver=1');});
 await test('control room rejects cross-origin grant creation even with an owner cookie',async()=>{const cookie=await sessionCookie(controlEnv,user.id,1);const r=await control.fetch(req('https://room.test/api/owner/studio/signin','POST',{state},{cookie,origin:'https://evil.test','x-cr':'1'}),controlEnv);assert.equal(r.status,403);});
 await test('logout rejects cross-origin requests and revokes the server session',async()=>{assert.equal((await studioAuthRoute(req('https://studio.test/auth/logout','POST',undefined,{cookie:sessionCookieValue,origin:'https://evil.test'}),env)).status,403);assert.equal((await studioAuthRoute(req('https://studio.test/auth/logout','POST',undefined,{cookie:sessionCookieValue,origin:'https://studio.test'}),env)).status,204);assert.equal(await studioOwner(req('https://studio.test/','GET',undefined,{cookie:sessionCookieValue}),env),null);});
 await test('malformed and overlong capability tokens fail closed',async()=>{for(const token of ['a.b.extra','a'.repeat(5000),btoa(JSON.stringify({sub:'1',role:'Super Administrator',exp:Date.now()/1000+60}))+'.'+'0'.repeat(64)])assert.equal((await engine.fetch(req('https://studio.test/api/media','GET',undefined,{'X-Heavenly-Key-Internal':'media-engine-v1',authorization:'Bearer '+token}),env)).status,401);});

 await test('original signed API integration supports media upload, playlist publishing and settings',async()=>{
  const mediaDB=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../migrations/',import.meta.url)).sort())mediaDB.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async first(){return mediaDB.prepare(sql).get(...this.args)||null;},async all(){return {results:mediaDB.prepare(sql).all(...this.args)};},async run(){const result=mediaDB.prepare(sql).run(...this.args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}};}};
  const objects=new Map(),parts=new Map();const R2={async createMultipartUpload(key){return {uploadId:'upload-test'};},resumeMultipartUpload(key){return {async uploadPart(n,data){parts.set(n,data);return {etag:'part-'+n};},async complete(){const bytes=Buffer.concat([...parts.values()].map(x=>Buffer.from(x)));objects.set(key,bytes);},async abort(){}};},async head(key){const bytes=objects.get(key);return bytes?{size:bytes.length}:null;},async get(key){const bytes=objects.get(key);return bytes?{body:bytes,size:bytes.length,writeHttpMetadata(h){h.set('Content-Type','video/mp4');}}:null;}};
  const now=Math.floor(Date.now()/1000),encoded=btoa(JSON.stringify({sub:'1',role:'Super Administrator',iat:now,exp:now+60,nonce:'legacy-api-test'}));const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MEDIA_ENGINE_SHARED_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(encoded)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const mediaEnv={...env,DB:db,MEDIA_R2:R2};
  const call=(path,method='GET',body)=>engine.fetch(new Request('https://studio.test'+path,{method,headers:{authorization:'Bearer '+encoded+'.'+sig,'X-Heavenly-Key-Internal':'media-engine-v1','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),mediaEnv);
  const created=await call('/api/media','POST',{object_key:'uploads/sample.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:4,keep_media:true});assert.equal(created.status,201);const {media_id:id}=await created.json();
  assert.equal((await call('/api/media/'+id+'/multipart','POST',{})).status,201);
  const part=await engine.fetch(new Request('https://studio.test/api/media/'+id+'/multipart/part/1',{method:'PUT',headers:{authorization:'Bearer '+encoded+'.'+sig,'X-Heavenly-Key-Internal':'media-engine-v1'},body:new Uint8Array([1,2,3,4])}),mediaEnv);assert.equal(part.status,200);
  const state=await (await call('/api/media/'+id+'/multipart/status')).json();assert.equal(state.parts.length,1);
  assert.equal((await call('/api/media/'+id+'/multipart/complete','POST',{})).status,200);
  assert.equal((await call('/api/media/'+id+'/publish','POST',{published:true})).status,200);
  const list=await (await call('/api/media')).json();assert.equal(list.items[0].status,'published');
  assert.equal((await call('/api/broadcast/settings','POST',{channel:'video',enabled:true})).status,200);
  mediaDB.close();
 });

 await test('direct Studio sign-in uses the existing control room owner password',async()=>{
  const realFetch=globalThis.fetch;try{globalThis.fetch=async(url,options)=>control.fetch(new Request(url,options),controlEnv);
  const response=await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'owner',pass:controlEnv.ADMIN_PASS},{origin:'https://studio.test','cf-connecting-ip':'192.0.2.1'}),env);assert.equal(response.status,303);
  const c=response.headers.getSetCookie().find(x=>x.startsWith('__Host-hk-studio=')).split(';')[0];const who=await studioOwner(req('https://studio.test/','GET',undefined,{cookie:c}),env);assert.equal(who.role,'Super Administrator');
  assert.equal(raw.prepare("SELECT pass_hash FROM users WHERE username='owner'").get().pass_hash,null);
  }finally{globalThis.fetch=realFetch;}
 });
 await test('direct admin sign-in retains admin role and uses the current password hash',async()=>{
  const salt='test-admin-salt',password='sample-admin-password',hash=pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
  raw.prepare("INSERT INTO users(username,role,status,pass_ver,kind,pass_hash,salt,iters) VALUES('studioadmin','admin','active',1,'staff',?,?,100000)").run(hash,salt);
  const realFetch=globalThis.fetch;try{globalThis.fetch=async(url,options)=>control.fetch(new Request(url,options),controlEnv);
  const response=await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'studioadmin',pass:password},{origin:'https://studio.test','cf-connecting-ip':'192.0.2.2'}),env);assert.equal(response.status,303);
  const c=response.headers.getSetCookie().find(x=>x.startsWith('__Host-hk-studio=')).split(';')[0];assert.equal((await studioOwner(req('https://studio.test/','GET',undefined,{cookie:c}),env)).role,'Administrator');
  assert.equal(raw.prepare("SELECT pass_hash FROM users WHERE username='studioadmin'").get().pass_hash,hash);
  const denied=await engine.fetch(req('https://studio.test/api/media-engine/livekit/connection','POST',{action:'reset'},{cookie:c,origin:'https://studio.test'}),env);assert.equal(denied.status,403);
  }finally{globalThis.fetch=realFetch;}
 });
 await test('direct sign-in rejects wrong credentials, foreign origins and oversized bodies',async()=>{
  const realFetch=globalThis.fetch;try{globalThis.fetch=async(url,options)=>control.fetch(new Request(url,options),controlEnv);
  assert.equal((await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'owner',pass:'wrong-password'},{origin:'https://studio.test','cf-connecting-ip':'192.0.2.3'}),env)).status,401);
  assert.equal((await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'owner',pass:controlEnv.ADMIN_PASS},{origin:'https://evil.test'}),env)).status,403);
  assert.equal((await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'owner',pass:'x'.repeat(3000)},{origin:'https://studio.test'}),env)).status,413);
  }finally{globalThis.fetch=realFetch;}
 });
 await test('the password backchannel requires authentication and preserves login throttling',async()=>{
  const response=await control.fetch(req('https://room.test/api/studio/password-login','POST',{user:'owner',pass:controlEnv.ADMIN_PASS,audience:'https://studio.test'}),controlEnv);assert.equal(response.status,401);
  const realFetch=globalThis.fetch;try{globalThis.fetch=async(url,options)=>control.fetch(new Request(url,options),controlEnv);
  for(let i=0;i<10;i++)assert.equal((await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'nobody',pass:'wrong-password'},{origin:'https://studio.test','cf-connecting-ip':'192.0.2.4'}),env)).status,401);
  assert.equal((await studioAuthRoute(req('https://studio.test/auth/password','POST',{user:'owner',pass:controlEnv.ADMIN_PASS},{origin:'https://studio.test','cf-connecting-ip':'192.0.2.4'}),env)).status,429);
  assert.equal(raw.prepare("SELECT count(*) n FROM login_attempts WHERE ip='192.0.2.4'").get().n,10);
  }finally{globalThis.fetch=realFetch;}
 });
 raw.close();console.log(count+' Studio authentication checks passed');
}finally{fs.unlinkSync(target);}
