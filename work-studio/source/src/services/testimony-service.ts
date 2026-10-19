import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

export interface TestimonyInput {
  userId: number;
  categoryId: number;
  title: string;
  story: string;
  anonymous: boolean;
  mediaType?: "text" | "audio" | "video";
  mediaUrl?: string;
}

export async function submitTestimony(env: Env, input: TestimonyInput): Promise<ServiceResult<{ testimonyId: number }>> {
  if (!input.title || !input.story || input.story.length < 10) {
    return { success: false, error: "Please share your testimony in a bit more detail." };
  }
  if (input.title.length > MAX_LENGTHS.shortText || input.story.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Title must be under ${MAX_LENGTHS.shortText} characters and story under ${MAX_LENGTHS.standardText} characters.` };
  }

  const category = await env.DB.prepare("SELECT category_id FROM categories WHERE category_id = ? AND module = 'testimony'")
    .bind(input.categoryId)
    .first();
  if (!category) return { success: false, error: "Invalid category." };

  const row = await env.DB.prepare(
    `INSERT INTO testimonies (user_id, category_id, anonymous, title, story, media_type, approval_status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending') RETURNING testimony_id`
  )
    .bind(input.userId, input.categoryId, input.anonymous ? 1 : 0, input.title, input.story, input.mediaType ?? "text")
    .first<{ testimony_id: number }>();

  if (!row) return { success: false, error: "Failed to submit testimony." };

  // NON-NEGOTIABLE RULE: every testimony starts 'pending'. There is no code
  // path in this service that sets approval_status to 'approved' on insert —
  // that only happens via approveTestimony() below, called from a Moderator
  // route, never from the member-facing submission route.
  return { success: true, data: { testimonyId: row.testimony_id } };
}

export async function listApprovedTestimonies(env: Env, limit = 20): Promise<any[]> {
  const result = await env.DB.prepare(
    `SELECT t.testimony_id, t.title, t.story, t.category_id, t.anonymous, t.featured_on_homepage, t.created_at, u.name
     FROM testimonies t JOIN users u ON u.user_id = t.user_id
     WHERE t.approval_status = 'approved'
     ORDER BY t.created_at DESC LIMIT ?`
  )
    .bind(limit)
    .all();

  return (result.results as any[]).map((r) => ({
    testimonyId: r.testimony_id,
    title: r.title,
    story: r.story,
    categoryId: r.category_id,
    anonymous: !!r.anonymous,
    displayName: r.anonymous ? null : r.name,
    featuredOnHomepage: !!r.featured_on_homepage,
    createdAt: r.created_at,
  }));
}

/** Moderator-only action — must be called only from a route that has verified a Moderator/Administrator role. */
export async function approveTestimony(env: Env, testimonyId: number, reviewerId: number): Promise<ServiceResult> {
  const result = await env.DB.prepare(
    `UPDATE testimonies SET approval_status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
     WHERE testimony_id = ? AND approval_status = 'pending'`
  )
    .bind(reviewerId, testimonyId)
    .run();

  return { success: true };
}

/** Administrator-only — separate gate from general approval, per the frozen content matrix. */
export async function featureTestimonyOnHomepage(env: Env, testimonyId: number): Promise<ServiceResult> {
  await env.DB.prepare(
    `UPDATE testimonies SET featured_on_homepage = 1 WHERE testimony_id = ? AND approval_status = 'approved'`
  )
    .bind(testimonyId)
    .run();
  return { success: true };
}
