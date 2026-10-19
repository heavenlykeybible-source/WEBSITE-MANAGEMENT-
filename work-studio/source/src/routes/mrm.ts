import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as MRM from "../services/mrm-service";
import * as Distribution from "../services/unified-distribution-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}

/** Timeline enforces its own tiered access internally — the route just authenticates the viewer, never assumes access. */
export async function handleGetTimeline(request: Request, env: Env, targetUserId: number): Promise<Response> {
  const viewerId = await requireAuth(request, env);
  if (!viewerId) return json({ error: { code: "unauthorized" } }, 401);
  const data = await MRM.getMinistryJourneyTimeline(env, targetUserId, viewerId);
  return json({ success: true, ...data });
}

export async function handleCareDashboard(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return json({ error: { code: "forbidden" } }, 403);
  const data = await MRM.getMinistryCareDashboard(env);
  return json({ success: true, data });
}

export async function handleStartWorkflow(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return json({ error: { code: "forbidden" } }, 403);
  const body = await request.json<{ templateId: number; targetUserId: number; startDate: string }>();
  const result = await MRM.startFollowupWorkflow(env, body.templateId, body.targetUserId, body.startDate);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleGetDistributionStatus(request: Request, env: Env, campaignId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return json({ error: { code: "forbidden" } }, 403);
  const data = await Distribution.getDistributionStatus(env, campaignId);
  return json({ success: true, data });
}

export async function handleMyTasks(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: { code: "unauthorized" } }, 401);
  const items = await Distribution.listMyMinistryTasks(env, userId);
  return json({ success: true, items });
}

export async function handleCreateMinistryTask(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return json({ error: { code: "forbidden" } }, 403);
  const body = await request.json<{ relatedType: string; relatedId: number; taskType: string; description: string; assignedTo?: number; priority?: any; dueDate?: string }>();
  const result = await Distribution.createMinistryTask(env, body.relatedType, body.relatedId, body.taskType, body.description, body.assignedTo, body.priority, body.dueDate);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleGetPlatformCapability(request: Request, env: Env, platformName: string): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Moderator");
  if (!actor) return json({ error: { code: "forbidden" } }, 403);
  const data = await Distribution.getPlatformCapability(env, platformName);
  return data ? json({ success: true, data }) : json({ error: { code: "not_found" } }, 404);
}

export async function handleListStaleCapabilities(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden" } }, 403);
  const items = await Distribution.listStalePlatformVerifications(env);
  return json({ success: true, items });
}
