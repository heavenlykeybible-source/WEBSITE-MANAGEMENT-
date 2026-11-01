/**
 * Shared Control Room release intake: full apps, Workers, websites and archives.
 * Queue-only: build, preview, approval and deploy are separate trusted services.
 * No arbitrary number-of-projects cap; provider quotas still apply.
 */
const KINDS=new Set(['website','worker','application','archive']);
const SOURCES=new Set(['github','upload','r2','google-drive','ai']);
export async function queueCompleteRelease({
  actor, source, target, connectedAccounts, authorize, enqueueWaiting
}) {
  if (!actor || typeof actor!=='string') throw Error('Authenticated actor required');
  if (!source || !SOURCES.has(source.type) || !KINDS.has(source.kind))
    throw Error('Supported source type and project kind required');
  if (!source.reference || typeof source.reference!=='string' || source.reference.length>2048)
    throw Error('Immutable source reference required');
  if (source.type==='github' && (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_./-]+)?$/.test(source.reference) || source.reference.split('/').slice(2).some(p=>p==='..'||p==='.') || !/^[0-9a-f]{40}$/.test(source.revision||'')))
    throw Error('GitHub source must pin an exact commit');
  if (source.type==='ai' && (!source.agentId || !/^[a-f0-9]{64}$/i.test(source.sha256||''))) throw Error('AI package requires agent identity and immutable checksum');
  if (source.type==='google-drive' && (!source.revision || typeof source.revision!=='string')) throw Error('Drive file revision required');
  if (!target || typeof target.accountId!=='string' || !/^[0-9a-f]{32}$/.test(target.accountId))
    throw Error('Exact Cloudflare account ID required');
  if (!target.worker || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(target.worker))
    throw Error('Exact target Worker required');
  if (!Array.isArray(connectedAccounts)) throw Error('Account registry required');
  const matches=connectedAccounts.filter(a=>a?.connected===true &&
    a.accountId===target.accountId && Number.isSafeInteger(a.connectionId) && a.connectionId>0);
  if (matches.length!==1) throw Error('Exactly one verified destination connection required');
  if (typeof authorize!=='function'||typeof enqueueWaiting!=='function')
    throw Error('Authorized review services required');
  const destination={accountId:target.accountId,connectionId:matches[0].connectionId,worker:target.worker};
  if (await authorize({actor,action:'release-intake',source,target:destination})!==true)
    throw Error('Release intake permission denied');
  const proposal=await enqueueWaiting({
    kind:'complete-project-release',status:'pending',actor,
    source:{type:source.type,kind:source.kind,reference:source.reference,revision:source.revision||null,agentId:source.type==='ai'?source.agentId:null,sha256:source.type==='ai'?source.sha256:null},
    target:destination,buildRequired:true,buildVerified:false,previewVerified:false,
    requiresOwnerApproval:true,deploymentAuthorized:false,
    releasePolicy:{preserveBindings:true,preserveAssets:true,preventRollback:true,ownerApprovalRequired:true,verifyTargetAccount:true,verifyBuildArtifacts:true,verifyLiveHealth:true,rollbackOnFailure:true}
  });
  if (!proposal || typeof proposal.id!=='string'||!proposal.id.trim())
    throw Error('Waiting Room did not confirm release');
  return {proposalId:proposal.id,status:'pending',deploymentAuthorized:false};
}
