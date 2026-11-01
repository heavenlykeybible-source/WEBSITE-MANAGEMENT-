/**
 * Account 3 reviewed build release descriptor.
 * This module creates a non-deploying Waiting Room request for the complete
 * multi-file application. It MUST NOT publish or invoke GitHub Actions.
 */
export const ACCOUNT3_RELEASE = Object.freeze({
  repository: 'heavenlykeybible-source/onlinebible',
  projectPath: 'global-community',
  workflow: 'deploy-account3-global-community.yml',
  worker: 'heavenly-key-global-community',
  accountId: 'cd095c096c2d5a42501e7d77cecbb34c'
});

export async function requestAccount3BuildReview({
  actor, revision, connectionId, authorize, enqueueWaiting
}) {
  if (!actor || typeof actor !== 'string') throw Error('Authenticated owner required');
  if (!/^[0-9a-f]{40}$/.test(revision || '')) throw Error('Exact Git commit SHA required');
  if (!Number.isSafeInteger(connectionId) || connectionId < 1) throw Error('Account 3 connection required');
  if (typeof authorize !== 'function' || typeof enqueueWaiting !== 'function')
    throw Error('Authorization and Waiting Room integration required');
  const target = {connectionId, worker:ACCOUNT3_RELEASE.worker, accountId:ACCOUNT3_RELEASE.accountId};
  const allowed = await authorize({actor, action:'account3-build-review', revision, target});
  if (allowed !== true) throw Error('Account 3 build review permission denied');
  const proposal = await enqueueWaiting({
    kind:'reviewed-build-deployment', status:'pending', actor,
    source:{repository:ACCOUNT3_RELEASE.repository, revision, projectPath:ACCOUNT3_RELEASE.projectPath},
    workflow:ACCOUNT3_RELEASE.workflow, target,
    buildRequired:true, buildVerified:false, previewVerified:false,
    deploymentPlan:{type:'github-actions',workflow:ACCOUNT3_RELEASE.workflow,branch:'main',approvedRevision:revision,requiresBuildChecks:true,requiresOwnerReview:true},
    requiresOwnerApproval:true, deploymentAuthorized:false
  });
  if (!proposal || typeof proposal.id !== 'string' || !proposal.id.trim())
    throw Error('Waiting Room did not confirm proposal creation');
  return {proposalId:proposal.id, status:'pending', deploymentAuthorized:false};
}
