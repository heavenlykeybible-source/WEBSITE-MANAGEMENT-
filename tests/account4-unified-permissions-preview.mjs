import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
for(const [feature,fragment] of [
 ['central account connection picker',"'Choose Cloudflare account to check'"],
 ['saved connection test',"'Check selected connection'"],
 ['connection check API',"'connections/'+connectionPicker.value+'/check'"],
 ['interactive isolated HTML preview',"'Interactive proposed website preview (isolated sandbox)'"],
 ['preview does not share authentication', "sandbox:'allow-scripts allow-forms'"],
 ['owner review remains required',"'Approve this version'"]
])assert.ok(s.includes(fragment),'Missing '+feature);
const verifyStart=s.indexOf('async function requestProviderVerification(');
const verifyEnd=s.indexOf('async function providerVerificationRoutes(',verifyStart);
assert.ok(verifyStart>=0 && verifyEnd>verifyStart,'Provider verification flow must exist');
const verify=s.slice(verifyStart,verifyEnd);
assert.ok(verify.indexOf('connection_verified:true') < verify.indexOf("'workspace:verification:'"),'Cloudflare API check must precede creation of any provider verification request');
assert.ok(s.includes('connection_verified:true') && s.includes('connection_verified:false'),'Saved Cloudflare verification must return explicit success or failure');
assert.ok(s.includes('Update the token scopes in Account 4 Connections'),'Failed API access must direct owner to saved token settings');
assert.ok(!s.includes("sandbox:'allow-scripts allow-same-origin'"),'HTML preview must not share authenticated origin');
console.log('PASS Account 4 unified connection check and isolated interactive preview');
