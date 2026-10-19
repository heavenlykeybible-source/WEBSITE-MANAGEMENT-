import type { StorageEnv } from "./storage-retention-service";
import { retentionUntil } from "./storage-retention-service";
import type { ServiceResult } from "./prayer-service";

const MAX_RECORDING_RETENTION_HOURS = 48;

export async function registerRecording(env: StorageEnv, input: { campaignId?: number; sessionId?: number; storageKey: string; startedAt?: string; retentionHours?: number }): Promise<ServiceResult<{ recordingId: number }>> {
  const key = String(input.storageKey ?? "").trim();
  if (!/^recordings\/[A-Za-z0-9._/-]+$/.test(key)) return { success:false,error:"Invalid recording storage key." };
  if (input.campaignId != null) { const c=await env.DB.prepare("SELECT campaign_id FROM broadcast_campaigns WHERE campaign_id=?").bind(input.campaignId).first(); if (!c) return {success:false,error:"Campaign not found."}; }
  const hours=Math.min(Math.max(Number(input.retentionHours ?? MAX_RECORDING_RETENTION_HOURS),1),MAX_RECORDING_RETENTION_HOURS);
  if (!env.MEDIA_R2) return {success:false,error:"R2 media storage is not configured."};
  if (!await env.MEDIA_R2.head(key)) return {success:false,error:"Recording object was not found in R2."};
  const row=await env.DB.prepare(`INSERT INTO broadcast_recordings (campaign_id,storage_key,status,retention_until,started_at,ended_at) VALUES (?,?, 'ready',?,COALESCE(?,datetime('now')),datetime('now')) RETURNING recording_id`).bind(input.campaignId??null,key,retentionUntil(hours),input.startedAt??null).first<{recording_id:number}>();
  if (!row) return {success:false,error:"Failed to register recording."};
  if (input.sessionId != null) {
    await env.DB.prepare(`UPDATE live_broadcast_sessions SET recording_id=? WHERE session_id=?`).bind(row.recording_id,input.sessionId).run();
  }
  // A recording becomes distributable only after it is registered as ready.
  // Queue the durable D1 jobs here so the reconnect monitor does not have a
  // second, competing distribution path. If there is no campaign, the
  // recording remains available for explicit/manual distribution later.
  if (input.campaignId != null) await enqueueRecordingDistribution(env, row.recording_id, input.campaignId);
  return {success:true,data:{recordingId:row.recording_id}};
}

/**
 * Create one pending job per connected, automatable social account for a
 * finalized recording. The NOT EXISTS guard plus the recording-specific
 * unique index make retries/re-registration idempotent.
 */
export async function enqueueRecordingDistribution(
  env: StorageEnv,
  recordingId: number,
  campaignId: number
): Promise<void> {
  const accounts = await env.DB.prepare(
    `SELECT sa.account_id, bc.channel_name
     FROM social_accounts sa
     JOIN broadcast_channels bc ON bc.channel_id=sa.channel_id
     WHERE sa.status='connected' AND sa.is_automatable=1 AND bc.is_active=1`
  ).all<any>();
  for (const account of accounts.results) {
    await env.DB.prepare(
      `INSERT INTO distribution_jobs
        (campaign_id, media_id, recording_id, account_id, channel_name, status, next_attempt_at)
       SELECT ?, NULL, ?, ?, ?, 'pending', datetime('now')
       WHERE NOT EXISTS (
         SELECT 1 FROM distribution_jobs
         WHERE recording_id=? AND account_id=? AND channel_name=?
           AND status NOT IN ('cancelled')
       )`
    ).bind(
      campaignId, recordingId, account.account_id, account.channel_name,
      recordingId, account.account_id, account.channel_name
    ).run();
  }
}


export async function setRecordingKeep(env: StorageEnv,id:number,keep:boolean):Promise<ServiceResult>{
  // KEEP is a protection flag, not a way to extend the original 48-hour
  // retention window after the user turns it off again.
  const r=await env.DB.prepare(`
    UPDATE broadcast_recordings
    SET keep_recording=?,
        retention_until=CASE
          WHEN ?=1 THEN NULL
          WHEN started_at IS NOT NULL THEN datetime(started_at, '+48 hours')
          ELSE ?
        END
    WHERE recording_id=? AND status IN ('ready','downloaded')
  `).bind(keep?1:0,keep?1:0,retentionUntil(MAX_RECORDING_RETENTION_HOURS),id).run();
  return r.meta.changes===1?{success:true}:{success:false,error:"Recording not found or unavailable."};
}

export async function deleteRecording(env: StorageEnv,id:number,force=false):Promise<ServiceResult>{
  const row=await env.DB.prepare("SELECT storage_key,keep_recording,status FROM broadcast_recordings WHERE recording_id=?").bind(id).first<any>();
  if(!row)return{success:false,error:"Recording not found."}; if(row.status==='deleted')return{success:true}; if(row.keep_recording&&!force)return{success:false,error:"Recording is explicitly kept."}; if(!env.MEDIA_R2)return{success:false,error:"R2 media storage is not configured."};
  try{await env.MEDIA_R2.delete(row.storage_key)}catch{return{success:false,error:"R2 deletion failed; retry later."}}
  await env.DB.prepare("UPDATE broadcast_recordings SET status='deleted',deleted_at=datetime('now') WHERE recording_id=?").bind(id).run(); return{success:true};
}

export async function getRecordingForDownload(env:StorageEnv,id:number):Promise<{object:R2ObjectBody;key:string}|null>{
  const row=await env.DB.prepare("SELECT storage_key,status,keep_recording,retention_until FROM broadcast_recordings WHERE recording_id=?").bind(id).first<any>();
  if(!row||!['ready','downloaded'].includes(row.status))return null; if(!row.keep_recording&&row.retention_until&&new Date(row.retention_until)<=new Date())return null; if(!env.MEDIA_R2)return null;
  const object=await env.MEDIA_R2.get(row.storage_key); if(!object)return null; if(row.status==='ready')await env.DB.prepare("UPDATE broadcast_recordings SET status='downloaded' WHERE recording_id=? AND status='ready'").bind(id).run(); return{object,key:row.storage_key};
}
