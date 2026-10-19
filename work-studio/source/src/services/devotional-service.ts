import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

// ---------- Daily Devotional / Verse of the Day / Memory Verse ----------
export async function getTodaysDailyContent(env: Env, contentType: "verse_of_day" | "memory_verse" | "devotional"): Promise<any | null> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    `SELECT id, verse_id, body, scheduled_date FROM daily_spiritual_content WHERE content_type = ? AND scheduled_date = ?`
  )
    .bind(contentType, today)
    .first<any>();
  return row ?? null;
}

// ---------- Kingdom Keys ----------
export async function getCurrentKingdomKeys(env: Env): Promise<any | null> {
  const row = await env.DB.prepare(
    `SELECT lesson_id, title, teaching, scripture_refs, application, reflection_questions
     FROM kingdom_keys ORDER BY published_date DESC LIMIT 1`
  ).first<any>();
  return row ?? null;
}

// ---------- Faith Challenge ----------
export async function getCurrentFaithChallenge(env: Env): Promise<any | null> {
  const row = await env.DB.prepare(
    `SELECT challenge_id, topic, week_of FROM faith_challenges ORDER BY week_of DESC LIMIT 1`
  ).first<any>();
  return row ?? null;
}

export async function submitFaithChallengeResponse(
  env: Env,
  challengeId: number,
  userId: number,
  responseText: string,
  anonymous: boolean
): Promise<ServiceResult<{ responseId: number }>> {
  if (!responseText || responseText.length < 1) return { success: false, error: "Please share a response." };
  if (responseText.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Response must be under ${MAX_LENGTHS.standardText} characters.` };
  }

  const challenge = await env.DB.prepare("SELECT challenge_id FROM faith_challenges WHERE challenge_id = ?").bind(challengeId).first();
  if (!challenge) return { success: false, error: "Challenge not found." };

  const row = await env.DB.prepare(
    `INSERT INTO faith_challenge_responses (challenge_id, user_id, response_text, anonymous) VALUES (?, ?, ?, ?) RETURNING response_id`
  )
    .bind(challengeId, userId, responseText, anonymous ? 1 : 0)
    .first<{ response_id: number }>();

  return row ? { success: true, data: { responseId: row.response_id } } : { success: false, error: "Failed to submit response." };
}

export async function listFaithChallengeResponses(env: Env, challengeId: number): Promise<any[]> {
  const result = await env.DB.prepare(
    `SELECT r.response_id, r.response_text, r.anonymous, r.created_at, u.name
     FROM faith_challenge_responses r JOIN users u ON u.user_id = r.user_id
     WHERE r.challenge_id = ? ORDER BY r.created_at DESC`
  )
    .bind(challengeId)
    .all();

  return (result.results as any[]).map((r) => ({
    responseId: r.response_id,
    responseText: r.response_text,
    displayName: r.anonymous ? null : r.name, // same anonymous-identity rule as every other module
    createdAt: r.created_at,
  }));
}
