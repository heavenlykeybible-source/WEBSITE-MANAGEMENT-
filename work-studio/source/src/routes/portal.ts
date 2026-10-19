import type { Env } from "../services/auth-service";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import { proxyToMediaEngine, proxyPublicToMediaEngine } from "../services/integrations/media-engine-proxy";

const json = (data: unknown, status = 200) => withSecurityHeaders(Response.json(data, { status }));

export async function handleCommunityCategories(_request: Request, env: Env): Promise<Response> {
  const r = await env.DB.prepare("SELECT category_id, name, module FROM categories WHERE active=1 ORDER BY module, display_order").all();
  return json({items:r.results});
}

export async function handlePendingTestimonies(request: Request, env: Env): Promise<Response> {
  if (!await requireMinimumRole(request,env,"Moderator")) return json({error:{message:"Moderator access required."}},403);
  const r = await env.DB.prepare("SELECT testimony_id, title, story, created_at FROM testimonies WHERE approval_status='pending' ORDER BY created_at LIMIT 50").all();
  return json({items:r.results});
}

export async function handleAdminMedia(request: Request, env: Env, path: string): Promise<Response> {
  const actor = await requireMinimumRole(request,env,"Administrator");
  if (!actor) return json({error:{message:"Administrator access required."}},403);
  const origin=request.headers.get("Origin");
  if (request.method!=="GET" && origin && origin!==new URL(request.url).origin) return json({error:{message:"Use the admin dashboard to perform this action."}},403);
  if (!env.MEDIA_ENGINE_URL || !env.MEDIA_ENGINE_SHARED_SECRET) return json({error:{message:"Media Engine connection needs configuration."}},503);
  try {
    (request as Request & {__hkActor?: typeof actor}).__hkActor=actor;
    return await proxyToMediaEngine(request,env,path);
  } catch {
    return json({error:{message:"Media Engine is unavailable. Please retry shortly."}},503);
  }
}

export async function handleBroadcastProgramme(request: Request, env: Env): Promise<Response> {
  const channel=new URL(request.url).searchParams.get("channel")==="radio" ? "radio" : "video";
  try { return await proxyPublicToMediaEngine(env,"/api/broadcast/programme?channel="+channel,request); }
  catch { return json({error:{message:"The broadcast service is unavailable."}},503); }
}

export async function handleBroadcastLiveKitViewerToken(request: Request, env: Env): Promise<Response> {
  try {
    if (!env.MEDIA_ENGINE_URL) return json({error:{message:"Broadcast service is not configured."}},503);
    const target=env.MEDIA_ENGINE_URL.replace(/[/]$/,"")+"/api/media-engine/livekit/viewer-token";
    const upstream=await fetch(target,{method:"POST",headers:{"Content-Type":"application/json","X-Heavenly-Key-Internal":"media-engine-public-v1"},body:"{}"});
    return new Response(upstream.body,{status:upstream.status,headers:{"Content-Type":upstream.headers.get("Content-Type")??"application/json","Cache-Control":"no-store"}});
  } catch { return json({error:{message:"The broadcast service is unavailable."}},503); }
}

export async function handleBroadcastObject(request: Request, env: Env, id: number): Promise<Response> {
  try { return await proxyPublicToMediaEngine(env,`/api/broadcast/media/${id}/object`,request); }
  catch { return json({error:{message:"Media is unavailable."}},503); }
}
