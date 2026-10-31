// D1 persistence for private multipart uploads. Not connected to production routes.
// Only server-verified authentication may supply actor.id and actor.canImport.
function authorized(actor) {
  if (!actor?.authenticated || actor.canImport !== true || !Number.isSafeInteger(actor.id))
    throw new Error('Import permission required');
}
export async function saveImportSession(db, actor, session) {
  authorized(actor);
  if (session.ownerId !== actor.id || session.state !== 'uploading')
    throw new Error('Invalid import owner or state');
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO account4_import_sessions (id,owner_id,object_key,upload_id,filename,size_bytes,part_count,state,expires_at_ms) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id,actor.id,session.key,session.uploadId,session.name,session.size,session.partCount,'uploading',session.expiresAt).run();
  return id;
}
export async function loadImportSession(db, actor, id) {
  authorized(actor);
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id))
    throw new Error('Invalid import session identifier');
  const row = await db.prepare('SELECT * FROM account4_import_sessions WHERE id=? AND owner_id=?')
    .bind(id,actor.id).first();
  if (!row || row.state !== 'uploading' || row.expires_at_ms <= Date.now())
    throw new Error('Import session unavailable');
  const {results} = await db.prepare('SELECT part_number,etag FROM account4_import_parts WHERE session_id=? ORDER BY part_number')
    .bind(id).all();
  return {
    id,ownerId:row.owner_id,key:row.object_key,uploadId:row.upload_id,
    name:row.filename,size:row.size_bytes,partCount:row.part_count,
    state:row.state,expiresAt:row.expires_at_ms,
    parts:Object.fromEntries(results.map(p=>[p.part_number,p.etag]))
  };
}
export async function recordImportPart(db, actor, id, receipt) {
  const session = await loadImportSession(db,actor,id);
  if (!Number.isSafeInteger(receipt?.partNumber) || receipt.partNumber < 1 ||
      receipt.partNumber > session.partCount || typeof receipt.etag !== 'string' ||
      !/^[a-zA-Z0-9"-]{1,128}$/.test(receipt.etag))
    throw new Error('Invalid R2 part receipt');
  // Atomic condition prevents recording a receipt for an expired/closed session.
  const result = await db.prepare(
    'INSERT INTO account4_import_parts(session_id,part_number,etag) SELECT id,?,? FROM account4_import_sessions WHERE id=? AND owner_id=? AND state=? AND expires_at_ms>? ON CONFLICT(session_id,part_number) DO UPDATE SET etag=excluded.etag')
    .bind(receipt.partNumber,receipt.etag,id,actor.id,'uploading',Date.now()).run();
  if (result.meta?.changes !== 1) throw new Error('Part receipt was not persisted');
  return receipt;
}
export async function transitionImportSession(db, actor, id, fromState, toState) {
  authorized(actor);
  if (fromState !== 'uploading' || !['private-awaiting-review','aborted'].includes(toState))
    throw new Error('Invalid import transition');
  const result = await db.prepare('UPDATE account4_import_sessions SET state=? WHERE id=? AND owner_id=? AND state=? AND expires_at_ms>?')
    .bind(toState,id,actor.id,fromState,Date.now()).run();
  if (result.meta?.changes !== 1) throw new Error('Import session transition denied');
  return {id,state:toState};
}
