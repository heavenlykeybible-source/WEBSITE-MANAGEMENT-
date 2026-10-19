import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { getUserRole } from "../middleware/rbac";

/**
 * THE MINISTRY JOURNEY TIMELINE — ROLE-FILTERED, PER ACR-016'S CORRECTION.
 *
 * This is not a single unified view. Each category is included in the
 * response ONLY if the viewer already had rights to that category on its
 * own — reusing each category's EXISTING access rule, never a new
 * permission system living only in this function. A Follow-up Worker
 * (below Administrator) NEVER sees Counselling entries here, regardless
 * of whose timeline they're viewing, because Counselling access has
 * always been restricted to Super/Deputy Admin + the assigned counsellor,
 * and that rule is re-checked here, not assumed to not apply.
 */
export async function getMinistryJourneyTimeline(env: Env, targetUserId: number, viewerUserId: number): Promise<any> {
  const viewerRole = await getUserRole(env, viewerUserId);
  const isSelf = targetUserId === viewerUserId;
  const isSuperAdminTier = viewerRole && viewerRole.level >= 4; // Deputy Super Admin or above

  const timeline: any[] = [];

  // Discipleship progress — visible to self, or Administrator+ for pastoral oversight.
  if (isSelf || (viewerRole && viewerRole.level >= 3)) {
    const lessons = await env.DB.prepare(
      "SELECT lesson_id, completion_status FROM course_progress WHERE user_id = ? AND completion_status = 'completed'"
    )
      .bind(targetUserId)
      .all();
    for (const l of lessons.results as any[]) timeline.push({ category: "discipleship", detail: `Completed lesson ${l.lesson_id}` });
  }

  // Testimonies — public information already, safe for any authenticated viewer with self/admin tier.
  if (isSelf || (viewerRole && viewerRole.level >= 3)) {
    const testimonies = await env.DB.prepare("SELECT title FROM testimonies WHERE user_id = ? AND approval_status = 'approved'").bind(targetUserId).all();
    for (const t of testimonies.results as any[]) timeline.push({ category: "testimony", detail: t.title });
  }

  // COUNSELLING — ONLY self or Super/Deputy Admin tier. NEVER a general Administrator,
  // NEVER a Follow-up Worker, regardless of what else they can see on this timeline.
  if (isSelf || isSuperAdminTier) {
    const counselling = await env.DB.prepare("SELECT category, status FROM counselling WHERE user_id = ?").bind(targetUserId).all();
    for (const c of counselling.results as any[]) timeline.push({ category: "counselling", detail: `${c.category} (${c.status})` });
  }
  // If neither condition is met, counselling entries are simply absent from
  // the array above — not filtered out after being fetched, never fetched
  // at all for a viewer without rights.

  // Decisions for Christ — same tier as Counselling.
  if (isSelf || isSuperAdminTier) {
    const decisions = await env.DB.prepare("SELECT decision_date, status FROM decisions WHERE user_id = ?").bind(targetUserId).all();
    for (const d of decisions.results as any[]) timeline.push({ category: "decision", detail: `Decision recorded ${d.decision_date} (${d.status})` });
  }

  return { timeline, viewerCanSeeRestrictedCategories: isSelf || isSuperAdminTier };
}

// ---------- Ministry Care Dashboard (aggregate) ----------
export async function getMinistryCareDashboard(env: Env): Promise<any> {
  const newConvertsAwaitingContact = await env.DB.prepare("SELECT COUNT(*) as c FROM decisions WHERE status = 'new'").first<{ c: number }>();
  const missedFollowups = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM follow_up_assignments WHERE assignment_status = 'open' AND next_contact_date < datetime('now')"
  ).first<{ c: number }>();
  const upcomingCounselling = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM counselling WHERE scheduled_session_at > datetime('now') AND scheduled_session_at < datetime('now', '+7 days')"
  ).first<{ c: number }>();

  return {
    newConvertsAwaitingContact: newConvertsAwaitingContact?.c ?? 0,
    missedFollowups: missedFollowups?.c ?? 0,
    upcomingCounsellingSessions: upcomingCounselling?.c ?? 0,
  };
}

// ---------- Follow-up Workflow Templates ----------
export async function startFollowupWorkflow(env: Env, templateId: number, targetUserId: number, startDate: string): Promise<ServiceResult<{ tasksCreated: number }>> {
  const template = await env.DB.prepare("SELECT template_id FROM followup_workflow_templates WHERE template_id = ?").bind(templateId).first();
  if (!template) return { success: false, error: "Workflow template not found." };

  const steps = await env.DB.prepare("SELECT day_offset, task_description, task_type FROM followup_workflow_steps WHERE template_id = ? ORDER BY day_offset").bind(templateId).all();
  const start = new Date(startDate);
  let created = 0;

  for (const step of steps.results as any[]) {
    const dueDate = new Date(start.getTime() + step.day_offset * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO manual_ministry_tasks (related_type, related_id, task_type, description, due_date, status, source_template_id)
       VALUES ('new_convert', ?, ?, ?, ?, 'pending', ?)`
    )
      .bind(targetUserId, step.task_type ?? "follow_up", step.task_description, dueDate, templateId)
      .run();
    created++;
  }

  return { success: true, data: { tasksCreated: created } };
}
