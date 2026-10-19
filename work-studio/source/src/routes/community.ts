import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { checkRateLimit, rateLimitKey } from "../middleware/rate-limit";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Prayer from "../services/prayer-service";
import * as Testimony from "../services/testimony-service";
import * as QA from "../services/qa-service";
import * as Discussion from "../services/discussion-service";
import * as CommentsReactions from "../services/comments-reactions-service";
import * as Follow from "../services/follow-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const unauthorized = () => json({ error: { code: "unauthorized", message: "Please log in." } }, 401);
const forbidden = () => json({ error: { code: "forbidden", message: "Insufficient permissions." } }, 403);

/**
 * FIX: same gap class as Adversarial Audit Finding D1 — approveTestimony,
 * markRecommendedAnswer, and featureTestimonyOnHomepage have existed as
 * service functions since Module 2 was built, but no route ever called
 * them. Found by proactively checking for this exact pattern again,
 * rather than waiting for another accident or audit to surface it.
 */
export async function handleApproveTestimony(request: Request, env: Env, testimonyId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();
  await Testimony.approveTestimony(env, testimonyId, actor.userId);
  return json({ success: true });
}

/** Administrator-only — separate, higher gate than general approval, per the frozen content matrix. */
export async function handleFeatureTestimony(request: Request, env: Env, testimonyId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  await Testimony.featureTestimonyOnHomepage(env, testimonyId);
  return json({ success: true });
}

export async function handleMarkRecommendedAnswer(request: Request, env: Env, answerId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();
  await QA.markRecommendedAnswer(env, answerId);
  return json({ success: true });
}

// ---------- Prayer Centre ----------
export async function handleCreatePrayer(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rl = await checkRateLimit(env, rateLimitKey("prayer-create", ip, String(userId)), 10, 3600);
  if (!rl.allowed) return json({ error: { code: "rate_limited", message: "Please slow down." } }, 429);

  const body = await request.json<any>();
  const result = await Prayer.createPrayerRequest(env, { ...body, userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListPrayers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const items = await Prayer.listPrayerFeed(env, 20, cursor);
  return json({ success: true, items });
}

export async function handleListPrayerAudio(request: Request, env: Env): Promise<Response> {
  const items = await Prayer.listPrayerAudio(env);
  return json({ success: true, items, mediaBasePath: "/api/media/" });
}


export async function handlePrayerRespond(request: Request, env: Env, prayerId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ responseType: Prayer.ReactionType; content?: string }>();
  const result = await Prayer.addPrayerResponse(env, prayerId, userId, body.responseType, body.content);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

// ---------- Testimonies ----------
export async function handleSubmitTestimony(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<any>();
  const result = await Testimony.submitTestimony(env, { ...body, userId });
  return result.success
    ? json({ success: true, ...result.data, message: "Thank you for sharing! Your testimony is being reviewed." }, 201)
    : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListTestimonies(_request: Request, env: Env): Promise<Response> {
  const items = await Testimony.listApprovedTestimonies(env);
  return json({ success: true, items });
}

// ---------- Bible Questions & Answers ----------
export async function handleAskQuestion(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<any>();
  const result = await QA.askQuestion(env, { ...body, userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleGetQuestion(_request: Request, env: Env, questionId: number): Promise<Response> {
  const question = await QA.getQuestionWithAnswers(env, questionId);
  return question ? json({ success: true, question }) : json({ error: { code: "not_found", message: "Question not found." } }, 404);
}

export async function handleSubmitAnswer(request: Request, env: Env, questionId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ answerText: string }>();
  const result = await QA.submitAnswer(env, questionId, userId, body.answerText);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

// ---------- Discussions ----------
export async function handleCreateDiscussion(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<any>();
  const result = await Discussion.createDiscussion(env, { ...body, userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListDiscussions(_request: Request, env: Env): Promise<Response> {
  const items = await Discussion.listDiscussions(env);
  return json({ success: true, items });
}

// ---------- Comments & Reactions (universal) ----------
export async function handleAddComment(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ contentType: string; contentId: number; body: string }>();
  const result = await CommentsReactions.addComment(env, userId, body.contentType, body.contentId, body.body);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListComments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contentType = url.searchParams.get("contentType") ?? "";
  const contentId = Number(url.searchParams.get("contentId"));
  const items = await CommentsReactions.listComments(env, contentType, contentId,await requireAuth(request,env));
  return json({ success: true, items });
}

export async function handleToggleReaction(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ contentType: string; contentId: number; reactionType: string }>();
  const result = await CommentsReactions.toggleReaction(env, userId, body.contentType, body.contentId, body.reactionType);
  return result.success ? json({ success: true, ...result.data }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

// ---------- Follow ----------
export async function handleFollow(request: Request, env: Env, targetUserId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const result = await Follow.followUser(env, userId, targetUserId);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleBlock(request: Request, env: Env, targetUserId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const result = await Follow.blockUser(env, userId, targetUserId);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleUnfollow(request: Request, env: Env, targetUserId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  await Follow.unfollowUser(env, userId, targetUserId);
  return json({ success: true });
}

export async function handleCountReactions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contentType = url.searchParams.get("contentType") ?? "";
  const contentId = Number(url.searchParams.get("contentId"));
  const counts = await CommentsReactions.countReactions(env, contentType, contentId,await requireAuth(request,env));
  return json({ success: true, counts });
}

