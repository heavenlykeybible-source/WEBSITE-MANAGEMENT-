// Account 4 project-import validation. Pure module: no credentials, network or writes.
const MAX_FILES = 2000;
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const FORBIDDEN = /(^|\/)(\.env(?:\..*)?|\.git|node_modules|\.wrangler|\.dev\.vars(?:\..*)?|credentials?\.json|.*\.pem|.*\.key)(\/|$)/i;
const SAFE_PATH = /^[a-zA-Z0-9_.@+() -]+(?:\/[a-zA-Z0-9_.@+() -]+)*$/;
export function validateProjectManifest(input) {
  if (!input || typeof input !== 'object') throw Error('Invalid project manifest');
  const { repository, revision, projectPath, target, files } = input;
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository || '')) throw Error('Repository must be owner/name');
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw Error('Import must pin a 40-character Git commit SHA');
  if (!projectPath || !SAFE_PATH.test(projectPath) || projectPath.split('/').some(p => p === '.' || p === '..')) throw Error('Unsafe project path');
  if (!target || typeof target !== 'object' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(target.worker || '')) throw Error('Invalid target Worker');
  if (!Number.isSafeInteger(target.connectionId) || target.connectionId < 1) throw Error('Explicit Cloudflare connection required');
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) throw Error('Invalid file count');
  const seen = new Set(); let total = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !SAFE_PATH.test(file.path) ||
      file.path.split('/').some(p => p === '.' || p === '..') ||
      FORBIDDEN.test(file.path) || file.path.startsWith('/')) throw Error('Unsafe file path');
    if (seen.has(file.path.toLowerCase())) throw Error('Duplicate file path');
    seen.add(file.path.toLowerCase());
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > MAX_FILE_BYTES) throw Error('Invalid file size');
    if (!/^[a-f0-9]{64}$/.test(file.sha256 || '')) throw Error('File SHA-256 required');
    total += file.bytes;
    if (total > MAX_TOTAL_BYTES) throw Error('Project exceeds import limit');
  }
  return Object.freeze({repository, revision, projectPath, target: Object.freeze({...target}), fileCount:files.length, totalBytes:total, files:Object.freeze(files.map(f=>Object.freeze({path:f.path,bytes:f.bytes,sha256:f.sha256})))});
}
export function requireProjectReleaseApproval({manifest, review, owner, currentRevision, connectionId}) {
  if (!manifest || !review || !owner || review.status !== 'approved' ||
      review.ownerId !== owner.id || !review.reviewTokenVerified ||
      !review.passwordReauthenticated || !review.baselineVerified ||
      review.manifestHash !== review.approvedManifestHash ||
      manifest.revision !== currentRevision || manifest.target.connectionId !== connectionId)
    throw Error('Owner approval, pinned source, or target verification missing');
  return true;
}
