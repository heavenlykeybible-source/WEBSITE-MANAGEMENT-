import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLaunchReadiness} from '../src/launch-readiness.js';
test('production readiness is false when nothing is verified',()=>{
 const result=assessLaunchReadiness();
 assert.equal(result.ready,false);
 assert.equal(result.missing.length,9);
});
test('partial deployment never counts as production readiness',()=>{
 const result=assessLaunchReadiness({identityVerified:true,databaseMigrated:true,automatedTestsPassed:true});
 assert.equal(result.ready,false);
 assert.ok(result.missing.includes('stagingE2EPassed'));
 assert.ok(result.missing.includes('paymentWebhooksVerified'));
});
test('only independently verified complete checklist can pass',()=>{
 const keys=assessLaunchReadiness().missing;
 const all=Object.fromEntries(keys.map(key=>[key,true]));
 assert.deepEqual(assessLaunchReadiness(all),{ready:true,missing:[]});
 all.turnConfigured='yes';
 assert.equal(assessLaunchReadiness(all).ready,false);
});
