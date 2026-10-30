import {inspectGitHubProject} from './github-reader.mjs';
import {fetchVerifiedProjectFiles} from './blob-transfer.mjs';
import {createImmutableR2Store} from './r2-store.mjs';

/**
 * Server-only Account 4 GitHub -> immutable R2 -> Waiting Room adapter.
 * This is NOT an HTTP endpoint. Call only after Control Room authentication
 * and authorization, using a server-managed GitHub credential.
 * The enqueueWaiting callback MUST create a pending owner-review record,
 * never deploy or approve a release.
 */
export async function importProjectToWaiting({
  fetcher, githubToken, repository, revision, projectPath, target,
  bucket, actor, authorize, enqueueWaiting
}) {
  if (typeof authorize !== 'function' || typeof enqueueWaiting !== 'function')
    throw Error('Authenticated Control Room authorization and Waiting Room adapter required');
  if (!actor || typeof actor !== 'string') throw Error('Authenticated actor required');
  if (!target || !Number.isSafeInteger(target.connectionId))
    throw Error('Explicit target connection required');

  // Authorization must run BEFORE reading private repository contents.
  const grant = await authorize({actor, repository, revision, projectPath, target, action:'github-project-import'});
  if (grant !== true) throw Error('Project import permission denied');

  const inspection = await inspectGitHubProject({
    fetcher, token:githubToken, repository, revision, projectPath, target
  });
  const {manifest, storage} = await fetchVerifiedProjectFiles({
    fetcher, token:githubToken, inspection, store:createImmutableR2Store(bucket)
  });
  // Never pass GitHub credentials to the review queue.
  const proposal = await enqueueWaiting({
    kind:'github-project-import', status:'pending', actor, manifest, storage,
    requiresOwnerApproval:true, deploymentAuthorized:false
  });
  if (!proposal || typeof proposal.id !== 'string' || !proposal.id.trim())
    throw Error('Waiting Room did not confirm proposal creation');
  return {proposalId:proposal.id, status:'pending', fileCount:manifest.fileCount,
    totalBytes:manifest.totalBytes, revision:manifest.revision,
    requiresOwnerApproval:true};
}
