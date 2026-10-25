import assert from 'node:assert/strict';
import fs from 'node:fs';
const code=fs.readFileSync('heavenly-key-accounts/account-07-unverified/scripts/preflight.mjs','utf8');
const run=new (Object.getPrototypeOf(async()=>{}).constructor)('fetch','process','console',code);
for(const namespace of ['meeting-space','heavenlykeyradio']){
 const calls=[];const fetch=async url=>{calls.push(url);return Response.json({success:true,result:url.endsWith('/subdomain')?{subdomain:namespace}:{bindings:[]}})};
 const execution=run(fetch,{env:{CLOUDFLARE_API_TOKEN:'test-only',CLOUDFLARE_ACCOUNT_ID:'test-account'}},{log(){}});
 if(namespace==='heavenlykeyradio'){await execution;assert.equal(calls.length,2)}else{await assert.rejects(execution,/identity could not be verified/);assert.equal(calls.length,1)}
}
console.log('PASS Radio preflight verifies the physical namespace and rejects the wrong account before inspecting Worker settings.');
