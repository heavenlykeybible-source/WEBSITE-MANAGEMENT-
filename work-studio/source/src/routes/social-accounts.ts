import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Social from "../services/social-accounts-service";
import * as Campaign from "../services/campaign-manager-service";
import { proxyToMediaEngine } from "../services/integrations/media-engine-proxy";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const forbidden = () => json({ error: { code: "forbidden", message: "Insufficient permissions." } }, 403);

export async function handleConnectAccount(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  if ((env as any).MEDIA_ENGINE_URL) { (request as any).__hkActor=actor; const body=await request.json<any>(); return proxyToMediaEngine(request,env as any,"/api/social/accounts",body); }
  const body = await request.json<any>();
  const result = await Social.connectSocialAccount(env, body);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListAutomatableAccounts(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  if ((env as any).MEDIA_ENGINE_URL) { (request as any).__hkActor=actor; return proxyToMediaEngine(request,env as any,"/api/social/accounts"); }
  const items = await Social.listAutomatableAccounts(env);
  return json({ success: true, items });
}

export async function handleListManualOnlyAccounts(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const items = await Social.listManualOnlyAccounts(env);
  return json({ success: true, items });
}

export async function handleGenerateManualTasks(request: Request, env: Env, campaignId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const result = await Social.generateManualTasksForCampaign(env, campaignId);
  return json({ success: true, ...result.data });
}

export async function handleCompleteManualTask(request: Request, env: Env, taskId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const result = await Social.completeManualTask(env, taskId, actor.userId);
  return result.success
    ? json({ success: true })
    : json({ error: { code: "invalid", message: result.error } }, result.error?.includes("another worker") ? 403 : 400);
}

export async function handleCreateHashtagCollection(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const body = await request.json<{ name: string; tags: string[] }>();
  const result = await Campaign.createHashtagCollection(env, body.name, body.tags);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleGetHashtagCollection(request: Request, env: Env, collectionId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return forbidden();
  const tags = await Campaign.getHashtagsForCollection(env, collectionId);
  return json({ success: true, tags });
}
