import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Moderation from "../services/moderation-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const forbidden = () => json({ error: { code: "forbidden", message: "Moderator access required." } }, 403);

export async function handleIssueModerationAction(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();

  const body = await request.json<any>();
  const result = await Moderation.issueModerationAction(env, { ...body, actorUserId: actor.userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleAddModeratorNote(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();
  const body = await request.json<{ actionId: number | null; targetUserId: number; noteText: string }>();
  const result = await Moderation.addModeratorNote(env, body.actionId, body.targetUserId, actor.userId, body.noteText);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleSubmitAppeal(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Member"); // any logged-in member may appeal an action against themselves
  if (!actor) return json({ error: { code: "unauthorized", message: "Please log in." } }, 401);
  const body = await request.json<{ actionId: number; appealReason: string }>();
  const result = await Moderation.submitAppeal(env, body.actionId, actor.userId, body.appealReason);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleDecideAppeal(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();
  const body = await request.json<{ appealId: number; decision: "upheld" | "overturned" | "partially_overturned"; notes: string }>();
  const result = await Moderation.decideAppeal(env, body.appealId, actor.userId, body.decision, body.notes);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleModerationDashboard(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();
  const data = await Moderation.getModerationDashboard(env);
  return json({ success: true, data });
}

export async function handleCommunityHealthDashboard(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return forbidden();
  const data = await Moderation.getCommunityHealthDashboard(env);
  return json({ success: true, data });
}
