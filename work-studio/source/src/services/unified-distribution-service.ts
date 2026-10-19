import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

/**
 * Platform Capability Registry — the piece that would have caught the
 * Facebook Groups/Invite deprecations automatically instead of requiring
 * manual research mid-project (see ACR-015). Reads real data, not
 * assumptions embedded in code.
 */
export async function getPlatformCapability(env: Env, platformName: string): Promise<any | null> {
  return env.DB.prepare("SELECT * FROM platform_capability_registry WHERE platform_name = ?").bind(platformName).first();
}

export async function listStalePlatformVerifications(env: Env, staleDays = 365): Promise<any[]> {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    "SELECT platform_name, last_verified_date FROM platform_capability_registry WHERE last_verified_date < ?"
  )
    .bind(cutoff)
    .all();
  return result.results as any[];
}

// ---------- Unified Distribution Dashboard (aggregate, no new storage) ----------
export async function getDistributionStatus(env: Env, campaignId: number): Promise<any> {
  const channels = await env.DB.prepare(
    `SELECT bcc.channel_name, bdl.status FROM broadcast_campaign_channels bcc
     LEFT JOIN broadcast_delivery_log bdl ON bdl.campaign_id = bcc.campaign_id AND bdl.channel_name = bcc.channel_name
     WHERE bcc.campaign_id = ?`
  )
    .bind(campaignId)
    .all();

  const manualTasks = await env.DB.prepare(
    "SELECT task_id, description, status FROM manual_ministry_tasks WHERE campaign_id = ?"
  )
    .bind(campaignId)
    .all();

  return { automatedChannels: channels.results, manualTasks: manualTasks.results };
}

// ---------- Generalized Manual Ministry Tasks (ACR-015, extended by ACR-016) ----------
export async function createMinistryTask(
  env: Env,
  relatedType: string,
  relatedId: number,
  taskType: string,
  description: string,
  assignedTo?: number,
  priority: "low" | "normal" | "high" | "urgent" = "normal",
  dueDate?: string
): Promise<ServiceResult<{ taskId: number }>> {
  const row = await env.DB.prepare(
    `INSERT INTO manual_ministry_tasks (related_type, related_id, task_type, description, assigned_to, priority, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING task_id`
  )
    .bind(relatedType, relatedId, taskType, description, assignedTo ?? null, priority, dueDate ?? null)
    .first<{ task_id: number }>();
  return row ? { success: true, data: { taskId: row.task_id } } : { success: false, error: "Failed to create task." };
}

export async function listMyMinistryTasks(env: Env, assignedTo: number): Promise<any[]> {
  const result = await env.DB.prepare(
    "SELECT task_id, task_type, description, priority, due_date, status FROM manual_ministry_tasks WHERE assigned_to = ? AND status = 'pending' ORDER BY priority DESC, due_date ASC"
  )
    .bind(assignedTo)
    .all();
  return result.results as any[];
}
