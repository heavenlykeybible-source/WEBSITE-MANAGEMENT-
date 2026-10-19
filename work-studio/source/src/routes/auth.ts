/**
 * Auth routes — thin handlers only. Business logic lives in auth-service.ts.
 * Per Implementation Handbook §3: "A route file receives a request, calls a
 * service function, returns a response."
 */
import { registerUser, loginUser, getProfile, createSession, revokeSession, changePassword, type Env } from "../services/auth-service";
import { checkRateLimit, rateLimitKey } from "../middleware/rate-limit";
import { requireAuth, buildSessionCookie, buildLogoutCookie, getSessionCookie } from "../middleware/session";
import { centralOwnerLogin } from "../services/central-owner-login";
import { RATE_LIMITS } from "../config/security-config";

/**
 * Security headers — applied to EVERY response, per the Independent Audit's
 * Critical Finding C1 (no headers existed anywhere in the real code).
 */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  headers.set("Access-Control-Allow-Origin", "https://www.heavenlykey.org");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Vary", "Origin");
  // CSP is API-appropriate here (this Worker returns JSON, not HTML) — a real
  // HTML-serving Worker/Page would need a fuller policy allowing its own
  // scripts/styles. default-src 'none' is correct for a pure JSON API.
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  }));
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { maxAttempts, windowSeconds } = RATE_LIMITS.register;
  const rl = await checkRateLimit(env, rateLimitKey("register", ip), maxAttempts, windowSeconds);
  if (!rl.allowed) {
    return jsonResponse({ error: { code: "rate_limited", message: "Too many attempts. Please try again later." } }, 429);
  }

  const body = await request.json<{ name: string; email: string; password: string; country: string }>().catch(() => null);
  if (!body || [body.name, body.email, body.password, body.country].some(value => typeof value !== "string")) return jsonResponse({error:{message:"Complete all registration fields."}},400);
  body.email=body.email.trim().toLowerCase();
  const result = await registerUser(env, body);

  if (!result.success) {
    return jsonResponse({ error: { code: "registration_failed", message: result.error } }, 400);
  }

  return jsonResponse({ success: true, userId: result.userId, message: "Account created. You can now sign in." }, 201);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const body = await request.json<{ email: string; password: string }>().catch(() => null);
  if (!body || typeof body.email!=="string" || typeof body.password!=="string") return jsonResponse({error:{message:"Enter your email and password."}},400);
  body.email=body.email.trim().toLowerCase();

  const { maxAttempts, windowSeconds } = RATE_LIMITS.login;
  const rl = await checkRateLimit(env, rateLimitKey("login", ip, body.email), maxAttempts, windowSeconds);
  if (!rl.allowed) {
    return jsonResponse({ error: { code: "rate_limited", message: "Too many attempts. Please try again later." } }, 429);
  }

  let ownerStage='credentials-not-confirmed';
  const centralOwner=body.email==='owner'?await centralOwnerLogin(env,body.password,fetch,stage=>{ownerStage=stage}):null;
  const result = body.email==='owner' ? centralOwner?{success:true,userId:centralOwner,error:undefined}:{success:false,userId:undefined,error:'Owner sign-in failed. Check the normal owner dashboard password.'} : await loginUser(env, body.email, body.password);

  if (!result.success) {
    return jsonResponse({ error: { code: "login_failed", message: result.error } }, 401);
  }

  const sessionId = await createSession(env, result.userId!);
  return jsonResponse(
    { success: true, userId: result.userId },
    200,
    { "Set-Cookie": buildSessionCookie(sessionId) }
  );
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const sessionId = getSessionCookie(request);
  if (sessionId) {
    await revokeSession(env, sessionId); // genuinely deletes the KV entry — the session cannot be reused after this
  }
  return jsonResponse({ success: true, message: "Logged out." }, 200, { "Set-Cookie": buildLogoutCookie() });
}

export async function handleProfile(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) {
    return jsonResponse({ error: { code: "unauthorized", message: "Please log in to view your profile." } }, 401);
  }

  const profile = await getProfile(env, userId);
  if (!profile) {
    return jsonResponse({ error: { code: "not_found", message: "Profile not found." } }, 404);
  }

  return jsonResponse({ success: true, profile });
}



export async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonResponse({ error: { code: "unauthorized", message: "Please sign in again." } }, 401);
  const body = await request.json<{currentPassword?:string;newPassword?:string;confirmPassword?:string}>().catch(() => null);
  if (!body || typeof body.currentPassword!=="string" || typeof body.newPassword!=="string" || typeof body.confirmPassword!=="string") {
    return jsonResponse({error:{message:"Complete all password fields."}},400);
  }
  if (body.newPassword!==body.confirmPassword) return jsonResponse({error:{message:"New password confirmation does not match."}},400);
  const ip=request.headers.get("CF-Connecting-IP")??"unknown";
  const rl=await checkRateLimit(env,rateLimitKey("change-password",ip,String(userId)),5,900);
  if(!rl.allowed)return jsonResponse({error:{message:"Too many password attempts. Try again later."}},429);
  const result=await changePassword(env,userId,body.currentPassword,body.newPassword);
  if(!result.success)return jsonResponse({error:{message:result.error}},400);
  const sessionId=await createSession(env,userId);
  await env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,reason,result) VALUES(?,'account.password.change','user',?,'Password changed and prior sessions invalidated','success')").bind(userId,userId).run();
  return jsonResponse({success:true,message:"Password changed. Other signed-in sessions have been disconnected."},200,{"Set-Cookie":buildSessionCookie(sessionId)});
}
