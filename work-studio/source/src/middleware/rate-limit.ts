/**
 * Rate limiting via Cloudflare KV, per Volume 3 §10.
 * Reused across login, registration, and any future sensitive endpoint —
 * not reimplemented per route.
 */
import type { Env } from "../services/auth-service";

export async function checkRateLimit(
  env: Env,
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: maxAttempts - count - 1 };
}

/** Standard rate-limit key pattern: ratelimit:{action}:{ip}:{identifier} */
export function rateLimitKey(action: string, ip: string, identifier?: string): string {
  return identifier ? `ratelimit:${action}:${ip}:${identifier}` : `ratelimit:${action}:${ip}`;
}
