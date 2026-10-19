import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

/**
 * THIS CLOSES A GAP THE FIRST INDEPENDENT AUDIT FOUND: earlier in this
 * project it was claimed the hymn module was "built to refuse to display
 * unreviewed content" because copyright_status defaulted to 'pending_review'
 * — but no code actually enforced that. This function is that enforcement,
 * finally real. A hymn with copyright_status other than 'public_domain' or
 * 'licensed' is never returned by listPublicHymns, full stop.
 */
export async function listPublicHymns(env: Env, limit = 50): Promise<any[]> {
  const result = await env.DB.prepare(
    `SELECT hymn_id, hymn_number, title, first_line, author, theme, copyright_status
     FROM hymns WHERE copyright_status IN ('public_domain', 'licensed')
     ORDER BY hymn_number LIMIT ?`
  )
    .bind(limit)
    .all();
  return result.results as any[];
}

export async function getHymn(env: Env, hymnId: number): Promise<any | null> {
  const hymn = await env.DB.prepare(
    `SELECT h.*, m.file_type as media_file_type
       FROM hymns h
       LEFT JOIN media m ON m.media_id = h.media_id
          AND m.storage_status = 'stored' AND m.publish_status = 'published'
          AND m.file_type IN ('audio','video')
          AND m.license_type IN ('public_domain','ministry_owned','licensed')
      WHERE h.hymn_id = ? AND h.copyright_status IN ('public_domain', 'licensed')`
  ).bind(hymnId).first<any>();
  if (!hymn) return null;
  return { ...hymn, playbackUrl: hymn.media_file_type ? `/api/media/${hymn.media_id}/object` : null, mediaType: hymn.media_file_type ?? null };
}

export async function toggleFavourite(env: Env, userId: number, hymnId: number): Promise<ServiceResult<{ favourited: boolean }>> {
  const hymn = await env.DB.prepare("SELECT hymn_id FROM hymns WHERE hymn_id = ? AND copyright_status IN ('public_domain', 'licensed')").bind(hymnId).first();
  if (!hymn) return { success: false, error: "Hymn not available." };

  const existing = await env.DB.prepare("SELECT 1 FROM hymn_favourites WHERE user_id = ? AND hymn_id = ?").bind(userId, hymnId).first();
  if (existing) {
    await env.DB.prepare("DELETE FROM hymn_favourites WHERE user_id = ? AND hymn_id = ?").bind(userId, hymnId).run();
    return { success: true, data: { favourited: false } };
  }
  await env.DB.prepare("INSERT INTO hymn_favourites (user_id, hymn_id) VALUES (?, ?)").bind(userId, hymnId).run();
  return { success: true, data: { favourited: true } };
}

export async function recordPlayed(env: Env, userId: number, hymnId: number): Promise<void> {
  await env.DB.prepare("INSERT INTO hymn_recently_played (user_id, hymn_id) VALUES (?, ?)").bind(userId, hymnId).run();
}

export async function listPublicHymnsWithPlayback(env: Env, limit = 50): Promise<any[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const result = await env.DB.prepare(
    `SELECT h.hymn_id, h.hymn_number, h.title, h.first_line, h.author, h.theme, h.copyright_status,
            h.media_id, m.file_type
       FROM hymns h
       LEFT JOIN media m ON m.media_id = h.media_id
          AND m.storage_status = 'stored' AND m.publish_status = 'published'
          AND m.file_type IN ('audio','video')
          AND m.license_type IN ('public_domain','ministry_owned','licensed')
      WHERE h.copyright_status IN ('public_domain','licensed')
      ORDER BY h.hymn_number, h.hymn_id LIMIT ?`
  ).bind(safeLimit).all();
  return (result.results as any[]).map((r) => ({
    hymnId: r.hymn_id,
    hymnNumber: r.hymn_number,
    title: r.title,
    firstLine: r.first_line,
    author: r.author,
    theme: r.theme,
    copyrightStatus: r.copyright_status,
    mediaId: r.file_type ? r.media_id : null,
    mediaType: r.file_type ?? null,
    playbackUrl: r.file_type ? `/api/media/${r.media_id}/object` : null,
  }));
}

export async function attachHymnMedia(env: Env, hymnId: number, mediaId: number): Promise<ServiceResult> {
  const hymn = await env.DB.prepare("SELECT hymn_id FROM hymns WHERE hymn_id = ?").bind(hymnId).first();
  if (!hymn) return { success: false, error: "Hymn not found." };
  const media = await env.DB.prepare(
    `SELECT media_id FROM media WHERE media_id = ? AND file_type IN ('audio','video')
      AND storage_status = 'stored' AND publish_status = 'published'
      AND license_type IN ('public_domain','ministry_owned','licensed')`
  ).bind(mediaId).first();
  if (!media) return { success: false, error: "Approved stored hymn audio/video is required." };
  await env.DB.prepare("UPDATE hymns SET media_id = ? WHERE hymn_id = ?").bind(mediaId, hymnId).run();
  return { success: true };
}
