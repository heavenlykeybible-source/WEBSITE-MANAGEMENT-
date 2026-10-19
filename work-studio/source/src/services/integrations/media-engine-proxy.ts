import type { MediaEngineEnv } from './media-engine-client';
import { createMediaEngineCapability, mediaEngineRequest } from './media-engine-client';

export async function proxyToMediaEngine(request: Request, env: MediaEngineEnv, path: string, body?: unknown): Promise<Response> {
  const actor = (request as Request & { __hkActor?: { userId:number; roleName:string; level:number } }).__hkActor;
  if (!actor) return Response.json({error:{code:'forbidden',message:'Administrator access required.'}},{status:403});
  const role = actor.roleName as 'Administrator'|'Super Administrator'|'Deputy Super Administrator';
  if (!['Administrator','Super Administrator','Deputy Super Administrator'].includes(role)) return Response.json({error:{code:'forbidden',message:'Administrator access required.'}},{status:403});
  const capability = await createMediaEngineCapability(env, actor.userId, role);
  const init: RequestInit = { method: request.method, headers: {'Content-Type':request.headers.get('Content-Type')??'application/json'} };
  if (body !== undefined) init.body = JSON.stringify(body); else if (!['GET','HEAD'].includes(request.method)) init.body = request.body;
  if (request.headers.has('Range')) (init.headers as Record<string,string>)['Range']=request.headers.get('Range')!;
  if (request.headers.has('Content-Length')) (init.headers as Record<string,string>)['Content-Length']=request.headers.get('Content-Length')!;
  const upstream = await mediaEngineRequest(env, capability, path, init);
  const headers = new Headers(upstream.headers); headers.set('Content-Type',upstream.headers.get('Content-Type')??'application/json');
  headers.set('Cache-Control','no-store');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(upstream.body,{status:upstream.status,headers});
}

export async function proxyPublicToMediaEngine(env: MediaEngineEnv, path: string, request?: Request): Promise<Response> {
  if (!env.MEDIA_ENGINE_URL) throw new Error('Media Engine integration is not configured.');
  const base = env.MEDIA_ENGINE_URL.replace(/\/$/, '');
  const target = `${base}/${path.replace(/^\//, '')}`;
  const headersIn = new Headers({'X-Heavenly-Key-Internal':'media-engine-public-v1'});
  if(request?.headers.has('Range')) headersIn.set('Range',request.headers.get('Range')!);
  const upstream = await fetch(target, { method: request?.method==='HEAD'?'HEAD':'GET', headers: headersIn });
  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', upstream.headers.get('Content-Type')??'application/json');
  return new Response(upstream.body, { status: upstream.status, headers });
}

