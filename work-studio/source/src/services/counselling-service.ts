import type { Env } from "./evangelism-service";
import type { ServiceResult } from "./prayer-service";
import { encryptField } from "./encryption-service";
import { MAX_LENGTHS } from "../config/security-config";

export interface CounsellingInput {
  userId: number | null;
  category: string;
  subject?: string;
  message: string;
  contactMethod?: string;
  priority?: "normal" | "high" | "urgent";
  isMinorFlag?: boolean;
  idempotencyKey?: string;
}

export async function submitCounsellingRequest(env: Env, input: CounsellingInput): Promise<ServiceResult<{ contactId: number; wasExisting: boolean }>> {
  if (!input.category) return { success: false, error: "Please select a category." };
  if (!input.message || input.message.length < 3) return { success: false, error: "Please share your message." };
  if (input.message.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Message must be under ${MAX_LENGTHS.standardText} characters.` };
  }

  if (input.idempotencyKey) {
    const existing = await env.DB.prepare("SELECT contact_id FROM counselling WHERE idempotency_key = ?")
      .bind(input.idempotencyKey)
      .first<{ contact_id: number }>();
    if (existing) return { success: true, data: { contactId: existing.contact_id, wasExisting: true } };
  }

  const messageEncrypted = await encryptField(input.message, env.ENCRYPTION_KEY);

  let row: { contact_id: number } | null;
  try {
    row = await env.DB.prepare(
      `INSERT INTO counselling
       (user_id, category, subject, message_encrypted, message_iv, contact_method, priority, is_minor_flag, idempotency_key, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
       RETURNING contact_id`
    )
      .bind(
        input.userId,
        input.category,
        input.subject ?? null,
        messageEncrypted.ciphertext,
        messageEncrypted.iv,
        input.contactMethod ?? null,
        input.priority ?? "normal",
        input.isMinorFlag ? 1 : 0,
        input.idempotencyKey ?? null
      )
      .first<{ contact_id: number }>();
  } catch (err: any) {
    // Same race-condition fix as evangelism-service.ts submitDecision —
    // see that function's comment for the full explanation.
    if (input.idempotencyKey && /UNIQUE constraint failed/.test(String(err?.message ?? err))) {
      const existing = await env.DB.prepare("SELECT contact_id FROM counselling WHERE idempotency_key = ?")
        .bind(input.idempotencyKey)
        .first<{ contact_id: number }>();
      if (existing) return { success: true, data: { contactId: existing.contact_id, wasExisting: true } };
    }
    throw err;
  }

  if (!row) return { success: false, error: "Failed to submit your request." };

  // ============================================================
  // SAFEGUARDING PLACEHOLDER — DELIBERATELY NOT IMPLEMENTED.
  // No code here reads is_minor_flag to trigger any action. No code sets
  // safeguarding_escalated to 1. No notification, routing, or escalation
  // logic exists, per the frozen rule: this waits on the ministry's
  // approved safeguarding policy, not a developer's judgment call.
  // If input.isMinorFlag is true, the row is stored with that flag and
  // NOTHING ELSE HAPPENS as a result. This is intentional, not an oversight.
  // ============================================================

  return { success: true, data: { contactId: row.contact_id, wasExisting: false } };
}

/**
 * MUST ONLY be called from a route verified as the assigned counsellor or
 * Super/Deputy Admin — role-check middleware doesn't exist yet. Same
 * deferred-gap pattern as Decisions and Module 2's moderator routes.
 */
export async function decryptCounsellingMessage(env: Env, contactId: number): Promise<string | null> {
  const row = await env.DB.prepare("SELECT message_encrypted, message_iv FROM counselling WHERE contact_id = ?").bind(contactId).first<any>();
  if (!row) return null;
  const { decryptField } = await import("./encryption-service");
  return decryptField(row.message_encrypted, row.message_iv, env.ENCRYPTION_KEY);
}
