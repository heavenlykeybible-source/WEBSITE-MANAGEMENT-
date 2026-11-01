import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCOUNT3_RELEASE,requestAccount3BuildReview} from '../project-import/account3-reviewed-build.mjs';

const revision='a'.repeat(40);
test('Account 3 reviewed build is pinned and cannot deploy',async()=>{
  let queued;
  const result=await requestAccount3BuildReview({
    actor:'owner',revision,connectionId:3,
    authorize:async x=>x.action==='account3-build-review'&&x.target.worker===ACCOUNT3_RELEASE.worker,
    enqueueWaiting:async x=>{queued=x;return {id:'review-1'}}
  });
  assert.equal(result.status,'pending');
  assert.equal(queued.source.projectPath,'global-community');
  assert.equal(queued.workflow,'deploy-account3-global-community.yml');
  assert.equal(queued.target.accountId,'cd095c096c2d5a42501e7d77cecbb34c');
  assert.equal(queued.deploymentAuthorized,false);
  assert.equal(queued.buildVerified,false);
});
test('Account 3 request rejects denied permission, invalid revisions, and missing queue',async()=>{
  const base={actor:'owner',revision,connectionId:3,authorize:async()=>true,enqueueWaiting:async()=>({id:'x'})};
  await assert.rejects(requestAccount3BuildReview({...base,revision:'main'}));
  await assert.rejects(requestAccount3BuildReview({...base,authorize:async()=>false}));
  await assert.rejects(requestAccount3BuildReview({...base,enqueueWaiting:async()=>null}));
});
