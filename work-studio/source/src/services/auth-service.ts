/**
 * Auth Service — all authentication business logic lives here, never in routes.
 * Password hashing: PBKDF2-SHA256 via Web Crypto SubtleCrypto — Workers cannot
 * run native bcrypt, so this is the Workers-compatible standard (per Volume 3 §1).
 */

export interface Env {
  DB: D1Database;
  SESSIONS_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  SESSION_SECRET: string;
  PASSWORD_PEPPER: string;
  MEDIA_R2?: R2Bucket;
  MEDIA_R2_STAGING?: R2Bucket;
  LIVE_STATUS_KV?: KVNamespace;
  /** Server-to-server boundary for the separate Media/Broadcast account. */
  MEDIA_ENGINE_URL?: string;
  MEDIA_ENGINE_SHARED_SECRET?: string;
  ENCRYPTION_KEY?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  META_APP_SECRET?: string;
  META_GRAPH_VERSION?: string;
  META_CLIENT_ID?: string;
  META_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  SOCIAL_OAUTH_REDIRECT_URL?: string;
  PUBLIC_SITE_URL?: string;
  /** Provider-neutral Heavenly Key AI gateway. Missing credentials disable only that provider. */
  AI_DEFAULT_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  GOOGLE_AI_API_KEY?: string;
  GOOGLE_AI_BASE_URL?: string;
  CUSTOM_AI_API_KEY?: string;
  CUSTOM_AI_BASE_URL?: string;
  /** External AI/agent connector secrets. Never expose these to browsers or logs. */
  AI_CONNECTOR_SIGNING_SECRET?: string;
  AI_CONNECTOR_TOKEN_PEPPER?: string;
  AI_CONNECTOR_ISSUER?: string;
}

const PBKDF2_ITERATIONS = 100_000;

// ---------- Password hashing ----------

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bufferToHex(bytes.buffer);
}

export async function hashPassword(password: string, salt: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password + pepper),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufferToHex(derivedBits);
}

