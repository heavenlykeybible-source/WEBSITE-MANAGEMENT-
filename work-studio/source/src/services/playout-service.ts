import type { StorageEnv } from "./storage-retention-service";
import type { ServiceResult } from "./prayer-service";

export async function schedulePlayout(
  env: StorageEnv,
  input: { mediaId: number; startsAt?: string; endsAt?: string; keepAsset?: boolean }
): Promise<ServiceResult<{ playoutAssetId: number }>> {
  const media = await env.DB.prepare(
    `SELECT media_id, file_type, storage_key, storage_status, keep_media, retention_until
     FROM media WHERE media_id=?`
  ).bind(input.mediaId).first<any>();
  if (!media) return { success: false, error: "Media not found." };
  if (!['video','audio'].includes(media.file_type)) return { success: false, error: "Only video and audio can be scheduled for prerecorded playout." };
  if (media.storage_status !== 'stored' || !media.storage_key) return { success: false, error: "Media must be uploaded to temporary R2 storage before playout." };
  if (input.startsAt && Number.isNaN(Date.parse(input.startsAt))) return { success: false, error: "startsAt must be a valid ISO timestamp." };
  if (input.endsAt && Number.isNaN(Date.parse(input.endsAt))) return { success: false, error: "endsAt must be a valid ISO timestamp." };
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) return { success: false, error: "endsAt must be later than startsAt." };
  if (input.startsAt && media.retention_until && new Date(input.startsAt) > new Date(media.retention_until) && !input.keepAsset && !media.keep_media) {
    return { success: false, error: "The asset expires before the requested playout time. Upload it within the 48-hour window or explicitly keep it." };
  }
  if (input.keepAsset && !media.keep_media) {
    await env.DB.prepare(
      `UPDATE media SET keep_media = 1, retention_until = NULL WHERE media_id = ? AND storage_status = 'stored'`
    ).bind(input.mediaId).run();
  }
  const row = await env.DB.prepare(
    `INSERT INTO playout_assets (media_id, storage_key, starts_at, ends_at, status, keep_asset, retention_until)
     VALUES (?, ?, ?, ?, 'scheduled', ?, ? ) RETURNING playout_asset_id`
  ).bind(input.mediaId, media.storage_key, input.startsAt ?? null, input.endsAt ?? null, input.keepAsset || !!media.keep_media ? 1 : 0, (input.keepAsset || media.keep_media) ? null : media.retention_until).first<{ playout_asset_id: number }>();
  return row ? { success: true, data: { playoutAssetId: row.playout_asset_id } } : { success: false, error: "Failed to schedule playout." };
}

export async function listUpcomingPlayout(env: StorageEnv, limit = 50): Promise<any[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const result = await env.DB.prepare(
    `SELECT pa.playout_asset_id, pa.media_id, pa.starts_at, pa.ends_at, pa.status,
            m.title, m.file_type
     FROM playout_assets pa JOIN media m ON m.media_id=pa.media_id
     WHERE pa.status IN ('scheduled','playing') ORDER BY pa.starts_at ASC LIMIT ?`
  ).bind(safeLimit).all();
  return result.results as any[];
}

/** Advances scheduled prerecorded assets based on wall-clock time. The actual
 * encoder/stream transport remains an external broadcast concern; this keeps
 * the ministry's D1 state truthful for the player/control plane. */
export async function advancePlayoutState(env: StorageEnv): Promise<{ started: number; completed: number }> {
  const now = new Date().toISOString();
  const started = await env.DB.prepare(
    `UPDATE playout_assets SET status='playing'
     WHERE status='scheduled' AND starts_at IS NOT NULL AND datetime(starts_at) <= datetime(?)
       AND (ends_at IS NULL OR datetime(ends_at) > datetime(?))`
  ).bind(now, now).run();
  const completed = await env.DB.prepare(
    `UPDATE playout_assets SET status='completed'
     WHERE status='playing' AND ends_at IS NOT NULL AND datetime(ends_at) <= datetime(?)`
  ).bind(now).run();
  return { started: started.meta.changes ?? 0, completed: completed.meta.changes ?? 0 };
}
