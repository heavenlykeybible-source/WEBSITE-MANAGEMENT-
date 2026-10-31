import {validateImportMetadata, validatePart} from './account4-upload-policy.mjs';

// Storage adapter only. Caller must authenticate every request and load the
// session from a durable owner-scoped database before invoking these functions.
// Objects remain private in R2; completion never publishes or deploys them.
function requireSession(session, actor) {
  if (actor?.authenticated !== true || actor.canImport !== true ||
      !Number.isSafeInteger(actor.id) || actor.id <= 0 ||
      !session || session.ownerId !== actor.id ||
      session.state !== 'uploading' || !Number.isFinite(session.expiresAt) ||
      Date.now() >= session.expiresAt ||
      typeof session.key !== 'string' ||
      !session.key.startsWith(`private-imports/${encodeURIComponent(String(actor.id))}/`) ||
      typeof session.uploadId !== 'string' || !session.uploadId)
    throw new Error('Upload permission or session invalid');
  return session;
}
export async function beginPrivateImport(bucket, actor, file) {
  if (actor?.authenticated !== true || actor.canImport !== true ||
      !Number.isSafeInteger(actor.id) || actor.id <= 0)
    throw new Error('Authenticated import permission required');
  const meta = validateImportMetadata(file, actor);
  const key = `private-imports/${encodeURIComponent(String(actor.id))}/${crypto.randomUUID()}`;
  const upload = await bucket.createMultipartUpload(key);
  return {
    ownerId: actor.id, key, uploadId: upload.uploadId,
    name: meta.name, size: meta.size, partCount: meta.partCount,
    state: 'uploading', expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    parts: {}
  };
}
export async function uploadPrivatePart(bucket, actor, session, number, bytes) {
  requireSession(session, actor);
  if (!(bytes instanceof Uint8Array)) throw new Error('Binary chunk required');
  validatePart({partNumber:number,byteLength:bytes.byteLength},session);
  const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
  const part = await upload.uploadPart(number, bytes);
  // Persist this receipt to D1 before acknowledging the chunk to the client.
  return {partNumber: part.partNumber, etag: part.etag};
}
export async function completePrivateImport(bucket, actor, session, parts) {
  requireSession(session, actor);
  if (!Array.isArray(parts) || parts.length !== session.partCount)
    throw new Error('Every part must be supplied');
  const seen = new Set();
  for (const p of parts) {
    if (!p || !Number.isSafeInteger(p.partNumber) ||
        p.partNumber < 1 || p.partNumber > session.partCount ||
        seen.has(p.partNumber) ||
        typeof p.etag !== 'string' || !/^[a-zA-Z0-9\"-]{1,128}$/.test(p.etag))
      throw new Error('Invalid or duplicate completed part');
    seen.add(p.partNumber);
  }
  const ordered = [...parts].sort((a,b)=>a.partNumber-b.partNumber);
  // A durable server-side session must record the ETag for every uploaded part.
  // Never accept completion metadata solely because the browser submitted it.
  if (!session.parts || typeof session.parts !== 'object' ||
      ordered.some(p => session.parts[p.partNumber] !== p.etag))
    throw new Error('Part receipt does not match server-side upload record');
  const result = await bucket.resumeMultipartUpload(session.key,session.uploadId).complete(ordered);
  if (result.size !== session.size) {
    // A completed object with the wrong size must not be retained as an import.
    await bucket.delete(session.key);
    throw new Error('Completed object size mismatch');
  }
  return {key:session.key,size:result.size,state:'private-awaiting-review'};
}
export async function abortPrivateImport(bucket, actor, session) {
  requireSession(session,actor);
  await bucket.resumeMultipartUpload(session.key,session.uploadId).abort();
  return {state:'aborted'};
}
