import './resolve-ts.mjs';
import assert from 'node:assert/strict';
const {studioAuthRoute,studioOwner}=await import('../src/studio-auth.ts');
const values=new Map(),env={STUDIO_AUTH_MODE:'account2',ADMIN_USERNAME:'same-owner',ADMIN_PASSWORD:'existing-test-password',CONTROL_ROOM_URL:'https://controlroom.heavenlykey.org',STUDIO_SSO_SECRET:'test-only-secret-at-least-32-characters',LIVE_STATUS_KV:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v)}};
assert.deepEqual(await(await studioAuthRoute(new Request('https://studioroom.heavenlykey.org/auth/options'),env)).json(),{controlRoom:true,directAccount2:true});
const start=await studioAuthRoute(new Request('https://studioroom.heavenlykey.org/auth/start'),env),target=new URL(start.headers.get('location')),state=target.searchParams.get('state');assert.equal(target.origin,env.CONTROL_ROOM_URL);assert.match(state,/^[a-f0-9]{64}$/);
const original=globalThis.fetch;try{globalThis.fetch=async(url,init)=>{assert.equal(url,env.CONTROL_ROOM_URL+'/api/studio/redeem');assert.equal(init.headers.authorization,'Bearer '+env.STUDIO_SSO_SECRET);return Response.json({sub:'control-room:1',name:'same-owner',role:'Super Administrator'});};
const r=await studioAuthRoute(new Request('https://studioroom.heavenlykey.org/auth/callback?state='+state+'&code='+'a'.repeat(64),{headers:{cookie:start.headers.get('set-cookie').split(';')[0]}}),env);assert.equal(r.status,303);
const cookie=r.headers.getSetCookie().find(x=>x.startsWith('__Host-hk-studio=')).split(';')[0];assert.equal((await studioOwner(new Request('https://studioroom.heavenlykey.org/',{headers:{cookie}}),env)).sub,'control-room:1');
assert.equal(await studioOwner(new Request('https://studioroom.heavenlykey.org/',{headers:{cookie}}),{...env,STUDIO_SSO_SECRET:''}),null);
}finally{globalThis.fetch=original;}
console.log('PASS local Studio password and Control Room SSO coexist, correct identity/session, missing link denied');
