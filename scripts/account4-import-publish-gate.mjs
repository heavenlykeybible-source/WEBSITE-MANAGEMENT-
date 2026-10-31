// Staging-only guard for a FUTURE publication pipeline. No scanner or route wired.
// A database row is not a scanner: only a trusted backend scanner integration
// may write the attestation; owner approval must come from a separate workflow.
export async function assertPrivateImportPublishable(db, actor, id) {
  if (actor?.authenticated !== true || actor?.canPublish !== true ||
      !Number.isSafeInteger(actor.id) || actor.id < 1)
    throw new Error('Publication permission required');
  if (typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error('Invalid import identifier');
  const row = await db.prepare(
    'SELECT s.owner_id,s.state,s.object_key,s.size_bytes,a.verdict,a.object_key AS scanned_key,a.size_bytes AS scanned_size,a.approved_by,a.approved_at,a.scanned_at FROM account4_import_sessions s LEFT JOIN account4_import_release_attestations a ON a.session_id=s.id WHERE s.id=? AND s.owner_id=?'
  ).bind(id,actor.id).first();
  // No release on missing rows, failed/unknown scans, modified objects,
  // missing approval, or approval by the importing owner.
  if (!row || row.owner_id !== actor.id ||
      row.state !== 'private-awaiting-review' ||
      !new RegExp('^private-imports/' + actor.id +
        '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$','i').test(row.object_key || '') ||
      row.verdict !== 'clean' ||
      row.scanned_key !== row.object_key ||
      !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 1 ||
      row.scanned_size !== row.size_bytes ||
      !Number.isSafeInteger(row.approved_by) || row.approved_by < 1 ||
      row.approved_by === row.owner_id ||
      typeof row.scanned_at !== 'string' || !row.scanned_at ||
      typeof row.approved_at !== 'string' || !row.approved_at)
    throw new Error('Private import not cleared for publication');
  return Object.freeze({id, state:'cleared-for-publication'});
}
