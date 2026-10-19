import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { checkRateLimit, rateLimitKey } from "../middleware/rate-limit";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/evangelism-service";
import * as Evangelism from "../services/evangelism-service";
import * as Counselling from "../services/counselling-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}

/**
 * FIX (Adversarial Audit Finding D1): these routes were entirely missing —
 * decryptDecisionContact/decryptCounsellingMessage existed as functions
 * with no route ever calling them, meaning nobody, not even Super
 * Administrator, could actually read a Decision or Counselling submission
 * through the API. This is the fix, gated at Deputy Super Administrator
 * or above, per the identity-reveal/high-security-data rule already
 * frozen for this exact tier of data.
 */
export async function handleViewDecisionContact(request: Request, env: Env, decisionId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Deputy Super Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Super Administrator or Deputy access required." } }, 403);

  const contact = await Evangelism.decryptDecisionContact(env, decisionId);
  if (!contact) return json({ error: { code: "not_found", message: "Decision not found." } }, 404);

  // Every access to this data is audit logged — no exceptions, per the
  // identity-reveal discipline already established for this project.
  // audit_logs now genuinely exists (migration 0019) -- no silent-catch
  // needed; if this write fails, the request should fail loudly, not
  // silently succeed while going unlogged.
  await env.DB.prepare(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, result) VALUES (?, 'view_decision_contact', 'decisions', ?, 'success')`
  ).bind(actor.userId, decisionId).run();

  return json({ success: true, contact });
}

export async function handleViewCounsellingMessage(request: Request, env: Env, contactId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Deputy Super Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Super Administrator or Deputy access required." } }, 403);

  const message = await Counselling.decryptCounsellingMessage(env, contactId);
  if (message === null) return json({ error: { code: "not_found", message: "Counselling request not found." } }, 404);

  await env.DB.prepare(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, result) VALUES (?, 'view_counselling_message', 'counselling', ?, 'success')`
  ).bind(actor.userId, contactId).run();

  return json({ success: true, message });
}

export async function handleSubmitDecision(request: Request, env: Env): Promise<Response> {
  // No requireAuth here — a first-time visitor with no account must be able
  // to submit this, per the frozen "I Said Yes to Jesus" flow (userId nullable).
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rl = await checkRateLimit(env, rateLimitKey("decision-submit", ip), 5, 900);
  if (!rl.allowed) return json({ error: { code: "rate_limited", message: "Please try again shortly." } }, 429);

  const body = await request.json<any>();
  let userId: number | null = null;
  const sessionUserId = await requireAuth(request, env).catch(() => null);
  if (sessionUserId) userId = sessionUserId;

  const result = await Evangelism.submitDecision(env, {
    ...body,
    userId,
    decisionType: body.decisionType ?? body.decision,
    contactMethod: body.contactMethod ?? (body.email ? "email" : undefined),
    contactValue: body.contactValue ?? body.email,
    wantsFollowup: typeof body.wantsFollowup === "boolean" ? body.wantsFollowup : true,
  });
  return result.success
    ? json({ success: true, ...result.data, message: "Welcome to God's family! Our follow-up team will be in touch soon." }, 201)
    : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleGetFeaturedNation(_request: Request, env: Env): Promise<Response> {
  const nation = await Evangelism.getFeaturedNationToday(env);
  return json({ success: true, nation });
}

export async function handleListNations(_request: Request, env: Env): Promise<Response> {
  const nations = await Evangelism.listNations(env);
  return json({ success: true, nations });
}

export async function handleSubmitCounselling(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rl = await checkRateLimit(env, rateLimitKey("counselling-submit", ip), 5, 900);
  if (!rl.allowed) return json({ error: { code: "rate_limited", message: "Please try again shortly." } }, 429);

  const body = await request.json<any>();
  let userId: number | null = null;
  const sessionUserId = await requireAuth(request, env).catch(() => null);
  if (sessionUserId) userId = sessionUserId;

  const result = await Counselling.submitCounsellingRequest(env, { ...body, userId });
  return result.success
    ? json({ success: true, ...result.data, message: "Thank you for reaching out. Someone from our team will contact you soon." }, 201)
    : json({ error: { code: "invalid", message: result.error } }, 400);
}
