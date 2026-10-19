import { canAccessContent } from "./content-access";
import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

// The valid content_type values across the whole platform. Enforced in
// application code since D1/SQLite cannot enforce a polymorphic FK
// (Database Audit Finding 8 — accepted tradeoff, validated here instead).
const VALID_CONTENT_TYPES = ["prayer_request", "testimony", "question", "discussion", "group_post"] as const;
type ContentType = (typeof VALID_CONTENT_TYPES)[number];

function isValidContentType(value: string): value is ContentType {
  return (VALID_CONTENT_TYPES as readonly string[]).includes(value);
}

export async function addComment(env: Env, userId: number, contentType: string, contentId: number, body: string): Promise<ServiceResult<{ commentId: number }>> {
  if (!isValidContentType(contentType)) {
    return { success: false, error: "Invalid content type." };
  }
  if (typeof body!=="string" || !body.trim()) return { success: false, error: "Comment cannot be empty." };
  if (body.length > MAX_LENGTHS.postBody) {
    return { success: false, error: `Comment must be under ${MAX_LENGTHS.postBody} characters.` };
  }

  if(!await canAccessContent(env,contentType,contentId,userId,true))return {success:false,error:"Content is unavailable or does not allow replies."};
  const row = await env.DB.prepare(
    `INSERT INTO comments (user_id, content_type, content_id, body, status) VALUES (?, ?, ?, ?, 'active') RETURNING comment_id`
  )
    .bind(userId, contentType, contentId, body)
    .first<{ comment_id: number }>();

  if (!row) return { success: false, error: "Failed to add comment." };
  return { success: true, data: { commentId: row.comment_id } };
}

export async function listComments(env: Env, contentType: string, contentId: number, requesterId:number|null=null): Promise<any[]> {
  if (!isValidContentType(contentType)||!await canAccessContent(env,contentType,contentId,requesterId)) return [];

  const result = await env.DB.prepare(
    `SELECT c.comment_id, c.body, c.created_at, u.name
     FROM comments c JOIN users u ON u.user_id = c.user_id
     WHERE c.content_type = ? AND c.content_id = ? AND c.status = 'active'
     ORDER BY c.created_at ASC LIMIT 100`
  )
    .bind(contentType, contentId)
    .all();

  return (result.results as any[]).map((r) => ({
    commentId: r.comment_id,
    body: r.body,
    authorName: r.name,
    createdAt: r.created_at,
  }));
}

const VALID_REACTION_TYPES = ["praying", "amen", "encouraged", "like"] as const;
type ReactionKind = (typeof VALID_REACTION_TYPES)[number];

export async function toggleReaction(env: Env, userId: number, contentType: string, contentId: number, reactionType: string): Promise<ServiceResult<{ active: boolean }>> {
  if (!isValidContentType(contentType)) return { success: false, error: "Invalid content type." };
  if (!(VALID_REACTION_TYPES as readonly string[]).includes(reactionType)) {
    return { success: false, error: "Invalid reaction type." };
  }

  if(!await canAccessContent(env,contentType,contentId,userId,true))return {success:false,error:"Content is unavailable or does not allow responses."};
  const existing = await env.DB.prepare(
    `SELECT reaction_id FROM reactions WHERE user_id = ? AND content_type = ? AND content_id = ? AND reaction_type = ?`
  )
    .bind(userId, contentType, contentId, reactionType)
    .first<{ reaction_id: number }>();

  if (existing) {
    // toggling off
    await env.DB.prepare("DELETE FROM reactions WHERE reaction_id = ?").bind(existing.reaction_id).run();
    return { success: true, data: { active: false } };
  }

  await env.DB.prepare(
    `INSERT INTO reactions (user_id, content_type, content_id, reaction_type) VALUES (?, ?, ?, ?)`
  )
    .bind(userId, contentType, contentId, reactionType)
    .run();
  return { success: true, data: { active: true } };
}

export async function countReactions(env: Env, contentType: string, contentId: number,requesterId:number|null=null): Promise<Record<string, number>> {
  if(!await canAccessContent(env,contentType,contentId,requesterId))return {};
  const result = await env.DB.prepare(
    `SELECT reaction_type, COUNT(*) as cnt FROM reactions WHERE content_type = ? AND content_id = ? GROUP BY reaction_type`
  )
    .bind(contentType, contentId)
    .all();

  const counts: Record<string, number> = {};
  for (const row of result.results as any[]) counts[row.reaction_type] = row.cnt;
  return counts;
}

