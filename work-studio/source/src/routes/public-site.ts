import type { Env as AuthEnv } from "../services/auth-service";
import { checkRateLimit, rateLimitKey } from "../middleware/rate-limit";
import { encryptField, decryptField } from "../services/encryption-service";
import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import { MAX_LENGTHS } from "../config/security-config";

interface PublicSiteEnv extends AuthEnv {
  ENCRYPTION_KEY: string;
}

type SubmissionType = "contact" | "newsletter" | "partner" | "prayer" | "testimony";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function cleanString(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function handlePublicSubmission(
  request: Request,
  env: PublicSiteEnv,
  submissionType: SubmissionType,
): Promise<Response> {
  if(submissionType==='testimony'&&!await requireAuth(request,env))return json({error:{message:'Sign in before sharing a testimony.'}},401);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rl = await checkRateLimit(
    env,
    rateLimitKey("public-site-" + submissionType, ip),
    submissionType === "newsletter" ? 10 : 5,
    3600,
  );
  if (!rl.allowed) {
    return json(
      { error: { code: "rate_limited", message: "Please try again later." } },
      429,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json<Record<string, unknown>>();
  } catch {
    return json({ error: { code: "invalid_json", message: "Invalid request." } }, 400);
  }

  const email = cleanString(body.email, 320);
  const emailRequired = submissionType !== "prayer";
  if ((emailRequired && !validEmail(email)) || (email && !validEmail(email))) {
    return json(
      { error: { code: "invalid", message: "A valid email address is required." } },
      400,
    );
  }

  const normalized: Record<string, string> = {};
  if (email) normalized.email = email;

  if (submissionType !== "newsletter") {
    const name = cleanString(body.name, 120);
    if (!name && submissionType !== "prayer") {
      return json(
        { error: { code: "invalid", message: "Your name is required." } },
        400,
      );
    }
    normalized.name = name || "Anonymous";
    normalized.phone = cleanString(body.phone, 40);
    normalized.country = cleanString(body.country ?? body.location, 100);
    normalized.subject = cleanString(body.subject, MAX_LENGTHS.shortText);

    const message = cleanString(
      body.message ?? body.request ?? body.details ?? body.note ?? body.content,
      MAX_LENGTHS.standardText,
    );
    if (!message) {
      return json(
        { error: { code: "invalid", message: "Please enter your message." } },
        400,
      );
    }
    normalized.message = message;
  }

  if (submissionType === "partner") {
    normalized.interest = cleanString(
      body.interest ?? body.partnership_type ?? body.type,
      MAX_LENGTHS.shortText,
    );
  }

  const encrypted = await encryptField(
    JSON.stringify(normalized),
    env.ENCRYPTION_KEY,
  );

  const row = await env.DB.prepare(
    `INSERT INTO public_site_submissions
      (submission_type, payload_encrypted, payload_iv, status)
     VALUES (?, ?, ?, 'pending')
     RETURNING submission_id`,
  )
    .bind(
      submissionType,
      encrypted.ciphertext,
      encrypted.iv,
    )
    .first<{ submission_id: number }>();

  if (!row) {
    return json(
      { error: { code: "server_error", message: "Submission could not be saved." } },
      500,
    );
  }

  return json({ success: true, submissionId: row.submission_id }, 201);
}

export async function handleListPublicSubmissions(
  request: Request,
  env: PublicSiteEnv,
): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Deputy Super Administrator");
  if (!actor) {
    return json(
      { error: { code: "forbidden", message: "Deputy Super Administrator access required." } },
      403,
    );
  }

  const rows = await env.DB.prepare(
    `SELECT submission_id, submission_type, payload_encrypted, payload_iv,
            status, created_at, reviewed_at
       FROM public_site_submissions
      ORDER BY created_at DESC
      LIMIT 100`,
  ).all<{
    submission_id: number;
    submission_type: SubmissionType;
    payload_encrypted: string;
    payload_iv: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
  }>();

  const items = [];
  for (const row of rows.results) {
    const plaintext = await decryptField(
      row.payload_encrypted,
      row.payload_iv,
      env.ENCRYPTION_KEY,
    );
    items.push({
      submissionId: row.submission_id,
      type: row.submission_type,
      status: row.status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      payload: JSON.parse(plaintext),
    });
  }

  return json({ success: true, items });
}

