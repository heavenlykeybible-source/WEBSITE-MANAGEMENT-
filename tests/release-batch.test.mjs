import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatchReleaseIntake} from '../project-import/release-batch.mjs';
const revision='a'.repeat(40);
const project=siteId=>({siteId,revision});
const report={fileCount:400,hasPackage:true,hasWrangler:true,hasLockfile:true,hasFrontend:true};
test('single app enters owner Waiting Room, never deploys',async()=>{
 const q=createBatchReleaseIntake({inspect:async()=>report,propose:async()=>({proposalId:'p1',status:'pending',deploymentAuthorized:false}),audit:async()=>{}});
 const r=await q.stage({actor:'owner',projects:[project(1)]});
 assert.equal(r.complete,true);assert.equal(r.deployed,false);assert.equal(r.queued.length,1);
});
test('all accounts queue separately',async()=>{
 let i=0;const q=createBatchReleaseIntake({inspect:async()=>report,propose:async()=>({proposalId:'p'+ ++i,status:'pending',deploymentAuthorized:false}),audit:async()=>{}});
 const r=await q.stage({actor:'owner',projects:[project(1),project(2),project(3)],mode:'all-accounts'});
 assert.deepEqual(r.queued.map(x=>x.proposalId),['p1','p2','p3']);
});
test('reject incomplete account before submitting any proposals',async()=>{
 let calls=0;const q=createBatchReleaseIntake({inspect:async({siteId})=>siteId===2?{...report,hasLockfile:false}:report,propose:async()=>{calls++;return {}},audit:async()=>{}});
 await assert.rejects(q.stage({actor:'owner',projects:[project(1),project(2)],mode:'account'}));assert.equal(calls,0);
});
test('reports partial enqueue without claiming full success',async()=>{
 let i=0;const q=createBatchReleaseIntake({inspect:async()=>report,propose:async()=>{if(++i===2)throw Error('queue unavailable');return {proposalId:'p1',status:'pending',deploymentAuthorized:false}},audit:async()=>{}});
 const r=await q.stage({actor:'owner',projects:[project(1),project(2)],mode:'all-accounts'});
 assert.equal(r.complete,false);assert.equal(r.queued.length,1);assert.equal(r.failedSiteId,2);
});
