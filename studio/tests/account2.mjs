import './resolve-ts.mjs';
import assert from 'node:assert/strict';
const {studioAuthRoute,studioOwner}=await import('../src/studio-auth.ts');
const kv=new Map();
const env={STUDIO_AUTH_MODE:'account2',ADMIN_USERNAME:'existing-owner',ADMIN_PASSWORD:'test-only-existing-owner-password',LIVE_STATUS_KV:{async get(k){return kv.get(k)||null;},async put(k,v){kv.set(k,v);},async delete(k){kv.delete(k);}}};
const request=(data,origin='https://studio.test',ip='test-client')=>new Request('https://studio.test/auth/password',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify(data)});
const correct={user:env.ADMIN_USERNAME,pass:env.ADMIN_PASSWORD};
let fetches=0;const original=globalThis.fetch;globalThis.fetch=async()=>{fetches++;throw Error('Account 2 must not call another account');};
try{
 assert.equal((await studioAuthRoute(request(correct),{...env,ADMIN_PASSWORD:''})).status,503);
 assert.equal((await studioAuthRoute(request(correct,'https://evil.test'),env)).status,403);
 assert.equal((await studioAuthRoute(request({user:correct.user,pass:'wrong'}),env)).status,401);
 const response=await studioAuthRoute(request(correct),env);assert.equal(response.status,303);
 const cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-hk-studio=')).split(';')[0];
 assert.match(response.headers.getSetCookie()[0],/HttpOnly; Secure; SameSite=Lax/);
 const sessionRequest=new Request('https://studio.test/',{headers:{cookie}});
 assert.equal((await studioOwner(sessionRequest,env)).sub,'account2:owner');
 assert.equal(await studioOwner(sessionRequest,{...env,ADMIN_PASSWORD:'changed-password'}),null);
 assert.equal(await studioOwner(sessionRequest,{...env,STUDIO_AUTH_MODE:undefined}),null);
 assert.equal((await studioAuthRoute(new Request('https://studio.test/auth/start'),env)).status,503);
 assert.deepEqual(await (await studioAuthRoute(new Request('https://studio.test/auth/options'),env)).json(),{controlRoom:false,directAccount2:true});
 for(let i=0;i<10;i++)assert.equal((await studioAuthRoute(request({user:'wrong',pass:'wrong'},'https://studio.test','blocked-client'),env)).status,401);
 assert.equal((await studioAuthRoute(request(correct,'https://studio.test','blocked-client'),env)).status,429);
 const logout=new Request('https://studio.test/auth/logout',{method:'POST',headers:{cookie,origin:'https://studio.test'}});
 assert.equal((await studioAuthRoute(logout,env)).status,204);assert.equal(await studioOwner(sessionRequest,env),null);
 assert.equal(fetches,0);assert.ok(!JSON.stringify([...kv]).includes(env.ADMIN_PASSWORD));
 console.log('PASS Account 2 direct owner sign-in, cross-origin denial, missing configuration, password-change revocation, mode isolation, throttle, logout and no Control Room requests');
}finally{globalThis.fetch=original;}
