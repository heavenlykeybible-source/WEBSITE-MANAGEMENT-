import type { Env as AuthEnv } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { encryptField } from "./encryption-service";

export interface Env extends AuthEnv {
  ENCRYPTION_KEY: string; // hex-encoded 256-bit key, set via `wrangler secret put`
}

export interface DecisionInput {
  userId: number | null; // nullable — a first-time visitor may have no account
  name?: string;
  country: string;
  heardVia?: string;
  decisionType?: string;
  wantsFollowup: boolean;
  contactMethod?: string;
  contactValue?: string;
  idempotencyKey?: string;
}

export async function submitDecision(env: Env, input: DecisionInput): Promise<ServiceResult<{ decisionId: number; wasExisting: boolean }>> {
  if (!input.country) return { success: false, error: "Country is required." };

  // Idempotency: a client retry on a dropped connection (the exact scenario
  // this platform's target networks make likely) returns the existing
  // record instead of creating a duplicate.
  if (input.idempotencyKey) {
    const existing = await env.DB.prepare("SELECT decision_id FROM decisions WHERE idempotency_key = ?")
      .bind(input.idempotencyKey)
      .first<{ decision_id: number }>();
    if (existing) return { success: true, data: { decisionId: existing.decision_id, wasExisting: true } };
  }

  const nameEncrypted = input.name ? await encryptField(input.name, env.ENCRYPTION_KEY) : null;
  const contactEncrypted = input.contactValue ? await encryptField(input.contactValue, env.ENCRYPTION_KEY) : null;

  let row: { decision_id: number } | null;
  try {
    row = await env.DB.prepare(
      `INSERT INTO decisions
       (user_id, name_encrypted, name_iv, country, heard_via, decision_type, wants_followup, contact_method, contact_value_encrypted, contact_value_iv, idempotency_key, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
       RETURNING decision_id`
    )
      .bind(
        input.userId,
        nameEncrypted?.ciphertext ?? null,
        nameEncrypted?.iv ?? null,
        input.country,
        input.heardVia ?? null,
        input.decisionType ?? null,
        input.wantsFollowup ? 1 : 0,
        input.contactMethod ?? null,
        contactEncrypted?.ciphertext ?? null,
        contactEncrypted?.iv ?? null,
        input.idempotencyKey ?? null
      )
      .first<{ decision_id: number }>();
  } catch (err: any) {
    // RACE CONDITION FIX: two genuinely concurrent requests with the same
    // idempotency key can both pass the existence check above before either
    // commits (classic TOCTOU). The second INSERT then hits the UNIQUE
    // constraint. Previously this threw unhandled; now it's treated exactly
    // like the sequential-retry case — fetch and return the winning row,
    // rather than crashing the second request. Found by deliberately
    // running 3 concurrent submissions in an adversarial audit, not by
    // reading the code.
    if (input.idempotencyKey && /UNIQUE constraint failed/.test(String(err?.message ?? err))) {
      const existing = await env.DB.prepare("SELECT decision_id FROM decisions WHERE idempotency_key = ?")
        .bind(input.idempotencyKey)
        .first<{ decision_id: number }>();
      if (existing) return { success: true, data: { decisionId: existing.decision_id, wasExisting: true } };
    }
    throw err;
  }

  if (!row) return { success: false, error: "Failed to record your decision." };

  // NOTE: the Event Bus cascade (notify follow-up team, welcome email, assign
  // reading plan) is intentionally NOT implemented here — it depends on the
  // email provider decision (Volume 3 §1, still open) and the Event Bus's
  // sync/Queues split (Volume 2 §4). This function only does the one thing
  // it can honestly do right now: record the decision safely.
  return { success: true, data: { decisionId: row.decision_id, wasExisting: false } };
}

/**
 * Decrypts a Decision's sensitive fields. MUST ONLY be called from a route
 * that has already verified the caller is Super Administrator or Deputy
 * Super Administrator — that role-check middleware does not exist yet
 * (same gap as Module 2's moderator routes), so no route currently calls
 * this function. Written now so it's ready the moment that middleware exists.
 */
export async function decryptDecisionContact(env: Env, decisionId: number): Promise<{ name: string | null; contactValue: string | null } | null> {
  const row = await env.DB.prepare(
    "SELECT name_encrypted, name_iv, contact_value_encrypted, contact_value_iv FROM decisions WHERE decision_id = ?"
  )
    .bind(decisionId)
    .first<any>();
  if (!row) return null;

  const { decryptField } = await import("./encryption-service");
  const name = row.name_encrypted && row.name_iv ? await decryptField(row.name_encrypted, row.name_iv, env.ENCRYPTION_KEY) : null;
  const contactValue =
    row.contact_value_encrypted && row.contact_value_iv ? await decryptField(row.contact_value_encrypted, row.contact_value_iv, env.ENCRYPTION_KEY) : null;
  return { name, contactValue };
}

// ---------- Nations ----------
export async function getFeaturedNationToday(env: Env): Promise<any | null> {
  const row = await env.DB.prepare("SELECT nation_id, country_name, prayer_focus FROM nations WHERE is_featured_today = 1 LIMIT 1").first();
  return row ?? null;
}

export async function listNations(env: Env): Promise<any[]> {
  const result = await env.DB.prepare("SELECT nation_id, country_name, prayer_focus FROM nations ORDER BY country_name LIMIT 250").all();
  return result.results as any[];
}
