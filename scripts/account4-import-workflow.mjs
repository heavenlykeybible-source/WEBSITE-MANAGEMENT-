import {beginPrivateImport} from './account4-r2-multipart.mjs';
import {saveImportSession} from './account4-import-d1.mjs';

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
