import test from 'node:test';
import assert from 'node:assert/strict';
import {queueCompleteRelease} from '../project-import/complete-release-intake.mjs';
const accountId='c'.repeat(32);
const base=()=>({
  actor:'owner',
  source:{type:'github',kind:'application',reference:'org/repo/global-community',revision:'a'.repeat(40)},
  target:{accountId,worker:'community'},
  connectedAccounts:[{accountId,connectionId:3,connected:true}],
  authorize:async()=>true,
  enqueueWaiting:async p=>({id:'pending-1'})
});
test('queues full application for owner review without deploying',async()=>{
  let proposal;const a=base();a.enqueueWaiting=async p=>{proposal=p;return {id:'pending-1'}};
  const result=await queueCompleteRelease(a);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(proposal.releasePolicy.preserveBindings,true);
  assert.equal(proposal.requiresOwnerApproval,true);
  assert.equal(proposal.target.connectionId,3);
});
test('supports uploaded archive review without GitHub',async()=>{
  const a=base();a.source={type:'upload',kind:'archive',reference:'r2://immutable/sha256-archive'};
  assert.equal((await queueCompleteRelease(a)).status,'pending');
});
test('rejects wrong account, unpinned git and denied permission',async()=>{
  const a=base();await assert.rejects(queueCompleteRelease({...a,target:{...a.target,accountId:'d'.repeat(32)}}));
  await assert.rejects(queueCompleteRelease({...a,source:{...a.source,revision:'main'}}));
  await assert.rejects(queueCompleteRelease({...a,authorize:async()=>false}));
});
