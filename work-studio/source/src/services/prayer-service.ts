import { canAccessContent } from "./content-access";
import type { Env } from "./auth-service";
import { MAX_LENGTHS } from "../config/security-config";

export interface PrayerRequestInput {
  userId: number;
  categoryId: number;
  title: string;
  requestText: string;
  visibility: "public" | "ministry_only";
  anonymous: boolean;
}

export interface ServiceResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function createPrayerRequest(env: Env, input: PrayerRequestInput): Promise<ServiceResult<{ prayerId: number }>> {
  if (typeof input.title!=="string" || !input.title.trim() || input.title.length > 100) {
    return { success: false, error: "Title is required and must be under 100 characters." };
  }
  if (typeof input.requestText!=="string" || !input.requestText.trim() || input.requestText.length < 3) {
    return { success: false, error: "Please share your request." };
  }
  if (input.requestText.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Request must be under ${MAX_LENGTHS.standardText} characters.` };
  }
  if(!['public','ministry_only'].includes(input.visibility))return {success:false,error:'Choose public or ministry-only visibility.'};
  const category = await env.DB.prepare("SELECT category_id FROM categories WHERE category_id = ? AND module = 'prayer'")
    .bind(input.categoryId)
    .first();
  if (!category) {
    return { success: false, error: "Invalid category." };
  }

  const row = await env.DB.prepare(
    `INSERT INTO prayer_requests (user_id, category_id, anonymous, title, request_text, visibility, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active') RETURNING prayer_id`
  )
    .bind(input.userId, input.categoryId, input.anonymous ? 1 : 0, input.title, input.requestText, input.visibility)
    .first<{ prayer_id: number }>();

  if (!row) return { success: false, error: "Failed to submit prayer request." };

  // Prayer requests publish immediately per the frozen content-approval matrix —
  // no approval gate here, unlike testimonies below.
  return { success: true, data: { prayerId: row.prayer_id } };
}

export interface PrayerFeedItem {
  prayerId: number;
  title: string;
  requestText: string;
  categoryId: number;
  anonymous: boolean;
  displayName: string | null; // null when anonymous — never the real name
  createdAt: string;
}

export async function listPrayerFeed(env: Env, limit = 20, cursorCreatedAt?: string): Promise<PrayerFeedItem[]> {
  // Cursor-based pagination per Volume 2 §6 — never OFFSET.
  const query = cursorCreatedAt
    ? `SELECT p.prayer_id, p.title, p.request_text, p.category_id, p.anonymous, p.created_at, u.name
       FROM prayer_requests p JOIN users u ON u.user_id = p.user_id
       WHERE p.visibility = 'public' AND p.status = 'active' AND p.created_at < ?
       ORDER BY p.created_at DESC LIMIT ?`
    : `SELECT p.prayer_id, p.title, p.request_text, p.category_id, p.anonymous, p.created_at, u.name
       FROM prayer_requests p JOIN users u ON u.user_id = p.user_id
       WHERE p.visibility = 'public' AND p.status = 'active'
       ORDER BY p.created_at DESC LIMIT ?`;

  const stmt = cursorCreatedAt ? env.DB.prepare(query).bind(cursorCreatedAt, limit) : env.DB.prepare(query).bind(limit);
  const result = await (stmt as any).all();

  return (result.results as any[]).map((r) => ({
    prayerId: r.prayer_id,
    title: r.title,
    requestText: r.request_text,
    categoryId: r.category_id,
    anonymous: !!r.anonymous,
    // THE ANONYMOUS RULE, ENFORCED HERE: display name is only ever included
    // when anonymous=false. user_id itself is never returned to the client.
    displayName: r.anonymous ? null : r.name,
    createdAt: r.created_at,
  }));
}

export async function listPrayerAudio(env: Env, limit = 20): Promise<any[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const result = await env.DB.prepare(
    `SELECT media_id, title, speaker, event, topic, source, attribution_required,
            '/api/media/' || media_id || '/object' AS playback_url
     FROM media
     WHERE file_type='audio' AND topic='prayer' AND publish_status='published'
       AND storage_status='stored' AND license_type IN ('public_domain','ministry_owned','licensed')
     ORDER BY publish_date DESC LIMIT ?`
  ).bind(safeLimit).all();
  return result.results as any[];
}

export type ReactionType = "praying" | "verse" | "encouragement";

export async function addPrayerResponse(
  env: Env,
  prayerId: number,
  userId: number,
  responseType: ReactionType,
  content?: string
): Promise<ServiceResult> {
  if(!['praying','verse','encouragement'].includes(responseType)|| (content!==undefined&&(typeof content!=='string'||content.length>MAX_LENGTHS.standardText)))return {success:false,error:'Invalid prayer response.'};
  if(!await canAccessContent(env,'prayer_request',prayerId,userId,true))return {success:false,error:'Prayer request not found.'};
  const prayer = await env.DB.prepare("SELECT prayer_id FROM prayer_requests WHERE prayer_id = ? AND status = 'active'")
    .bind(prayerId)
    .first();
  if (!prayer) return { success: false, error: "Prayer request not found." };

  await env.DB.prepare(
    `INSERT INTO prayer_responses (prayer_id, user_id, response_type, content) VALUES (?, ?, ?, ?)`
  )
    .bind(prayerId, userId, responseType, content ?? null)
    .run();

  return { success: true };
}

