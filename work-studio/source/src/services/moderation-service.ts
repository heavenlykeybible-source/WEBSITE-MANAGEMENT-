import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { canActorActOnTarget, getUserRole } from "../middleware/rbac";
import { MAX_LENGTHS } from "../config/security-config";

const ESCALATION_LADDER = [
  "friendly_reminder",
  "official_warning",
  "temporary_restriction",
  "temporary_suspension",
  "permanent_ban",
] as const;
type ActionType = (typeof ESCALATION_LADDER)[number] | "restore";

export interface ModerationActionInput {
  actorUserId: number;
  targetUserId: number;
  actionType: ActionType;
  reason: string;
  restrictionExpiresAt?: string;
}

export async function issueModerationAction(env: Env, input: ModerationActionInput): Promise<ServiceResult<{ actionId: number }>> {
  if (!input.reason || input.reason.length < 3) {
    return { success: false, error: "A reason is required for every moderation action (audit logging requirement)." };
  }
  if (input.reason.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Reason must be under ${MAX_LENGTHS.standardText} characters.` };
  }

  // Least-privilege check FIRST — before anything else, including the
  // Permanent Ban gate below. A Moderator can never act on a peer or superior
  // regardless of which action they're attempting.
  const canAct = await canActorActOnTarget(env, input.actorUserId, input.targetUserId);
  if (!canAct) {
    return { success: false, error: "You do not have authority to take action on this member." };
  }

  // THE HARD GATE: Permanent Ban requires Administrator or above — a
  // Moderator passing the least-privilege check above is still blocked here.
  if (input.actionType === "permanent_ban" || input.actionType === "restore") {
    const actor = await getUserRole(env, input.actorUserId);
    if (!actor || actor.level < 3 /* Administrator */) {
      return { success: false, error: "Only an Administrator or above may issue a Permanent Ban or restore an account." };
    }
  }

  const row = await env.DB.prepare(
    `INSERT INTO moderation_actions (actor_user_id, target_user_id, action_type, reason, restriction_expires_at)
     VALUES (?, ?, ?, ?, ?) RETURNING action_id`
  )
    .bind(input.actorUserId, input.targetUserId, input.actionType, input.reason, input.restrictionExpiresAt ?? null)
    .first<{ action_id: number }>();
  if (!row) return { success: false, error: "Failed to record moderation action." };

  // Apply the real effect for suspension/ban actions.
  if (input.actionType === "temporary_suspension" || input.actionType === "permanent_ban") {
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE user_id = ?").bind(input.targetUserId).run();
  } else if (input.actionType === "restore") {
    await env.DB.prepare("UPDATE users SET status = 'active' WHERE user_id = ?").bind(input.targetUserId).run();
  }

  return { success: true, data: { actionId: row.action_id } };
}

export async function addModeratorNote(env: Env, actionId: number | null, targetUserId: number, authorId: number, noteText: string): Promise<ServiceResult> {
  if (!noteText) return { success: false, error: "Note cannot be empty." };
  if (noteText.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Note must be under ${MAX_LENGTHS.standardText} characters.` };
  }
  await env.DB.prepare(
    `INSERT INTO moderator_notes (action_id, target_user_id, author_id, note_text) VALUES (?, ?, ?, ?)`
  )
    .bind(actionId, targetUserId, authorId, noteText)
    .run();
  return { success: true };
  // Note: these are never exposed to the target member — no route in this
  // module returns moderator_notes to anyone but a Moderator+ caller.
}

export async function submitAppeal(env: Env, actionId: number, submittedBy: number, appealReason: string): Promise<ServiceResult<{ appealId: number }>> {
  const action = await env.DB.prepare("SELECT target_user_id FROM moderation_actions WHERE action_id = ?").bind(actionId).first<{ target_user_id: number }>();
  if (!action) return { success: false, error: "Moderation action not found." };
  if (action.target_user_id !== submittedBy) return { success: false, error: "You may only appeal actions taken against your own account." };
  if (!appealReason) return { success: false, error: "Please explain why you are appealing." };
  if (appealReason.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Appeal reason must be under ${MAX_LENGTHS.standardText} characters.` };
  }

  const row = await env.DB.prepare(
    `INSERT INTO appeals (action_id, submitted_by, appeal_reason) VALUES (?, ?, ?) RETURNING appeal_id`
  )
    .bind(actionId, submittedBy, appealReason)
    .first<{ appeal_id: number }>();
  return row ? { success: true, data: { appealId: row.appeal_id } } : { success: false, error: "Failed to submit appeal." };
}

export async function decideAppeal(env: Env, appealId: number, reviewerId: number, decision: "upheld" | "overturned" | "partially_overturned", notes: string): Promise<ServiceResult> {
  const appeal = await env.DB.prepare("SELECT action_id FROM appeals WHERE appeal_id = ?").bind(appealId).first<{ action_id: number }>();
  if (!appeal) return { success: false, error: "Appeal not found." };

  await env.DB.prepare(
    `UPDATE appeals SET reviewing_user_id = ?, decision = ?, decision_notes = ?, decided_at = datetime('now') WHERE appeal_id = ?`
  )
    .bind(reviewerId, decision, notes, appealId)
    .run();

  if (decision === "overturned") {
    const action = await env.DB.prepare("SELECT target_user_id FROM moderation_actions WHERE action_id = ?").bind(appeal.action_id).first<{ target_user_id: number }>();
    if (action) {
      await env.DB.prepare("UPDATE users SET status = 'active' WHERE user_id = ?").bind(action.target_user_id).run();
    }
  }

  return { success: true };
}

// ---------- Dashboards (aggregate queries, no new storage — same pattern as every prior dashboard) ----------
export async function getModerationDashboard(env: Env): Promise<any> {
  const pendingTestimonies = await env.DB.prepare("SELECT COUNT(*) as c FROM testimonies WHERE approval_status = 'pending'").first<{ c: number }>();
  const flaggedPosts = await env.DB.prepare("SELECT COUNT(*) as c FROM moderation_queue WHERE status = 'pending' AND source = 'ai_flag'").first<{ c: number }>();
  const openReports = await env.DB.prepare("SELECT COUNT(*) as c FROM moderation_queue WHERE status = 'pending' AND source = 'user_report'").first<{ c: number }>();
  const activePrayers = await env.DB.prepare("SELECT COUNT(*) as c FROM prayer_requests WHERE status = 'active'").first<{ c: number }>();

  return {
    pendingTestimonies: pendingTestimonies?.c ?? 0,
    flaggedPosts: flaggedPosts?.c ?? 0,
    openReports: openReports?.c ?? 0,
    activePrayerRequests: activePrayers?.c ?? 0,
  };
}

export async function getCommunityHealthDashboard(env: Env): Promise<any> {
  const testimoniesApproved = await env.DB.prepare("SELECT COUNT(*) as c FROM testimonies WHERE approval_status = 'approved'").first<{ c: number }>();
  const activeGroups = await env.DB.prepare("SELECT COUNT(*) as c FROM groups WHERE status = 'active'").first<{ c: number }>();
  const questionsAnswered = await env.DB.prepare("SELECT COUNT(DISTINCT question_id) as c FROM answers").first<{ c: number }>();

  return {
    testimoniesApproved: testimoniesApproved?.c ?? 0,
    activeGroups: activeGroups?.c ?? 0,
    questionsAnswered: questionsAnswered?.c ?? 0,
  };
}
