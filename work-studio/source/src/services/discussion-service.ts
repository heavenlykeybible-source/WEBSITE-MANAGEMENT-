import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

export interface DiscussionInput {
  userId: number;
  categoryId: number;
  title: string;
  body: string;
  anonymous: boolean;
}

export async function createDiscussion(env: Env, input: DiscussionInput): Promise<ServiceResult<{ discussionId: number }>> {
  if (typeof input.title!=="string" || typeof input.body!=="string" || !input.title.trim() || !input.body.trim()) return { success: false, error: "Title and body are required." };
  if (input.title.length > MAX_LENGTHS.shortText || input.body.length > MAX_LENGTHS.postBody) {
    return { success: false, error: `Title must be under ${MAX_LENGTHS.shortText} characters and body under ${MAX_LENGTHS.postBody} characters.` };
  }

  const category = await env.DB.prepare("SELECT category_id FROM categories WHERE category_id = ? AND module = 'discussion'")
    .bind(input.categoryId)
    .first();
  if (!category) return { success: false, error: "Invalid category." };

  const row = await env.DB.prepare(
    `INSERT INTO discussions (user_id, category_id, title, body, anonymous, status) VALUES (?, ?, ?, ?, ?, 'active') RETURNING discussion_id`
  )
    .bind(input.userId, input.categoryId, input.title, input.body, input.anonymous ? 1 : 0)
    .first<{ discussion_id: number }>();

  if (!row) return { success: false, error: "Failed to create discussion." };
  // pinned/locked default to 0 — a member creating a discussion can never set
  // these themselves; only moderator-only routes (not implemented in this
  // member-facing service) may change them.
  return { success: true, data: { discussionId: row.discussion_id } };
}

export async function listDiscussions(env: Env, limit = 20): Promise<any[]> {
  const result = await env.DB.prepare(
    `SELECT d.discussion_id, d.title, d.body, d.category_id, d.anonymous, d.pinned, d.locked, d.created_at, u.name
     FROM discussions d JOIN users u ON u.user_id = d.user_id
     WHERE d.status = 'active'
     ORDER BY d.pinned DESC, d.created_at DESC LIMIT ?`
  )
    .bind(limit)
    .all();

  return (result.results as any[]).map((r) => ({
    discussionId: r.discussion_id,
    title: r.title,
    body: r.body,
    categoryId: r.category_id,
    displayName: r.anonymous ? null : r.name,
    pinned: !!r.pinned,
    locked: !!r.locked,
    createdAt: r.created_at,
  }));
}

