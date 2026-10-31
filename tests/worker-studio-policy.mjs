import assert from 'node:assert/strict';
import {workerStudioRevision,assertUnchangedWorkerBaseline,workerStudioPreviewPolicy} from '../workspace/worker-studio-policy.js';
const sha='a'.repeat(64);
const input={connection:4,worker:'global-community',source:'export default {fetch(){return new Response("ok")}}',base_sha256:sha,module_count:1};
const draft=workerStudioRevision(input);
assert.equal(draft.phase,'draft');assert.equal(draft.publication,'owner-only');
assert.equal(draft.connection,4);assert.equal(draft.worker,'global-community');
assert.equal(assertUnchangedWorkerBaseline(draft,sha),true);
assert.throws(()=>assertUnchangedWorkerBaseline(draft,'b'.repeat(64)),/changed since inspection/);
for(const bad of [
 {...input,connection:0},{...input,worker:'../../admin'}, {...input,source:''},
 {...input,base_sha256:'missing'}, {...input,module_count:2},
 {...input,publish:true},{...input,approval:'yes'}
])assert.throws(()=>workerStudioRevision(bad));
assert.deepEqual(workerStudioPreviewPolicy({isolated_environment:true,private_access:true,no_automatic_publication:true}),{preview:'isolated',access:'private',production_traffic:false});
for(const bad of [
 {isolated_environment:true,private_access:true,no_automatic_publication:true,uses_production_bindings:true},
 {private_access:true,no_automatic_publication:true},
 {isolated_environment:true,no_automatic_publication:true},
 {isolated_environment:true,private_access:true}
])assert.throws(()=>workerStudioPreviewPolicy(bad));
console.log('PASS Worker Studio: exact account and Worker, baseline conflicts, single-module limit, no AI publication, private isolated preview only');
