import type { Env as AuthEnv } from "./auth-service";

export interface StorageEnv extends AuthEnv {
  MEDIA_R2?: R2Bucket;
  MEDIA_R2_STAGING?: R2Bucket;
}

const RETENTION_HOURS = 48;
const MAX_CLEANUP_BATCH = 50;

function isoAfterHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function bucket(env: StorageEnv, name: string | null | undefined): R2Bucket | null {
  if (name === "MEDIA_R2_STAGING") return env.MEDIA_R2_STAGING ?? null;
  return env.MEDIA_R2 ?? null;
}

export function retentionUntil(hours = RETENTION_HOURS): string {
  return isoAfterHours(hours);
}

export async function uploadMediaObject(
  env: StorageEnv,
  mediaId: number,
  body: ReadableStream<Uint8Array> | null,
  contentType: string,
  contentLength: number,
): Promise<{ ok: boolean; storageKey?: string; reason?: string }> {
  if (!body) return { ok: false, reason: "Request body is required." };
  if (!Number.isFinite(contentLength) || contentLength <= 0) return { ok: false, reason: "A valid Content-Length is required." };
  const MAX_BYTES = 100 * 1024 * 1024;
  if (contentLength > MAX_BYTES) return { ok: false, reason: "Media file exceeds the 100 MB temporary upload limit." };

  const media = await env.DB.prepare(
    `SELECT media_id, file_type, storage_status, keep_media FROM media WHERE media_id = ?`
  ).bind(mediaId).first<any>();
  if (!media) return { ok: false, reason: "Media not found." };
  if (media.storage_status === "stored") return { ok: false, reason: "Media already has a stored object." };

  const allowed = new Set(["image", "video", "audio", "document"]);
  if (!allowed.has(media.file_type)) return { ok: false, reason: "Invalid media type." };
  const b = env.MEDIA_R2;
  if (!b) return { ok: false, reason: "R2 media storage is not configured." };

  const ext = contentType.split("/")[1]?.split(";")[0]?.replace(/[^a-z0-9.+-]/gi, "") || "bin";
  const storageKey = `media/${mediaId}/${crypto.randomUUID()}.${ext}`;
  await b.put(storageKey, body, { httpMetadata: { contentType } });
  const updated = await registerStoredMedia(env, mediaId, storageKey);
  if (!updated) {
    await b.delete(storageKey);
    return { ok: false, reason: "Media metadata could not be updated." };
  }
  return { ok: true, storageKey };
}

