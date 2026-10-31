import {beginPrivateImport, uploadPrivatePart} from './account4-r2-multipart.mjs';
import {saveImportSession, loadImportSession, recordImportPart} from './account4-import-d1.mjs';

// Staging-only orchestration. Never exposes objects publicly or deploys code.
// The durable D1 record must exist before the session identifier is returned.
export async function startPersistedPrivateImport(bucket, db, actor, file) {
  const session = await beginPrivateImport(bucket, actor, file);
  try {
    const id = await saveImportSession(db, actor, session);
    return {id, name:session.name, size:session.size, partCount:session.partCount,
      expiresAt:session.expiresAt, state:'uploading'};
  } catch (error) {
    // R2 multipart creation has already succeeded; prevent orphaned uploads.
    try {
      await bucket.resumeMultipartUpload(session.key, session.uploadId).abort();
    } catch (cleanupError) {
      // Surface both failures so operators can reconcile the orphaned upload.
      throw new AggregateError([error,cleanupError], 'D1 save and R2 cleanup failed');
    }
    throw error;
  }
}

// A chunk is acknowledged only after its R2 receipt is durably recorded in D1.
// The session is always reloaded with the authenticated owner's identity.
export async function uploadPersistedPrivatePart(bucket, db, actor, id, partNumber, bytes) {
  const session = await loadImportSession(db, actor, id);
  const receipt = await uploadPrivatePart(bucket, actor, session, partNumber, bytes);
  await recordImportPart(db, actor, id, receipt);
  return {partNumber:receipt.partNumber, stored:true};
}