export async function verifyPassword(
  password: string,
  salt: string,
  pepper: string,
  storedHash: string
): Promise<boolean> {
  const computed = await hashPassword(password, salt, pepper);
  return timingSafeEqual(computed, storedHash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Sessions (KV-backed, genuinely revocable — NOT stateless JWTs) ----------
// Corrected design: the cookie holds a high-entropy random ID; the actual
// session state (userId, expiry) lives in SESSIONS_KV. Logout deletes the KV
// entry, which immediately invalidates the session — a stateless JWT cannot
// do this without a separate revocation list, so KV IS that revocation list,
// used from the start rather than added later.

async function getUserSessionEpoch(env: Env, userId: number): Promise<string> {
  return (await env.SESSIONS_KV.get(`session-epoch:${userId}`)) ?? "";
}

export async function createSession(env: Env, userId: number, ttlSeconds = 3600): Promise<string> {
  const sessionId = bufferToHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const epoch = await getUserSessionEpoch(env, userId);
  await env.SESSIONS_KV.put(
    `session:${sessionId}`,
    JSON.stringify({ userId, createdAt: Date.now(), epoch }),
    { expirationTtl: ttlSeconds }
  );
  return sessionId;
}

export async function getSessionUserId(env: Env, sessionId: string): Promise<number | null> {
  const raw = await env.SESSIONS_KV.get(`session:${sessionId}`);
  if (!raw) return null;
  const data = JSON.parse(raw) as { userId: number; createdAt: number; epoch?: string };
  const currentEpoch = await getUserSessionEpoch(env, data.userId);
  if ((data.epoch ?? "") !== currentEpoch) {
    await env.SESSIONS_KV.delete(`session:${sessionId}`);
    return null;
  }
  return data.userId;
}

export async function revokeSession(env: Env, sessionId: string): Promise<void> {
  await env.SESSIONS_KV.delete(`session:${sessionId}`);
}

export async function revokeAllUserSessions(env: Env, userId: number): Promise<void> {
  const epoch = bufferToHex(crypto.getRandomValues(new Uint8Array(24)).buffer);
  await env.SESSIONS_KV.put(`session-epoch:${userId}`, epoch);
}

export async function changePassword(env: Env, userId: number, currentPassword: string, newPassword: string): Promise<{success:boolean;error?:string}> {
  if (!env.PASSWORD_PEPPER) return { success:false, error:"Password security is not configured." };
  if (typeof currentPassword!=="string" || typeof newPassword!=="string") return { success:false, error:"Enter your current and new password." };
  if (newPassword.length < 8 || !/\d/.test(newPassword)) return { success:false, error:"New password must be at least 8 characters and include a number." };
  if (currentPassword === newPassword) return { success:false, error:"Choose a new password that is different from your current password." };
  const row = await env.DB.prepare("SELECT password_hash,password_salt FROM auth WHERE user_id=?").bind(userId).first<{password_hash:string;password_salt:string}>();
  if (!row) return { success:false, error:"Account credentials were not found." };
  const valid = await verifyPassword(currentPassword,row.password_salt,env.PASSWORD_PEPPER,row.password_hash);
  if (!valid) return { success:false, error:"Current password is incorrect." };
  const salt=generateSalt(),hash=await hashPassword(newPassword,salt,env.PASSWORD_PEPPER);
  await env.DB.prepare("UPDATE auth SET password_hash=?,password_salt=?,failed_login_attempts=0,locked_until=NULL,reset_token=NULL,reset_token_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(hash,salt,userId).run();
  await revokeAllUserSessions(env,userId);
  return { success:true };
}


// ---------- Registration / Login business logic ----------

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  country: string;
}

export interface RegisterResult {
  success: boolean;
  error?: string;
  userId?: number;
}

export async function registerUser(env: Env, input: RegisterInput): Promise<RegisterResult> {
  if (!env.PASSWORD_PEPPER) return { success:false, error:"Sign-in is not configured. Please contact the ministry." };
  // Validation — the Worker validates for safety, the frontend validates for UX (Handbook §4)
  if (!input.name || input.name.length < 2 || input.name.length > 60) {
    return { success: false, error: "Name must be between 2 and 60 characters." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { success: false, error: "Please provide a valid email address." };
  }
  if (input.password.length < 8 || !/\d/.test(input.password)) {
    return { success: false, error: "Password must be at least 8 characters and include a number." };
  }
  if (!input.country) {
    return { success: false, error: "Country is required." };
  }

  const existing = await env.DB.prepare("SELECT user_id FROM users WHERE email = ?")
    .bind(input.email)
    .first();
  if (existing) {
    return { success: false, error: "This email is already registered." };
  }

  const memberRole = await env.DB.prepare("SELECT role_id FROM roles WHERE role_name = 'Member'").first<{ role_id: number }>();
  if (!memberRole) {
    return { success: false, error: "Server configuration error: Member role not found." };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(input.password, salt, env.PASSWORD_PEPPER);

  const userResult = await env.DB.prepare(
    `INSERT INTO users (name, email, country, role_id, status) VALUES (?, ?, ?, ?, 'active') RETURNING user_id`
  )
    .bind(input.name, input.email, input.country, memberRole.role_id)
    .first<{ user_id: number }>();

  if (!userResult) {
    return { success: false, error: "Failed to create account." };
  }

  await env.DB.prepare(
    `INSERT INTO auth (user_id, password_hash, password_salt, email_verified) VALUES (?, ?, ?, 0)`
  )
    .bind(userResult.user_id, passwordHash, salt)
    .run();

  // NOTE: email verification dispatch is a separate concern (transactional email
  // provider — Volume 3 §1 flags this as an open implementation decision) —
  // intentionally not blocking registration on it here.

  return { success: true, userId: userResult.user_id };
}

export interface LoginResult {
  success: boolean;
  error?: string;
  userId?: number;
}

export async function loginUser(env: Env, email: string, password: string): Promise<LoginResult> {
  if (!env.PASSWORD_PEPPER) return { success:false, error:"Sign-in is not configured. Please contact the ministry." };
  const row = await env.DB.prepare(
    `SELECT u.user_id, a.password_hash, a.password_salt, a.failed_login_attempts, a.locked_until
     FROM users u JOIN auth a ON a.user_id = u.user_id
     WHERE u.email = ? AND u.status = 'active'`
  )
    .bind(email)
    .first<{
      user_id: number;
      password_hash: string;
      password_salt: string;
      failed_login_attempts: number;
      locked_until: string | null;
    }>();

  // Generic error regardless of which part failed — account-enumeration protection (Volume 3 §1)
  const genericError = "Email or password is incorrect.";

  if (!row) return { success: false, error: genericError };

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return { success: false, error: "Too many failed attempts. Please try again later." };
  }

  const valid = await verifyPassword(password, row.password_salt,env.PASSWORD_PEPPER, row.password_hash);

  if (!valid) {
    const attempts = (row.failed_login_attempts ?? 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await env.DB.prepare(
      `UPDATE auth SET failed_login_attempts = ?, locked_until = ? WHERE user_id = ?`
    )
      .bind(attempts, lockUntil, row.user_id)
      .run();
    return { success: false, error: genericError };
  }

  await env.DB.prepare(
    `UPDATE auth SET failed_login_attempts = 0, locked_until = NULL, last_login = datetime('now') WHERE user_id = ?`
  )
    .bind(row.user_id)
    .run();

  return { success: true, userId: row.user_id };
}

export interface UserProfile {
  userId: number;
  name: string;
  email: string;
  country: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  createdAt: string;
  roleName: string;
}

export async function getProfile(env: Env, userId: number): Promise<UserProfile | null> {
  const row = await env.DB.prepare(
    `SELECT u.user_id, u.name, u.email, u.country, u.bio, u.profile_photo_url, u.created_at, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ? AND u.status = 'active'`
  )
    .bind(userId)
    .first<{
      user_id: number;
      name: string;
      email: string;
      country: string;
      bio: string | null;
      profile_photo_url: string | null;
      created_at: string;
      role_name: string;
    }>();

  if (!row) return null;

  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    country: row.country,
    bio: row.bio,
    profilePhotoUrl: row.profile_photo_url,
    createdAt: row.created_at,
    roleName: row.role_name,
  };
}

