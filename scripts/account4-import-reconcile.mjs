import {inspectPrivateImportRecovery} from './account4-import-recovery.mjs';

// Explicit owner-triggered recovery only. No automatic publish, no deletion.
// The object must exist and have the expected size before the database moves
// from 'completing' to 'private-awaiting-review'. Every release still requires
// malware scanning and separate explicit owner approval.
export async function reconcileCompletedPrivateImport(db, bucket, actor, id) {
  if (actor?.authenticated !== true || actor.role !== 'owner' ||
      actor.canImport !== true || !Number.isSafeInteger(actor.id) || actor.id < 1)
    throw new Error('Owner recovery authorization required');
  const inspection = await inspectPrivateImportRecovery(db, bucket, actor, id);
  if (inspection.state !== 'completing' || !inspection.objectPresent ||
      !inspection.matchesExpectedSize)
    throw new Error('Private import cannot be reconciled');
  const result = await db.prepare(
    "UPDATE account4_import_sessions SET state='private-awaiting-review' WHERE id=? AND owner_id=? AND state='completing' AND object_key=? AND size_bytes=?"
  ).bind(id,actor.id,'private-imports/' + actor.id + '/' + id,inspection.expectedSize).run();
  if (result?.success === false || result?.meta?.changes !== 1)
    throw new Error('Private import reconciliation failed');
  return {id,state:'private-awaiting-review',published:false,scanned:false};
}
