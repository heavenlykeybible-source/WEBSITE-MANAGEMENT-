import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import * as Storage from "../services/storage-retention-service";
import type { StorageEnv } from "../services/storage-retention-service";


function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}

export async function handleUploadMedia(request: Request, env: StorageEnv, mediaId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const media = await env.DB.prepare("SELECT user_id, file_type FROM media WHERE media_id = ?").bind(mediaId).first<{ user_id: number; file_type: string }>();
  if (!media) return json({ error: { code: "not_found", message: "Media not found." } }, 404);

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const contentLength = Number(request.headers.get("content-length") || "0");
  const result = await Storage.uploadMediaObject(env, mediaId, request.body, contentType, contentLength);
  return result.ok ? json({ success: true, storageKey: result.storageKey }, 201) : json({ error: { code: "invalid", message: result.reason } }, 400);
}

export async function handleSetMediaKeep(request: Request, env: StorageEnv, mediaId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const body = await request.json<{ keep?: boolean }>();
  if (typeof body.keep !== "boolean") return json({ error: { code: "invalid", message: "keep must be boolean." } }, 400);
  const media = await env.DB.prepare("SELECT user_id FROM media WHERE media_id = ?").bind(mediaId).first<{ user_id: number }>();
  if (!media) return json({ error: { code: "not_found", message: "Media not found." } }, 404);
  const ok = await Storage.setMediaKeep(env, mediaId, body.keep);
  return ok ? json({ success: true, keep: body.keep }) : json({ error: { code: "not_found", message: "Media is unavailable." } }, 404);
}

export async function handleDeleteMedia(request: Request, env: StorageEnv, mediaId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return json({ error: { code: "unauthorized", message: "Please log in." } }, 401);
  const media = await env.DB.prepare("SELECT user_id FROM media WHERE media_id = ?").bind(mediaId).first<{ user_id: number }>();
  if (!media) return json({ error: { code: "not_found", message: "Media not found." } }, 404);
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (media.user_id !== userId && !actor) return json({ error: { code: "forbidden", message: "Not allowed." } }, 403);
  const result = await Storage.deleteMediaObject(env, mediaId, true);
  return result.ok ? json({ success: true }) : json({ error: { code: "invalid", message: result.reason } }, 400);
}

export async function handleCleanup(request: Request, env: StorageEnv): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const result = await Storage.cleanupExpiredStorage(env);
  return json({ success: true, ...result });
}

export async function handleCreateMultipartMedia(request: Request, env: StorageEnv, mediaId: number): Promise<Response> { return json({ error: { code: "gone", message: "Multipart media uploads are disabled to keep Heavenly Key storage resource-light." } }, 410); }

export async function handleUploadMultipartPart(request: Request, env: StorageEnv, mediaId:number, dbUploadId:number, r2UploadId:string, partNumber:number): Promise<Response> { return json({ error: { code: "gone", message: "Multipart media uploads are disabled to keep Heavenly Key storage resource-light." } }, 410); }

export async function handleCompleteMultipartMedia(request: Request, env: StorageEnv, mediaId:number, dbUploadId:number, r2UploadId:string): Promise<Response> { return json({ error: { code: "gone", message: "Multipart media uploads are disabled to keep Heavenly Key storage resource-light." } }, 410); }

export async function handleAbortMultipartMedia(request: Request, env: StorageEnv, mediaId:number, dbUploadId:number, r2UploadId:string): Promise<Response> { return json({ error: { code: "gone", message: "Multipart media uploads are disabled to keep Heavenly Key storage resource-light." } }, 410); }
