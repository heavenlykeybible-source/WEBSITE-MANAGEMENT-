import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { StorageEnv } from "../services/storage-retention-service";
import * as Playout from "../services/playout-service";
import { proxyToMediaEngine } from "../services/integrations/media-engine-proxy";

function json(data: unknown, status=200) { return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json' } })); }

export async function handleSchedulePlayout(request: Request, env: StorageEnv): Promise<Response> {
  const actor = await requireMinimumRole(request, env, 'Administrator');
  if (!actor) return json({ error:{ code:'forbidden', message:'Administrator access required.' } },403);
  if ((env as any).MEDIA_ENGINE_URL) { (request as any).__hkActor = actor; const body=await request.json<any>(); return proxyToMediaEngine(request,env as any,'/api/playout',{media_id:body.mediaId,title:body.title,starts_at:body.startsAt,ends_at:body.endsAt}); }
  const body = await request.json<{mediaId:number; startsAt?:string; endsAt?:string; keepAsset?:boolean}>();
  const result = await Playout.schedulePlayout(env, body);
  return result.success ? json({success:true,...result.data},201) : json({error:{code:'invalid',message:result.error}},400);
}

export async function handleListPlayout(request: Request, env: StorageEnv): Promise<Response> {
  const actor = await requireMinimumRole(request, env, 'Administrator');
  if (!actor) return json({ error:{ code:'forbidden', message:'Administrator access required.' } },403);
  if ((env as any).MEDIA_ENGINE_URL) { (request as any).__hkActor = actor; return proxyToMediaEngine(request,env as any,'/api/playout'); }
  const items = await Playout.listUpcomingPlayout(env);
  return json({success:true,items});
}
