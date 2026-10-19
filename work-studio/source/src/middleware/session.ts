/**
 * Session middleware — looks up the session ID (from the cookie) against
 * SESSIONS_KV. Corrected design: genuinely revocable, not a stateless JWT.
 * See auth-service.ts createSession/getSessionUserId/revokeSession.
 */
import { getSessionUserId, type Env } from "../services/auth-service";
import { SESSION } from "../config/security-config";

export function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION.cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

export async function requireAuth(request: Request, env: Env): Promise<number | null> {
  const sessionId = getSessionCookie(request);
  if (!sessionId) return null;
  const userId=await getSessionUserId(env,sessionId);
  if(!userId)return null;
  const active=await env.DB.prepare("SELECT 1 FROM users WHERE user_id=? AND status='active'").bind(userId).first();
  return active?userId:null;
}

export function buildSessionCookie(sessionId: string, ttlSeconds = SESSION.defaultTtlSeconds): string {
  // Domain scoping to `.heavenlykey.org` (not set here) is required once
  // Website/Platform/Ministry Suite run on separate subdomains — see
  // Architecture Audit Finding A3, still an open item before multi-subdomain deployment.
  return `${SESSION.cookieName}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;
}

export function buildLogoutCookie(): string {
  return `${SESSION.cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

