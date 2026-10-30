import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

// Run: node tests/account4-launch-guards.mjs
// Static regression checks only: NOT a penetration test or launch certification.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const worker=readFileSync(resolve(root,'control-room-worker.js'),'utf8');
const registry=JSON.parse(readFileSync(resolve(root,'config/heavenly-key-accounts.json'),'utf8'));
const checks=[
 ['owner review path',/request_owner_review/.test(worker)&&/mcpReviewSession/.test(worker)],
 ['Waiting Room UI',/The Waiting Room/.test(worker)],
 ['protected source paths',/function protectSourcePath\(/.test(worker)],
 ['protected Worker deployments',/function protectWorker\(/.test(worker)],
 ['GitHub reviewed commit freshness',/expectedCommit\s*&&\s*head\.commit\s*!==\s*expectedCommit/.test(worker)],
 ['operation lock',/function withOperationLock\(/.test(worker)],
 ['AI tool permissions',/function checkAIToolPermission\(/.test(worker)],
 ['AI policy',/function aiPolicy\(/.test(worker)],
 ['server-side authentication guard',/ADMIN_USER\s*\|\|\s*!env\.ADMIN_PASS/.test(worker)],
 ['GitHub proposal staging',/function coreProposeGithub\(/.test(worker)],
 ['account registry 1–10',Array.isArray(registry.accounts)&&[1,2,3,4,5,6,7,8,9,10].every(n=>registry.accounts.some(a=>a.account===n))]
];
let failures=0;
for(const [name,ok] of checks){console.log((ok?'PASS':'FAIL')+' '+name);if(!ok)failures++;}
assert.equal(failures,0,failures+' launch guard(s) absent');
console.log('Static guards present. Live authorization, deployment, D1/R2, browser and security tests still required.');
