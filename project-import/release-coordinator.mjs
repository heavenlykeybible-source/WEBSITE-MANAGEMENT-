/**
 * Account 4 complete release coordinator.
 * Dependency-injected adapters must be implemented by the authenticated
 * Control Room server and trusted build runner; never accept client-supplied
 * build, scan, preview or approval booleans.
 */
import {queueCompleteRelease} from './complete-release-intake.mjs';
export function createReleaseCoordinator({authorize,scan,build,preview,enqueueWaiting,loadProposal,verifyApproval,deploy,verifyLive,rollback,audit,acquireReleaseLock}){
 const deps=[authorize,scan,build,preview,enqueueWaiting,loadProposal,verifyApproval,deploy,verifyLive,rollback,audit,acquireReleaseLock];
 if(deps.some(x=>typeof x!=='function'))throw Error('All trusted release services required');
 async function submit({actor,source,target,connectedAccounts}){
  if(!actor)throw Error('Authentication required');
  if(await authorize({actor,action:'complete-release-submit',target})!==true)throw Error('Permission denied');
  const inspection=await scan({actor,source});
  if(inspection?.passed!==true||!inspection.immutableDigest||inspection.unsafeFiles!==0)throw Error('Project scan failed');
  const built=await build({actor,source,inspection});
  if(built?.verified!==true||!built.artifactDigest||built.sourceDigest!==inspection.immutableDigest)throw Error('Complete build verification failed');
  const staged=await preview({actor,target,built});
  if(staged?.verified!==true||!staged.url)throw Error('Preview verification failed');
  const queued=await queueCompleteRelease({actor,source,target,connectedAccounts,authorize,enqueueWaiting:async proposal=>
    enqueueWaiting({...proposal,inspection:{digest:inspection.immutableDigest,fileCount:inspection.fileCount},
      build:{digest:built.artifactDigest,sourceDigest:built.sourceDigest},preview:{url:staged.url,verified:true},
      buildVerified:true,previewVerified:true})});
  await audit({event:'complete-release-submitted',actor,proposalId:queued.proposalId});
  return {...queued,previewUrl:staged.url};
 }
 async function release({actor,proposalId}){
  if(typeof proposalId!=='string'||!proposalId)throw Error('Proposal required');
  const proposal=await loadProposal({actor,proposalId});
  if(proposal?.id!==proposalId||proposal.status!=='approved'||proposal.kind!=='complete-project-release'||
   proposal.buildVerified!==true||proposal.previewVerified!==true||!proposal.build?.digest)
   throw Error('Approved, verified complete application required');
  if(await authorize({actor,action:'complete-release-deploy',target:proposal.target,proposalId})!==true ||
    await verifyApproval({actor,proposal})!==true)throw Error('Owner release approval required');
  const releaseLock=await acquireReleaseLock({actor,proposalId,target:proposal.target});
  if(!releaseLock || typeof releaseLock.release!=='function')throw Error('Exclusive deployment lock unavailable');
  let result,deployAttempted=false;
  try{
   deployAttempted=true;
   result=await deploy({actor,proposal,artifactDigest:proposal.build.digest});
   if(result?.deployed!==true||await verifyLive({actor,proposal,result})!==true)
    throw Error('Live release verification failed');
  }catch(error){
   if(deployAttempted){
    try{await rollback({actor,proposal,result:result||null});}
    catch(rollbackError){await audit({event:'complete-release-rollback-failed',actor,proposalId});
      throw new AggregateError([error,rollbackError],'Deployment failed and rollback requires owner attention');}
   }
   await audit({event:'complete-release-failed',actor,proposalId});
   throw error;
  }finally{await releaseLock.release();}
  await audit({event:'complete-release-verified',actor,proposalId});
  return {proposalId,status:'verified-live'};
 }
 return {submit,release};
}
