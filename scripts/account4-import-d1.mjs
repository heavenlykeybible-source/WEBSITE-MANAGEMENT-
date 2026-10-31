import {validateImportMetadata} from './account4-upload-policy.mjs';
// D1 persistence for private multipart uploads. Not connected to production routes.
// Only server-verified authentication may supply actor.id and actor.canImport.
function authorized(actor) {
  if (!actor?.authenticated || actor.canImport !== true || !Number.isSafeInteger(actor.id) || actor.id <= 0)
    throw new Error('Import permission required');
}
export async function saveImportSession(db, actor, session) {
  authorized(actor);
  if (!session || typeof session !== 'object') throw new Error('Invalid import session');
  // Recheck the original upload policy at the persistence boundary; callers
  // cannot bypass filename and size validation by writing directly to D1.
  validateImportMetadata({name:session.name,size:session.size},actor);
  if (session.ownerId !== actor.id || session.state !== 'uploading' ||
      typeof session.name !== 'string' || !session.name ||
      !Number.isSafeInteger(session.size) || session.size < 1 || session.size > 1073741824 ||
      !Number.isSafeInteger(session.partCount) ||
      session.partCount !== Math.ceil(session.size / (10 * 1024 * 1024)) ||
      typeof session.key !== 'string' ||
      !new RegExp(`^private-imports/${actor.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, 'i').test(session.key) ||
      typeof session.uploadId !== 'string' || !session.uploadId ||
      !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= Date.now())
    throw new Error('Invalid import owner or state');
  const id = crypto.randomUUID();
  const result = await db.prepare('INSERT INTO account4_import_sessions (id,owner_id,object_key,upload_id,filename,size_bytes,part_count,state,expires_at_ms) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id,actor.id,session.key,session.uploadId,session.name,session.size,session.partCount,'uploading',session.expiresAt).run();
  if (result?.success === false || result?.meta?.changes !== 1)
    throw new Error('Import session was not persisted');
  return id;
}
export async function loadImportSession(db, actor, id) {
  authorized(actor);
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error('Invalid import session identifier');
  const row = await db.prepare('SELECT * FROM account4_import_sessions WHERE id=? AND owner_id=?')
    .bind(id,actor.id).first();
  if (!row || row.owner_id !== actor.id || row.state !== 'uploading' ||
      row.expires_at_ms <= Date.now() ||
      !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 1 ||
      row.size_bytes > 1073741824 ||
      !Number.isSafeInteger(row.part_count) ||
      row.part_count !== Math.ceil(row.size_bytes / (10 * 1024 * 1024)) ||
      typeof row.upload_id !== 'string' || !row.upload_id ||
      typeof row.object_key !== 'string' ||
      !new RegExp(`^private-imports/${actor.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, 'i').test(row.object_key))
    throw new Error('Import session unavailable');
  const {results} = await db.prepare('SELECT part_number,etag FROM account4_import_parts WHERE session_id=? ORDER BY part_number')
    .bind(id).all();
  if (!Array.isArray(results) || results.length > row.part_count ||
      results.some(p => !Number.isSafeInteger(p?.part_number) ||
        p.part_number < 1 || p.part_number > row.part_count ||
        typeof p.etag !== 'string' || !/^[a-zA-Z0-9"-]{1,128}$/.test(p.etag)) ||
      new Set(results.map(p => p.part_number)).size !== results.length)
    throw new Error('Invalid persisted upload receipts');
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
    'INSERT INTO account4_import_parts(session_id,part_number,etag) SELECT id,?,? FROM account4_import_sessions WHERE id=? AND owner_id=? AND state=? AND expires_at_ms>? AND 1=1 ON CONFLICT(session_id,part_number) DO UPDATE SET etag=excluded.etag WHERE EXISTS (SELECT 1 FROM account4_import_sessions s WHERE s.id=excluded.session_id AND s.owner_id=? AND s.state=? AND s.expires_at_ms>?)')
    .bind(receipt.partNumber,receipt.etag,id,actor.id,'uploading',Date.now(),actor.id,'uploading',Date.now()).run();
  if (result?.success === false || result?.meta?.changes !== 1) throw new Error('Part receipt was not persisted');
  return receipt;
}
export async function transitionImportSession(db, actor, id, fromState, toState) {
  authorized(actor);
  if (!((fromState === 'uploading' && ['completing','aborted'].includes(toState)) || (fromState === 'completing' && toState === 'private-awaiting-review')))
    throw new Error('Invalid import transition');
  const result = await db.prepare('UPDATE account4_import_sessions SET state=? WHERE id=? AND owner_id=? AND state=? AND expires_at_ms>? AND (? = ? OR (SELECT COUNT(*) FROM account4_import_parts p WHERE p.session_id=account4_import_sessions.id)=part_count AND (SELECT MIN(part_number) FROM account4_import_parts p WHERE p.session_id=account4_import_sessions.id)=1 AND (SELECT MAX(part_number) FROM account4_import_parts p WHERE p.session_id=account4_import_sessions.id)=part_count)')
    .bind(toState,id,actor.id,fromState,Date.now(),toState,'aborted').run();
  if (result?.success === false || result?.meta?.changes !== 1) throw new Error('Import session transition denied');
  return {id,state:toState};
}

// Atomic compare-and-swap: only one caller can claim an upload for completion.
export async function claimImportCompletion(db, actor, id) {
  return transitionImportSession(db, actor, id, 'uploading', 'completing');
}