export async function registerStoredMedia(
  env: StorageEnv,
  mediaId: number,
  storageKey: string,
  bucketName = "MEDIA_R2",
  retentionHours = RETENTION_HOURS,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE media SET storage_key = ?, storage_bucket = ?, storage_status = 'stored',
       uploaded_at = datetime('now'), retention_until = ?, deleted_at = NULL
     WHERE media_id = ?`
  ).bind(storageKey, bucketName, retentionUntil(retentionHours), mediaId).run();
  return result.meta.changes === 1;
}

export async function setMediaKeep(env: StorageEnv, mediaId: number, keep: boolean): Promise<boolean> {
  // Turning KEEP off must not silently grant another 48 hours. The policy is
  // 48 hours from the original upload, not 48 hours from the moment someone
  // toggles the flag back off.
  const result = await env.DB.prepare(
    `UPDATE media
     SET keep_media = ?,
         retention_until = CASE
           WHEN ? = 1 THEN NULL
           WHEN uploaded_at IS NOT NULL THEN datetime(uploaded_at, '+48 hours')
           ELSE ?
         END
     WHERE media_id = ? AND storage_status <> 'deleted'`
  ).bind(keep ? 1 : 0, keep ? 1 : 0, retentionUntil(), mediaId).run();
  return result.meta.changes === 1;
}

export async function deleteMediaObject(env: StorageEnv, mediaId: number, force = false): Promise<{ ok: boolean; reason?: string }> {
  const media = await env.DB.prepare(
    `SELECT media_id, storage_key, storage_bucket, storage_status, keep_media
     FROM media WHERE media_id = ?`
  ).bind(mediaId).first<any>();
  if (!media) return { ok: false, reason: "Media not found." };
  if (!media.storage_key || media.storage_status === "deleted") return { ok: true };
  if (media.keep_media && !force) return { ok: false, reason: "Media is explicitly kept." };

  const refs = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM broadcast_campaign_items
     WHERE media_id = ? AND status IN ('scheduled','paused')`
  ).bind(mediaId).first<{ count: number }>();
  if ((refs?.count ?? 0) > 0 && !force) return { ok: false, reason: "Media is still referenced by scheduled campaign items." };

  const playoutRefs = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM playout_assets
     WHERE media_id = ? AND status IN ('scheduled','playing')`
  ).bind(mediaId).first<{ count: number }>();
  if ((playoutRefs?.count ?? 0) > 0 && !force) return { ok: false, reason: "Media is still referenced by active prerecorded playout." };

  const b = bucket(env, media.storage_bucket);
  if (!b) return { ok: false, reason: "R2 binding is not configured." };
  try {
    await b.delete(media.storage_key);
  } catch {
    await env.DB.prepare(
      `INSERT INTO media_cleanup_log (media_id, storage_key, action, detail) VALUES (?, ?, 'failed', ?)`
    ).bind(mediaId, media.storage_key, "R2 deletion failed; metadata retained for retry").run();
    return { ok: false, reason: "R2 object deletion failed; cleanup will retry." };
  }
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE media SET storage_status = 'deleted', deleted_at = datetime('now'), storage_key = NULL
       WHERE media_id = ?`
    ).bind(mediaId),
    env.DB.prepare(
      `UPDATE broadcast_campaign_items SET status='cancelled'
       WHERE media_id=? AND status IN ('scheduled','paused')`
    ).bind(mediaId),
    env.DB.prepare(
      `UPDATE playout_assets SET status='cancelled'
       WHERE media_id=? AND status IN ('scheduled','playing')`
    ).bind(mediaId),
    env.DB.prepare(
      `INSERT INTO media_cleanup_log (media_id, storage_key, action, detail) VALUES (?, ?, 'deleted', ?)`
    ).bind(mediaId, media.storage_key, force ? "manual force delete" : "retention cleanup/manual delete")
  ]);
  return { ok: true };
}

export async function cleanupExpiredStorage(env: StorageEnv): Promise<{ deleted: number; skipped: number; failed: number }> {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT media_id FROM media
     WHERE storage_status = 'stored' AND keep_media = 0 AND retention_until IS NOT NULL
       AND datetime(retention_until) <= datetime(?) ORDER BY media_id LIMIT ?`
  ).bind(now, MAX_CLEANUP_BATCH).all<{ media_id: number }>();

  let deleted = 0, skipped = 0, failed = 0;
  for (const row of rows.results) {
    const result = await deleteMediaObject(env, row.media_id);
    if (result.ok) deleted++;
    else if (result.reason?.includes("referenced")) skipped++;
    else failed++;
  }

  const recordings = await env.DB.prepare(
    `SELECT recording_id, storage_key FROM broadcast_recordings
     WHERE status IN ('ready','downloaded') AND keep_recording = 0
       AND retention_until IS NOT NULL AND datetime(retention_until) <= datetime(?) LIMIT ?`
  ).bind(now, MAX_CLEANUP_BATCH).all<any>();
  for (const recording of recordings.results) {
    const b = env.MEDIA_R2;
    if (!b) { failed++; continue; }
    try {
      await b.delete(recording.storage_key);
      await env.DB.prepare(
        `UPDATE broadcast_recordings SET status='deleted', deleted_at=datetime('now') WHERE recording_id=?`
      ).bind(recording.recording_id).run();
      deleted++;
    } catch {
      failed++;
    }
  }
  return { deleted, skipped, failed };
}
