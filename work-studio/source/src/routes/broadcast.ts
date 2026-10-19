import { requireMinimumRole } from "../middleware/rbac";
import { requireAuth } from "../middleware/session";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/broadcast-service";
import * as Broadcast from "../services/broadcast-service";
import { proxyToMediaEngine, proxyPublicToMediaEngine } from "../services/integrations/media-engine-proxy";

function json(data: unknown, status=200){return withSecurityHeaders(new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}}));}

export async function handleListChannels(request: Request, env: Env): Promise<Response> {
  const items = await Broadcast.listActiveBroadcastChannels(env);
  return json({success:true,items});
}
export async function handleCreateCampaign(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  const body=await request.json<any>(); const result=await Broadcast.createCampaign(env,{...body,createdBy:actor.userId});
  return result.success?json({success:true,...result.data},201):json({error:{code:"invalid",message:result.error}},400);
}
export async function handleApproveCampaign(request: Request, env: Env, campaignId:number): Promise<Response> {
  const actor=await requireMinimumRole(request,env,"Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  const result=await Broadcast.approveCampaign(env,campaignId,actor.userId,actor.level); return result.success?json({success:true}):json({error:{code:"invalid",message:result.error}},400);
}
export async function handleGetLiveStatus(request: Request, env: Env): Promise<Response>{
 if((env as any).MEDIA_ENGINE_URL){
  // Full source URLs are limited to authenticated studio administrators.
  const actor=await requireMinimumRole(request,env,"Administrator");
  if(actor){(request as any).__hkActor=actor;return proxyToMediaEngine(request,env as any,"/api/broadcast/live");}
  return proxyPublicToMediaEngine(env as any,"/api/broadcast/live");
 }
 return json({success:true,...await Broadcast.getLiveStatus(env)});
}
export async function handleGetLiveFallback(request: Request, env: Env, sessionId:number): Promise<Response>{
  const result=await Broadcast.getLiveFallbackAccess(env,sessionId);
  return result.success?json({success:true,...result.data}):json({error:{code:"not_found",message:result.error}},404);
}
export async function handleSetLiveStatus(request: Request, env: Env): Promise<Response>{
  const actor=await requireMinimumRole(request,env,"Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  if ((env as any).MEDIA_ENGINE_URL) { (request as any).__hkActor = actor; const body=await request.json<any>(); if(typeof body.isLive!=="boolean")return json({error:{code:"invalid",message:"isLive must be boolean."}},400); if(body.isLive) return proxyToMediaEngine(request,env as any,"/api/broadcast/live",{title:body.title,source_type:body.sourceType??"camera",source_ref:body.sourceRefId,visual_media_id:body.visualMediaId,fallback_media_id:body.fallbackMediaId,destination:body.destination}); return proxyToMediaEngine(request,env as any,"/api/broadcast/live/"+String(body.sessionId??0)+"/stop"); }
  const body=await request.json<{isLive:boolean;title?:string;campaignId?:number;fallbackMediaId?:number;sourceType?:"camera"|"picture_audio"|"bible"|"hymn"|"video";sourceRefId?:number;visualMediaId?:number;sessionId?:number}>();
  if(typeof body.isLive!=="boolean")return json({error:{code:"invalid",message:"isLive must be boolean."}},400);
  const result=await Broadcast.setLiveStatus(env,body.isLive,body.title,{campaignId:body.campaignId,fallbackMediaId:body.fallbackMediaId,sourceType:body.sourceType,sourceRefId:body.sourceRefId,visualMediaId:body.visualMediaId});
  return result.success?json({success:true,...result.data}):json({error:{code:"invalid",message:result.error}},400);
}
export async function handleLiveHeartbeat(request: Request, env: Env, sessionId:number): Promise<Response>{
  const actor=await requireMinimumRole(request,env,"Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  if ((env as any).MEDIA_ENGINE_URL) { (request as any).__hkActor = actor; return proxyToMediaEngine(request,env as any,`/api/broadcast/live/${sessionId}/heartbeat`); }
  const result=await Broadcast.heartbeatLiveBroadcast(env,sessionId); return result.success?json({success:true,...result.data}):json({error:{code:"invalid",message:result.error}},409);
}

export async function handleSwitchLiveToPrerecorded(request: Request, env: Env, sessionId: number): Promise<Response> {
  const actor=await requireMinimumRole(request,env,"Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  if ((env as any).MEDIA_ENGINE_URL) {
    (request as any).__hkActor = actor;
    const body=await request.json<{mediaId:number}>();
    if(!Number.isInteger(body.mediaId)) return json({error:{code:"invalid",message:"mediaId is required."}},400);
    return proxyToMediaEngine(request,env as any,`/api/broadcast/live/${sessionId}/switch-to-video`,{media_id:body.mediaId});
  }
  return json({error:{code:"not_configured",message:"Media Engine is not configured."}},503);
}

export async function handleSwitchPrerecordedToLive(request: Request, env: Env, sessionId: number): Promise<Response> {
  const actor=await requireMinimumRole(request,env,"Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  if ((env as any).MEDIA_ENGINE_URL) {
    (request as any).__hkActor = actor;
    return proxyToMediaEngine(request,env as any,`/api/broadcast/live/${sessionId}/switch-to-livekit`,{});
  }
  return json({error:{code:"not_configured",message:"Media Engine is not configured."}},503);
}

export async function handleStopLiveBroadcast(request: Request, env: Env, sessionId: number): Promise<Response> {
  const actor=await requireMinimumRole(request,env,"Administrator"); if(!actor)return json({error:{code:"forbidden",message:"Administrator access required."}},403);
  if ((env as any).MEDIA_ENGINE_URL) {
    (request as any).__hkActor = actor;
    return proxyToMediaEngine(request,env as any,`/api/broadcast/live/${sessionId}/stop`);
  }
  return json({error:{code:"not_configured",message:"Media Engine is not configured."}},503);
}


export async function handleMediaEngineStatus(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  if (!(env as any).MEDIA_ENGINE_URL) {
    return json({ error: { code: "not_configured", message: "Media Engine is not configured." } }, 503);
  }
  try {
    (request as any).__hkActor = actor;
    return await proxyToMediaEngine(request, env as any, "/api/media-engine/status");
  } catch {
    return json({ error: { code: "media_engine_unavailable", message: "Media Engine is currently unavailable." } }, 503);
  }
}

export async function handleBroadcastStudioCapabilities(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  if (!(env as any).MEDIA_ENGINE_URL) {
    return json({ error: { code: "not_configured", message: "Media Engine is not configured." } }, 503);
  }
  try {
    (request as any).__hkActor = actor;
    return await proxyToMediaEngine(request, env as any, "/api/media-engine/studio/capabilities");
  } catch {
    return json({ error: { code: "media_engine_unavailable", message: "Media Engine is currently unavailable." } }, 503);
  }
}

