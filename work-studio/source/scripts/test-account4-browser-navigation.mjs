import test from 'node:test';
import assert from 'node:assert/strict';
const {default:worker}=await import('file:///tmp/account4-reviewed.mjs');
const origin='https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev';
const env={
 GITHUB_CONTROL_TOKEN:'test-only-secret-not-real',
 CONTROL_PASSWORD_HASH:'0'.repeat(64),
 DB:{prepare(){return {bind(){return {async first(){return null}}}}}},
 RECOVERY_STATE:{async get(){return null}}
};
async function visit(path,headers={}){return worker.fetch(new Request(origin+path,{headers}),env,{});}
test('new-device normal homepage displays secure login',async()=>{
 const r=await visit('/');
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/text\/html/);
 const html=await r.text();
 assert.match(html,/name="username"/);
 assert.match(html,/autocomplete="current-password"/);
});
test('new-device direct API navigation redirects to sign-in',async()=>{
 const r=await visit('/api/status',{'Accept':'text/html,application/xhtml+xml'});
 assert.equal(r.status,303);
 assert.equal(r.headers.get('location'),'/');
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('browser fetch and authorized integration clients still receive JSON 401',async()=>{
 for(const headers of [{Accept:'application/json'},{Accept:'*/*'},{'Sec-Fetch-Mode':'cors'}]){
  const r=await visit('/api/status',headers);
  assert.equal(r.status,401);
  assert.match(r.headers.get('content-type'),/application\/json/);
  const v=await r.json();
  assert.match(v.error,/Administrator login required/);
  assert.equal(v.loginUrl,'/');
 }
});
test('human-friendly direct login address opens the form',async()=>{
 const r=await visit('/login');
 assert.equal(r.status,200);
 assert.match(await r.text(),/Administrator sign-in/);
});
