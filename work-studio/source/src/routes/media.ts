import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Media from "../services/media-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}

export async function handleRegisterMedia(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const userId = actor.userId;
  const body = await request.json<any>();
  const result = await Media.registerMediaItem(env, { ...body, userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListPublicMedia(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") ?? undefined;
  const items = await Media.listPublicMedia(env, topic);
  return json({ success: true, items });
}

export async function handleApproveMedia(request: Request, env: Env, mediaId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const body = await request.json<{ licenseType: "public_domain" | "ministry_owned" | "licensed" }>();
  const result = await Media.approveMediaForPublication(env, mediaId, body.licenseType);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}


export async function handleGetMediaObject(request: Request, env: Env, mediaId: number): Promise<Response> {
  const result = await Media.getPublicMediaObject(env, mediaId, request.headers.get("Range"));
  if (!result) return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Media is unavailable.' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  const headers = new Headers();
  headers.set('Content-Type', result.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('Content-Disposition', `inline; filename="${result.filename}"`);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('ETag', result.object.httpEtag);
  // Public media is playable across the ministry's primary website and Worker domains.
  headers.set('Access-Control-Allow-Origin', 'https://www.heavenlykey.org');
  headers.set('Vary', 'Origin');
  const range = result.object.range;
  // R2Range is a discriminated union: offset/length OR suffix.
  let start: number | null = null;
  let length: number | null = null;
  if (range && 'offset' in range && typeof range.offset === 'number') {
    start = range.offset;
    length = 'length' in range && typeof range.length === 'number'
      ? range.length : result.object.size - start;
  } else if (range && 'suffix' in range && typeof range.suffix === 'number') {
    length = Math.min(range.suffix, result.object.size);
    start = result.object.size - length;
  }
  if (start !== null && length !== null && length > 0) {
    headers.set('Content-Range', 'bytes ' + start + '-' + (start + length - 1) + '/' + result.object.size);
    headers.set('Content-Length', String(length));
    return new Response(result.object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(result.object.size));
  return new Response(result.object.body, { status: 200, headers });
}
