import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Campaign from "../services/campaign-manager-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const forbidden = () => json({ error: { code: "forbidden", message: "Insufficient permissions." } }, 403);

export async function handleGenerateCampaignItems(request: Request, env: Env, campaignId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const body = await request.json<{ mediaIds: number[]; cadenceType: any; startDate: string; intervalDays?: number }>();
  const result = await Campaign.generateCampaignItems(env, campaignId, body.mediaIds, body.cadenceType, body.startDate, body.intervalDays);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleGetCalendar(request: Request, env: Env, campaignId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const items = await Campaign.getCampaignCalendar(env, campaignId);
  return json({ success: true, items });
}

export async function handlePauseItem(request: Request, env: Env, itemId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  await Campaign.pauseCampaignItem(env, itemId);
  return json({ success: true });
}

export async function handleResumeItem(request: Request, env: Env, itemId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  await Campaign.resumeCampaignItem(env, itemId);
  return json({ success: true });
}

export async function handleCancelItem(request: Request, env: Env, itemId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  await Campaign.cancelCampaignItem(env, itemId);
  return json({ success: true });
}
