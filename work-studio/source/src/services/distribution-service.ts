import type { StorageEnv } from "./storage-retention-service";
import { deleteMediaObject } from "./storage-retention-service";
import type { ServiceResult } from "./prayer-service";

export interface DistributionEnv extends StorageEnv {}

export async function enqueueDistributionJob(
  env: DistributionEnv,
  input: { campaignId: number; campaignItemId?: number; mediaId?: number; accountId?: number; channelName: string }
): Promise<ServiceResult<{ jobId: number }>> {
  if (!input.channelName) return { success: false, error: "Distribution channel is required." };
  const row = await env.DB.prepare(
    `INSERT INTO distribution_jobs (campaign_item_id, campaign_id, media_id, account_id, channel_name, status, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, 'pending', datetime('now')) RETURNING job_id`
  ).bind(input.campaignItemId ?? null, input.campaignId, input.mediaId ?? null, input.accountId ?? null, input.channelName)
   .first<{ job_id: number }>();
  return row ? { success: true, data: { jobId: row.job_id } } : { success: false, error: "Failed to queue distribution job." };
}

async function cleanupDeliveredRecording(env: DistributionEnv, recordingId: number): Promise<void> {
  const jobs = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM distribution_jobs WHERE recording_id=? AND status NOT IN ('sent','cancelled')`
  ).bind(recordingId).first<{ count: number }>();
  if ((jobs?.count ?? 0) !== 0) return;
  const rec = await env.DB.prepare(
    `SELECT storage_key, status, keep_recording FROM broadcast_recordings WHERE recording_id=?`
  ).bind(recordingId).first<any>();
  if (!rec || rec.keep_recording || !rec.storage_key || rec.status === 'deleted') return;
  const b = env.MEDIA_R2;
  if (!b) return;
  try {
    await b.delete(rec.storage_key);
    await env.DB.prepare(
      `UPDATE broadcast_recordings SET status='deleted', deleted_at=datetime('now') WHERE recording_id=? AND status IN ('ready','downloaded')`
    ).bind(recordingId).run();
  } catch {
    // Retention cleanup remains the safety net if immediate deletion fails.
  }
}

export async function markDistributionSent(env: DistributionEnv, jobId: number, externalPostId?: string): Promise<ServiceResult> {
  const job = await env.DB.prepare("SELECT media_id, recording_id FROM distribution_jobs WHERE job_id = ?").bind(jobId).first<{ media_id: number | null }>();
  if (!job) return { success: false, error: "Distribution job not found." };
  await env.DB.prepare(
    `UPDATE distribution_jobs SET status='sent', external_post_id=?, sent_at=datetime('now'), updated_at=datetime('now'), locked_at=NULL
     WHERE job_id=?`
  ).bind(externalPostId ?? null, jobId).run();
  if (job.media_id) await cleanupDeliveredMedia(env, job.media_id);
  if ((job as any).recording_id) await cleanupDeliveredRecording(env, (job as any).recording_id);
  return { success: true };
}

export async function markDistributionFailed(env: DistributionEnv, jobId: number, error: string, retry = true): Promise<ServiceResult> {
  const job = await env.DB.prepare("SELECT attempt_count FROM distribution_jobs WHERE job_id = ?").bind(jobId).first<{ attempt_count: number }>();
  if (!job) return { success: false, error: "Distribution job not found." };
  const nextAttempt = Math.min((job.attempt_count ?? 0) + 1, 8);
  const status = retry && nextAttempt < 8 ? "retrying" : "failed";
  const delayMinutes = Math.min(60, Math.pow(2, nextAttempt));
  await env.DB.prepare(
    `UPDATE distribution_jobs SET status=?, attempt_count=?, error_detail=?, next_attempt_at=datetime('now', ? || ' minutes'), updated_at=datetime('now'), locked_at=NULL
     WHERE job_id=?`
  ).bind(status, nextAttempt, error.slice(0, 1000), String(delayMinutes), jobId).run();
  return { success: true };
}

/**
 * Storage policy: once every delivery job for a media item is terminally sent
 * and there are no future scheduled campaign items using it, the R2 object can
 * be removed immediately. This is earlier than the 48-hour safety expiry.
 */
export async function cleanupDeliveredMedia(env: DistributionEnv, mediaId: number): Promise<void> {
  const jobs = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM distribution_jobs WHERE media_id=? AND status NOT IN ('sent','cancelled')`
  ).bind(mediaId).first<{ count: number }>();
  if ((jobs?.count ?? 0) !== 0) return;
  const future = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM broadcast_campaign_items
     WHERE media_id=? AND status IN ('scheduled','paused') AND datetime(scheduled_at) > datetime('now')`
  ).bind(mediaId).first<{ count: number }>();
  if ((future?.count ?? 0) !== 0) return;
  await deleteMediaObject(env, mediaId);
}
