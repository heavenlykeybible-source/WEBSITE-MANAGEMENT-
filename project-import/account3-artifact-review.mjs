/**
 * Verifies a GitHub Actions build artifact before it may be submitted to the
 * Control Room Waiting Room. This module never publishes or approves a release.
 */
export function verifyAccount3Artifact({run,artifact,expectedRevision}) {
  const accountId='cd095c096c2d5a42501e7d77cecbb34c';
  if (!/^[a-f0-9]{40}$/.test(expectedRevision||'')) throw Error('Pinned commit required');
  if (run?.status!=='completed'||run?.conclusion!=='success'||run?.head_sha!==expectedRevision)
    throw Error('Successful build for exact revision required');
  if (run?.path!=='.github/workflows/build-account3-review.yml')
    throw Error('Unexpected build workflow');
  if (artifact?.expired || artifact?.workflow_run?.head_sha!==expectedRevision ||
    artifact?.workflow_run?.id!==run.id ||
    artifact?.name!==`account3-review-${expectedRevision}` ||
    !/^sha256:[a-f0-9]{64}$/.test(artifact?.digest||''))
    throw Error('Verified build artifact required');
  return Object.freeze({
    repository:'heavenlykeybible-source/onlinebible',revision:expectedRevision,
    projectPath:'global-community',accountId,worker:'heavenly-key-global-community',
    artifactId:artifact.id,artifactDigest:artifact.digest,runId:run.id
  });
}

export async function enqueueVerifiedAccount3Artifact({
  actor,run,artifact,expectedRevision,connectionId,authorize,enqueueWaiting
}) {
  const build=verifyAccount3Artifact({run,artifact,expectedRevision});
  if (!actor || !Number.isSafeInteger(connectionId)||connectionId<1)
    throw Error('Authenticated actor and destination required');
  if (typeof authorize!=='function'||typeof enqueueWaiting!=='function')
    throw Error('Authorized Waiting Room services required');
  const target={accountId:build.accountId,connectionId,worker:build.worker};
  if (await authorize({actor,action:'account3-reviewed-artifact',target,build})!==true)
    throw Error('Owner review intake permission denied');
  const proposal=await enqueueWaiting({
    kind:'verified-build-artifact',status:'pending',actor,target,build,
    buildVerified:true,previewVerified:false,requiresOwnerApproval:true,
    deploymentAuthorized:false
  });
  if (!proposal?.id) throw Error('Waiting Room did not confirm proposal');
  return {proposalId:proposal.id,status:'pending',deploymentAuthorized:false};
}
