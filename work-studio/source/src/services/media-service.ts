import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

export interface MediaUploadInput {
  userId: number;
  fileType: "image" | "video" | "audio" | "document";
  title?: string;
  speaker?: string;
  event?: string;
  series?: string;
  bibleReferences?: string;
  topic?: string;
  owner?: string;
  photographerCreator?: string;
  source?: string;
  licenseType?: "pending_review" | "public_domain" | "ministry_owned" | "licensed";
  usageRights?: string;
  attributionRequired?: boolean;
}

export async function registerMediaItem(env: Env, input: MediaUploadInput): Promise<ServiceResult<{ mediaId: number }>> {
  if (!input.fileType) return { success: false, error: "File type is required." };

  const row = await env.DB.prepare(
    `INSERT INTO media
     (user_id, file_type, title, speaker, event, series, bible_references, topic, owner, photographer_creator, source, license_type, usage_rights, attribution_required, publish_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
     RETURNING media_id`
  )
    .bind(
      input.userId, input.fileType, input.title ?? null, input.speaker ?? null, input.event ?? null,
      input.series ?? null, input.bibleReferences ?? null, input.topic ?? null, input.owner ?? null,
      input.photographerCreator ?? null, input.source ?? null, input.licenseType ?? "pending_review",
      input.usageRights ?? null, input.attributionRequired ? 1 : 0
    )
    .first<{ media_id: number }>();

  return row ? { success: true, data: { mediaId: row.media_id } } : { success: false, error: "Failed to register media item." };
}

/**
 * THE COPYRIGHT GATE — same discipline as the hymn gate in Module 3.
 * Only 'public_domain' or 'ministry_owned' media is served publicly.
 * 'licensed' media requires the attribution to actually be shown by the
 * caller (enforced by returning attributionRequired so the client cannot
 * silently drop it — the platform can't force a frontend to render
 * attribution, but it can refuse to omit the fact that it's required).
 * 'pending_review' media is NEVER returned here, regardless of publish_status.
 */
export async function listPublicMedia(env: Env, topic?: string): Promise<any[]> {
  const query = topic
    ? `SELECT media_id, title, file_type, speaker, event, topic, license_type, attribution_required, source, thumbnail_url
       FROM media WHERE publish_status = 'published' AND storage_status = 'stored' AND license_type IN ('public_domain', 'ministry_owned', 'licensed') AND topic = ?
       ORDER BY publish_date DESC LIMIT 50`
    : `SELECT media_id, title, file_type, speaker, event, topic, license_type, attribution_required, source, thumbnail_url
       FROM media WHERE publish_status = 'published' AND storage_status = 'stored' AND license_type IN ('public_domain', 'ministry_owned', 'licensed')
       ORDER BY publish_date DESC LIMIT 50`;
  const stmt = topic ? env.DB.prepare(query).bind(topic) : env.DB.prepare(query).bind();
  const result = await (stmt as any).all();
  return result.results as any[];
}

/** Administrator-only — approves a pending_review item for publication. Requires an explicit license decision, not a default. */
export async function approveMediaForPublication(env: Env, mediaId: number, licenseType: "public_domain" | "ministry_owned" | "licensed"): Promise<ServiceResult> {
  const media = await env.DB.prepare("SELECT media_id, storage_status, storage_key FROM media WHERE media_id = ?").bind(mediaId).first<{ media_id: number; storage_status: string; storage_key: string | null }>();
  if (!media) return { success: false, error: "Media item not found." };
  if (media.storage_status !== 'stored' || !media.storage_key) return { success: false, error: "Media must have an uploaded storage object before publication." };

  await env.DB.prepare(
    "UPDATE media SET license_type = ?, publish_status = 'published', publish_date = datetime('now') WHERE media_id = ?"
  )
    .bind(licenseType, mediaId)
    .run();
  return { success: true };
}

export async function getPublicMediaObject(env: Env, mediaId: number, rangeHeader?: string | null): Promise<{ object: R2ObjectBody; contentType?: string; filename?: string } | null> {
  const media = await env.DB.prepare(
    `SELECT storage_key, storage_bucket, storage_status, publish_status, license_type, title, file_type
     FROM media WHERE media_id = ?`
  ).bind(mediaId).first<any>();
  if (!media || media.storage_status !== 'stored' || media.publish_status !== 'published') return null;
  if (!['public_domain', 'ministry_owned', 'licensed'].includes(media.license_type)) return null;
  const binding = media.storage_bucket === 'MEDIA_R2_STAGING' ? (env as any).MEDIA_R2_STAGING : (env as any).MEDIA_R2;
  if (!binding || !media.storage_key) return null;
  // Forward only a simple byte range to R2 for mobile audio streaming.
  const validRange = rangeHeader && /^bytes=[0-9]*-[0-9]*$/.test(rangeHeader);
  const rangeHeaders = validRange ? new Headers({ Range: rangeHeader }) : null;
  const object = await binding.get(media.storage_key, rangeHeaders ? { range: rangeHeaders } : undefined);
  if (!object || !('body' in object)) return null;
  const mime = String(object.httpMetadata?.contentType || '').split(';')[0].trim().toLowerCase();
  const audioExt = ['audio/mp4', 'audio/x-m4a', 'audio/m4a'].includes(mime) ? 'm4a'
    : mime === 'audio/aac' ? 'aac' : 'mp3';
  const ext = media.file_type === 'video' ? 'mp4' : media.file_type === 'audio' ? audioExt : media.file_type === 'image' ? 'jpg' : 'bin';
  return { object, contentType: object.httpMetadata?.contentType, filename: `${(media.title || 'heavenly-key-media').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 100)}.${ext}` };
}
