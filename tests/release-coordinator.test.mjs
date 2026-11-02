import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseCoordinator} from '../project-import/release-coordinator.mjs';
const accountId='a'.repeat(32);
const source={type:'github',kind:'application',reference:'org/repo/app',revision:'b'.repeat(40)};
const target={accountId,worker:'community'};
const connectedAccounts=[{accountId,connectionId:3,connected:true}];
function setup(){
 let proposal,approved=false,deployed=false;
 const coordinator=createReleaseCoordinator({
  authorize:async()=>true,
  scan:async()=>({passed:true,unsafeFiles:0,immutableDigest:'digest',fileCount:50}),
  build:async()=>({verified:true,artifactDigest:'artifact',sourceDigest:'digest'}),
  preview:async()=>({verified:true,url:'https://preview.example.test'}),
  enqueueWaiting:async p=>{proposal={...p,id:'proposal-1'};return {id:'proposal-1'}},
  loadProposal:async()=>({...proposal,status:approved?'approved':'pending'}),
  verifyApproval:async()=>approved,
  deploy:async()=>{deployed=true;return {deployed:true}},
  verifyLive:async()=>true,
  rollback:async()=>{},
  audit:async()=>{}
 });
 return {coordinator,approve:()=>{approved=true},deployed:()=>deployed};
}
test('full app enters Waiting Room without auto-deploy',async()=>{
 const t=setup();
 const result=await t.coordinator.submit({actor:'owner',source,target,connectedAccounts});
 assert.equal(result.status,'pending');assert.equal(t.deployed(),false);
 await assert.rejects(t.coordinator.release({actor:'owner',proposalId:result.proposalId}));
 t.approve();
 assert.equal((await t.coordinator.release({actor:'owner',proposalId:result.proposalId})).status,'verified-live');
});
test('untrusted scan blocks import',async()=>{
 const t=createReleaseCoordinator({
  authorize:async()=>true,scan:async()=>({passed:false}),build:async()=>{},preview:async()=>{},
  enqueueWaiting:async()=>{},loadProposal:async()=>{},verifyApproval:async()=>false,
  deploy:async()=>{},verifyLive:async()=>false,rollback:async()=>{},audit:async()=>{}
 });
 await assert.rejects(t.submit({actor:'owner',source,target,connectedAccounts}));
});
