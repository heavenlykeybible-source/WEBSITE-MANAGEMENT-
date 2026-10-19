/**
 * Core -> Media/Broadcast Engine boundary.
 *
 * The Media Engine lives in a separate Cloudflare account. This client is
 * intentionally small: Core authenticates the administrator, then signs a
 * short-lived capability for server-to-server calls. Provider credentials and
 * media storage credentials never cross into the browser.
 */
import type { Env } from "../auth-service";

export interface MediaEngineEnv extends Env {
  MEDIA_ENGINE_URL?: string;
  MEDIA_ENGINE_SHARED_SECRET?: string;
}

export interface MediaCapability {
  sub: string;
  role: "Administrator" | "Super Administrator" | "Deputy Super Administrator";
  iat: number;
  exp: number;
  nonce: string;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

/** Create a 60-second capability. Caller must already have verified admin RBAC. */
export async function createMediaEngineCapability(
  env: MediaEngineEnv,
  userId: number,
  role: MediaCapability["role"],
): Promise<string> {
  if (!env.MEDIA_ENGINE_SHARED_SECRET) throw new Error("Media Engine integration is not configured.");
  const now = Math.floor(Date.now() / 1000);
  const payload: MediaCapability = {
    sub: String(userId), role, iat: now, exp: now + 60,
    nonce: hex(crypto.getRandomValues(new Uint8Array(16)).buffer),
  };
  const encoded = btoa(JSON.stringify(payload));
  const signature = await hmac(env.MEDIA_ENGINE_SHARED_SECRET, encoded);
  return `${encoded}.${signature}`;
}

export async function mediaEngineRequest(
  env: MediaEngineEnv,
  capability: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!env.MEDIA_ENGINE_URL) throw new Error("Media Engine URL is not configured.");
  const base = env.MEDIA_ENGINE_URL.replace(/\/$/, "");
  const target = `${base}/${path.replace(/^\//, "")}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${capability}`);
  headers.set("X-Heavenly-Key-Internal", "media-engine-v1");
  return fetch(target, { ...init, headers });
}
