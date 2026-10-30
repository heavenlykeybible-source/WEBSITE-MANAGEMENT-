import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const ownerStart=s.indexOf('async function ownerApiUnlocked('),ownerEnd=s.indexOf('// ---------- WordPress and Blogger connections',ownerStart);
assert.ok(ownerStart>=0&&ownerEnd>ownerStart,'Owner AI API route missing');
const owner=s.slice(ownerStart,ownerEnd);
for(const [label,needle] of [
 ['dedicated Claude diagnostic route',"'ai/secret-test' && m === 'POST'"],
 ['owner-only restriction',"user.role!=='owner'||user.kind==='member'||sc.ow"],
 ['protected API key through existing resolver',"aiResolve(env,'secret',null)"],
 ['test connection only',"await aiTest(await aiResolve(env,'secret',null))"],
 ['server latency measurement','latency_ms:Date.now()-started']
])assert.ok(owner.includes(needle),'Missing '+label);
const aiStart=s.indexOf('async function aiAccounts()'),aiEnd=s.indexOf('function frame(html)',aiStart),ui=s.slice(aiStart,aiEnd);
assert.ok(ui.includes("'Test built-in Claude'"),'Secret-backed Claude needs a test button');
assert.ok(ui.includes("a.id==='secret'?'ai/secret-test':'ai/accounts/'+a.id+'/test'"),'Test-all must include secret-backed Claude');
assert.ok(ui.includes("a.id==='secret';"),'Test-all must include secret-backed Claude provider ID');
assert.ok(!ui.includes('ANTHROPIC_API_KEY}'),'Never display protected Claude key');
console.log('PASS owner-only secret-backed Claude connectivity and test-all diagnostics');
