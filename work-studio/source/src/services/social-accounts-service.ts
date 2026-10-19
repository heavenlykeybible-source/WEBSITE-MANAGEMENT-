import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

export interface SocialAccountInput {
  channelId: number;
  displayName: string;
  externalAccountId?: string;
  credentialsRef?: string;
  isAutomatable?: boolean; // false for platforms/accounts that require manual action
}

export async function connectSocialAccount(env: Env, input: SocialAccountInput): Promise<ServiceResult<{ accountId: number }>> {
  if (!input.displayName) return { success: false, error: "Display name is required." };

  const channel = await env.DB.prepare(
    `SELECT bc.channel_id, bc.channel_name, COALESCE(pcr.publishing_supported, 0) AS publishing_supported,
            COALESCE(pcr.media_upload_supported, 0) AS media_upload_supported,
            COALESCE(pcr.manual_action_required, 0) AS manual_action_required
     FROM broadcast_channels bc
     LEFT JOIN platform_capability_registry pcr ON pcr.platform_name = bc.channel_name
     WHERE bc.channel_id = ?`
  ).bind(input.channelId).first<any>();
  if (!channel) return { success: false, error: "Invalid channel." };

  const requestedAutomation = input.isAutomatable !== false;
  const registryAllowsAutomation = !!channel.publishing_supported && !channel.manual_action_required;
  if (requestedAutomation && !registryAllowsAutomation) {
    return { success: false, error: "This channel is not verified for automated publishing. Mark it manual-only or complete a provider capability verification first." };
  }
  if (requestedAutomation && !input.credentialsRef) {
    return { success: false, error: "A provider credentials reference is required for automated publishing." };
  }

  const row = await env.DB.prepare(
    `INSERT INTO social_accounts (channel_id, display_name, external_account_id, credentials_ref, status, is_automatable)
     VALUES (?, ?, ?, ?, 'connected', ?) RETURNING account_id`
  )
    .bind(input.channelId, input.displayName, input.externalAccountId ?? null, input.credentialsRef ?? null, requestedAutomation ? 1 : 0)
    .first<{ account_id: number }>();

  return row ? { success: true, data: { accountId: row.account_id } } : { success: false, error: "Failed to connect account." };
}

/**
 * ACR-014 CORRECTION, enforced here: only automatable accounts are ever
 * eligible for campaign publishing selection. Facebook Groups (or any
 * account explicitly marked is_automatable=0) never appear as a
 * publishing destination — because Meta's Groups API was deprecated in
 * April 2024, verified during this project. This function is the
 * technical enforcement of that finding, not just a note about it.
 */
export async function listAutomatableAccounts(env: Env): Promise<any[]> {
  const result = await env.DB.prepare(
    "SELECT account_id, display_name, channel_id, status FROM social_accounts WHERE is_automatable = 1 AND status = 'connected'"
  ).all();
  return result.results as any[];
}

/** Non-automatable accounts (e.g., Facebook Groups) — used ONLY to generate manual task checklists, never publishing targets. */
export async function listManualOnlyAccounts(env: Env): Promise<any[]> {
  const result = await env.DB.prepare(
    "SELECT account_id, display_name, channel_id FROM social_accounts WHERE is_automatable = 0 AND status = 'connected'"
  ).all();
  return result.results as any[];
}

export async function generateManualTasksForCampaign(env: Env, campaignId: number): Promise<ServiceResult<{ tasksCreated: number }>> {
  const manualAccounts = await listManualOnlyAccounts(env);
  let created = 0;
  for (const account of manualAccounts) {
    await env.DB.prepare(
      `INSERT INTO manual_ministry_tasks (campaign_id, account_id, task_type, description, status)
       VALUES (?, ?, 'share_to_group', ?, 'pending')`
    )
      .bind(campaignId, account.account_id, `Share manually to ${account.display_name}`)
      .run();
    created++;
  }
  return { success: true, data: { tasksCreated: created } };
}

export async function completeManualTask(env: Env, taskId: number, completedBy: number): Promise<ServiceResult> {
  const task = await env.DB.prepare(
    "SELECT task_id, assigned_to, status FROM manual_ministry_tasks WHERE task_id = ?"
  ).bind(taskId).first<{ task_id: number; assigned_to: number | null; status: string }>();

  if (!task) return { success: false, error: "Manual task not found." };
  if (task.status !== "pending") return { success: false, error: "Only pending tasks can be completed." };
  if (task.assigned_to !== null && task.assigned_to !== completedBy) {
    return { success: false, error: "This task is assigned to another worker." };
  }

  const result = await env.DB.prepare(
    "UPDATE manual_ministry_tasks SET status = 'completed', completed_by = ?, completed_at = datetime('now') WHERE task_id = ? AND status = 'pending' AND (assigned_to IS NULL OR assigned_to = ?)"
  )
    .bind(completedBy, taskId, completedBy)
    .run();

  if (!result.meta.changes) return { success: false, error: "Task could not be completed." };
  return { success: true };
}
