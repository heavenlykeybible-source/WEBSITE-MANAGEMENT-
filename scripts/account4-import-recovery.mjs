// Operator-only reconciliation helper. Never publishes, retries completion, or deletes data.
export async function inspectPrivateImportRecovery(db, bucket, actor, id) {
  if (actor?.authenticated !== true || actor.canImport !== true ||
      !Number.isSafeInteger(actor.id) || actor.id <= 0)
    throw new Error('Import permission required');
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error('Invalid import identifier');
  const row = await db.prepare('SELECT owner_id,object_key,size_bytes,state,expires_at_ms FROM account4_import_sessions WHERE id=? AND owner_id=?')
    .bind(id,actor.id).first();
  if (!row || row.owner_id !== actor.id ||
      !['completing','private-awaiting-review'].includes(row.state) ||
      typeof row.object_key !== 'string' ||
      !new RegExp('^private-imports/' + actor.id + '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$','i').test(row.object_key))
    throw new Error('Private import recovery unavailable');
  const object = await bucket.head(row.object_key);
  const matchesExpectedSize = object !== null &&
    Number.isSafeInteger(row.size_bytes) && row.size_bytes > 0 &&
    object.size === row.size_bytes;
  return {id, state:row.state, objectPresent:object !== null,
    matchesExpectedSize, requiresOperatorReview:row.state === 'completing' || !matchesExpectedSize};
}
