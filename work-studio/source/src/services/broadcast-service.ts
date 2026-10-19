import type { Env as AuthEnv } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

export interface Env extends AuthEnv {
  LIVE_STATUS_KV?: KVNamespace; // optional here — falls back to D1-only if not bound yet
}

export async function listActiveBroadcastChannels(env: Env): Promise<any[]> {
  // Per ACR-011: only channels explicitly marked active are usable — the
  // rest exist as reserved, inactive rows proving the adapter interface
  // without pre-building integrations nobody's requested yet.
  const result = await env.DB.prepare("SELECT channel_id, channel_name, is_active, provider_name FROM broadcast_channels WHERE is_active = 1").all();
  return result.results as any[];
}

export interface CampaignInput {
  createdBy: number;
  title: string;
  mediaId?: number;
  body?: string;
  scheduleType: "immediate" | "scheduled" | "recurring" | "emergency";
  scheduledAt?: string;
}

export async function createCampaign(env: Env, input: CampaignInput): Promise<ServiceResult<{ campaignId: number }>> {
  const title = String(input.title ?? '').trim();
  if (!title || title.length > 200) return { success: false, error: "Campaign title is required and must be 200 characters or fewer." };
  if (!["immediate", "scheduled", "recurring", "emergency"].includes(input.scheduleType)) return { success: false, error: "Invalid schedule type." };
  if ((input.scheduleType === 'scheduled' || input.scheduleType === 'recurring') && !input.scheduledAt) return { success: false, error: "scheduledAt is required for scheduled and recurring campaigns." };
  if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) return { success: false, error: "scheduledAt must be a valid ISO timestamp." };
  if (input.mediaId != null) {
    const media = await env.DB.prepare(`SELECT media_id, storage_status, storage_key FROM media WHERE media_id = ?`).bind(input.mediaId).first<any>();
    if (!media) return { success: false, error: "Campaign media not found." };
    if (media.storage_status !== 'stored' || !media.storage_key) return { success: false, error: "Campaign media must have a stored R2 object." };
  }

  const row = await env.DB.prepare(
    `INSERT INTO broadcast_campaigns (title, media_id, body, schedule_type, scheduled_at, status, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?) RETURNING campaign_id`
  )
    .bind(title, input.mediaId ?? null, input.body?.slice(0, 5000) ?? null, input.scheduleType, input.scheduledAt ?? null, input.createdBy)
    .first<{ campaign_id: number }>();

  return row ? { success: true, data: { campaignId: row.campaign_id } } : { success: false, error: "Failed to create campaign." };
}

/**
 * THE HARD GATE from ACR-011: emergency-schedule campaigns require
 * Administrator role or above — enforced here via the actor's role level,
 * reusing the RBAC layer built for Module 6 rather than reinventing a
 * second permission check (Authoritative Ownership: RBAC owns this decision).
 */
export async function approveCampaign(env: Env, campaignId: number, approverId: number, approverRoleLevel: number): Promise<ServiceResult> {
  const campaign = await env.DB.prepare("SELECT schedule_type, status FROM broadcast_campaigns WHERE campaign_id = ?").bind(campaignId).first<{ schedule_type: string; status: string }>();
  if (!campaign) return { success: false, error: "Campaign not found." };
  if (!['draft','failed','partially_failed'].includes(campaign.status)) return { success: false, error: "Only draft or previously failed campaigns can be approved." };

  if (campaign.schedule_type === "emergency" && approverRoleLevel < 3 /* Administrator */) {
    return { success: false, error: "Emergency broadcasts require Administrator approval or above." };
  }

  const result = await env.DB.prepare(
    "UPDATE broadcast_campaigns SET status = 'scheduled', approved_by = ? WHERE campaign_id = ?"
  ).bind(approverId, campaignId).run();
  return result.meta.changes === 1 ? { success: true } : { success: false, error: "Campaign approval failed." };
}

// ---------- Live Broadcast Resilience ----------
const RECONNECT_GRACE_MINUTES = 10;
const HEARTBEAT_TIMEOUT_SECONDS = 180;

function plusMinutesIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function cacheLiveStatus(env: Env, payload: any): Promise<void> {
  if (env.LIVE_STATUS_KV) {
    await env.LIVE_STATUS_KV.put("live_status", JSON.stringify(payload), { expirationTtl: 120 });
  }
}

export async function setLiveStatus(
  env: Env,
  isLive: boolean,
  title?: string,
  options?: { campaignId?: number; fallbackMediaId?: number; sourceType?: 'camera'|'picture_audio'|'bible'|'hymn'|'video'; sourceRefId?: number; visualMediaId?: number }
): Promise<ServiceResult<{ sessionId?: number; sourceType?: string; sourceRefId?: number | null; sourceMediaId?: number | null; visualMediaId?: number | null }>> {
  if (isLive) {
    const active = await env.DB.prepare("SELECT session_id FROM live_broadcast_sessions WHERE status IN ('live','reconnecting') ORDER BY session_id DESC LIMIT 1").first<{session_id:number}>();
    if (active) return { success: false, error: "Another live broadcast session is already active." };
    if (options?.fallbackMediaId != null) {
      const media = await env.DB.prepare(
        `SELECT media_id, file_type, storage_status, storage_key, publish_status, license_type FROM media WHERE media_id=?`
      ).bind(options.fallbackMediaId).first<any>();
      if (!media || media.file_type !== 'video' || media.storage_status !== 'stored' || !media.storage_key || media.publish_status !== 'published' || !['public_domain','ministry_owned','licensed'].includes(media.license_type)) {
        return { success: false, error: "Fallback media must be a stored, published, license-approved video." };
      }
    }
    let sourceMediaId: number | null = null;
    const sourceType = options?.sourceType ?? 'camera';
    const sourceRefId = options?.sourceRefId ?? null;
    if (sourceType === 'bible') {
      if (!sourceRefId) return { success: false, error: 'A Bible audio selection is required.' };
      const row = await env.DB.prepare(`SELECT a.media_id FROM audio_bible a JOIN media m ON m.media_id=a.media_id WHERE a.audio_id=? AND m.file_type='audio' AND m.storage_status='stored' AND m.publish_status='published' AND m.license_type IN ('public_domain','ministry_owned','licensed')`).bind(sourceRefId).first<any>();
      if (!row?.media_id) return { success: false, error: 'Approved Bible audio is unavailable.' };
      sourceMediaId = row.media_id;
    } else if (sourceType === 'hymn') {
      if (!sourceRefId) return { success: false, error: 'A hymn selection is required.' };
      const row = await env.DB.prepare(`SELECT h.media_id FROM hymns h JOIN media m ON m.media_id=h.media_id WHERE h.hymn_id=? AND m.file_type IN ('audio','video') AND m.storage_status='stored' AND m.publish_status='published' AND m.license_type IN ('public_domain','ministry_owned','licensed') AND h.copyright_status IN ('public_domain','licensed')`).bind(sourceRefId).first<any>();
      if (!row?.media_id) return { success: false, error: 'Approved hymn media is unavailable.' };
      sourceMediaId = row.media_id;
    } else if (sourceType === 'video') {
      if (!sourceRefId) return { success: false, error: 'A video selection is required.' };
      const row = await env.DB.prepare(`SELECT media_id FROM media WHERE media_id=? AND file_type='video' AND storage_status='stored' AND publish_status='published' AND license_type IN ('public_domain','ministry_owned','licensed')`).bind(sourceRefId).first<any>();
      if (!row?.media_id) return { success: false, error: 'Approved video is unavailable.' };
      sourceMediaId = row.media_id;
    } else if (sourceType === 'picture_audio') {
      if (!options?.visualMediaId) return { success: false, error: 'A broadcast picture is required.' };
      if (!sourceRefId) return { success: false, error: 'An approved audio source is required for picture + audio mode.' };
      const visual = await env.DB.prepare(`SELECT media_id FROM media WHERE media_id=? AND file_type='image' AND storage_status='stored' AND publish_status='published' AND license_type IN ('public_domain','ministry_owned','licensed')`).bind(options.visualMediaId).first<any>();
      if (!visual?.media_id) return { success: false, error: 'Approved broadcast picture is unavailable.' };
      const audio = await env.DB.prepare(`SELECT media_id FROM media WHERE media_id=? AND file_type='audio' AND storage_status='stored' AND publish_status='published' AND license_type IN ('public_domain','ministry_owned','licensed')`).bind(sourceRefId).first<any>();
      if (!audio?.media_id) return { success: false, error: 'Approved broadcast audio is unavailable.' };
      sourceMediaId = audio.media_id;
    } else if (sourceType !== 'camera') {
      return { success: false, error: 'Unsupported broadcast source.' };
    }
    const row = await env.DB.prepare(
      `INSERT INTO live_broadcast_sessions (campaign_id, title, status, fallback_media_id, source_type, source_ref_id, source_media_id, visual_media_id, last_heartbeat_at)
       VALUES (?, ?, 'live', ?, ?, ?, ?, ?, datetime('now')) RETURNING session_id`
    ).bind(options?.campaignId ?? null, (title ?? '').slice(0, 200) || null, options?.fallbackMediaId ?? null, sourceType, sourceRefId, sourceMediaId, options?.visualMediaId ?? null).first<{session_id:number}>();
    await env.DB.prepare(
      `INSERT INTO live_broadcast_status (is_live, current_title, started_at) VALUES (1, ?, datetime('now'))`
    ).bind((title ?? '').slice(0, 200) || null).run();
    await cacheLiveStatus(env, { isLive: true, title: (title ?? '').slice(0, 200) || null, state: 'live', sessionId: row?.session_id ?? null });
    return { success: true, data: { sessionId: row?.session_id, sourceType, sourceRefId, sourceMediaId, visualMediaId: options?.visualMediaId ?? null } };
  }

  await env.DB.prepare(
    `UPDATE live_broadcast_sessions SET status='ended', ended_at=datetime('now')
     WHERE session_id=(SELECT session_id FROM live_broadcast_sessions WHERE status IN ('live','reconnecting') ORDER BY session_id DESC LIMIT 1)`
  ).run();
  await env.DB.prepare(
    `UPDATE live_broadcast_status SET is_live=0, ended_at=datetime('now')
     WHERE id=(SELECT id FROM live_broadcast_status ORDER BY id DESC LIMIT 1)`
  ).run();
  await cacheLiveStatus(env, { isLive: false, title: null, state: 'ended', sessionId: null });
  return { success: true, data: {} };
}

export async function getLiveFallbackAccess(env: Env, sessionId: number): Promise<ServiceResult<{
  sessionId: number;
  state: string;
  loading: boolean;
  fallbackMediaId: number | null;
  fallbackUrl: string | null;
  reconnectDeadline: string | null;
}>> {
  const session = await env.DB.prepare(
    `SELECT session_id, status, fallback_media_id, reconnect_deadline
     FROM live_broadcast_sessions WHERE session_id=?`
  ).bind(sessionId).first<any>();
  if (!session) return { success: false, error: "Live session not found." };
  // The fallback is a reconnect grace asset, not a general live-media URL.
  // Expose it only while this session is actually reconnecting.
  if (session.status !== 'reconnecting') {
    return { success: true, data: {
      sessionId, state: session.status, loading: false,
      fallbackMediaId: session.fallback_media_id ?? null,
      fallbackUrl: null, reconnectDeadline: session.reconnect_deadline ?? null
    } };
  }

  let fallbackUrl: string | null = null;
  if (session.fallback_media_id != null) {
    const media = await env.DB.prepare(
      `SELECT media_id, file_type, storage_status, storage_key, publish_status, license_type
       FROM media WHERE media_id=?`
    ).bind(session.fallback_media_id).first<any>();
    if (media && media.storage_status === 'stored' && media.storage_key &&
        media.publish_status === 'published' &&
        ['public_domain','ministry_owned','licensed'].includes(media.license_type) &&
        media.file_type === 'video') {
      // Keep this as a lightweight access point. The player fetches the media
      // only when the live session enters reconnecting state.
      fallbackUrl = `/api/media/${media.media_id}/object`;
    }
  }

  return { success: true, data: {
    sessionId,
    state: session.status,
    loading: session.status === 'reconnecting',
    fallbackMediaId: session.fallback_media_id ?? null,
    fallbackUrl,
    reconnectDeadline: session.reconnect_deadline ?? null
  } };
}

export async function heartbeatLiveBroadcast(env: Env, sessionId: number): Promise<ServiceResult<{ state: string; fallback: boolean }>> {
  const session = await env.DB.prepare(
    `SELECT session_id,status,title,fallback_media_id,reconnect_deadline FROM live_broadcast_sessions WHERE session_id=?`
  ).bind(sessionId).first<any>();
  if (!session || session.status === 'ended') return { success: false, error: 'Live session has ended.' };
  if (session.status === 'reconnecting') {
    await env.DB.prepare(
      `UPDATE live_broadcast_sessions SET status='live', reconnect_started_at=NULL, reconnect_deadline=NULL, last_heartbeat_at=datetime('now') WHERE session_id=?`
    ).bind(sessionId).run();
  } else {
    await env.DB.prepare(`UPDATE live_broadcast_sessions SET last_heartbeat_at=datetime('now') WHERE session_id=?`).bind(sessionId).run();
  }
  await cacheLiveStatus(env, { isLive: true, title: session.title ?? null, state: 'live', sessionId });
  return { success: true, data: { state: 'live', fallback: false } };
}

/** Called every minute. A missing encoder heartbeat first enters a 10-minute
 * reconnecting state. During that grace period the player/control plane should
 * show the fallback slate/loop and a loading indicator. Only after the deadline
 * do we end the session and leave the recording ready for distribution. */
export async function monitorLiveBroadcasts(env: Env): Promise<{ reconnecting:number; ended:number }> {
  const now = new Date();
  const stale = await env.DB.prepare(
    `SELECT session_id, campaign_id, title, status, fallback_media_id, recording_id, last_heartbeat_at, reconnect_deadline
     FROM live_broadcast_sessions WHERE status IN ('live','reconnecting') LIMIT 50`
  ).all<any>();
  let reconnecting=0, ended=0;
  for (const s of stale.results) {
    const heartbeat = s.last_heartbeat_at ? new Date(s.last_heartbeat_at.replace(' ','T')+'Z') : null;
    const heartbeatExpired = !heartbeat || (now.getTime()-heartbeat.getTime()) > HEARTBEAT_TIMEOUT_SECONDS*1000;
    if (s.status === 'live' && heartbeatExpired) {
      const deadline = plusMinutesIso(RECONNECT_GRACE_MINUTES);
      await env.DB.prepare(
        `UPDATE live_broadcast_sessions SET status='reconnecting', reconnect_started_at=datetime('now'), reconnect_deadline=? WHERE session_id=? AND status='live'`
      ).bind(deadline, s.session_id).run();
      reconnecting++;
      await cacheLiveStatus(env, { isLive:true, title:s.title ?? null, state:'reconnecting', sessionId:s.session_id, fallbackMediaId:s.fallback_media_id ?? null, reconnectDeadline:deadline, loading:true });
    } else if (s.status === 'reconnecting' && s.reconnect_deadline && new Date(s.reconnect_deadline) <= now) {
      await env.DB.prepare(`UPDATE live_broadcast_sessions SET status='ended', ended_at=datetime('now') WHERE session_id=? AND status='reconnecting'`).bind(s.session_id).run();
      await env.DB.prepare(`UPDATE live_broadcast_status SET is_live=0, ended_at=datetime('now') WHERE id=(SELECT id FROM live_broadcast_status ORDER BY id DESC LIMIT 1)`).run();
      ended++;
      await cacheLiveStatus(env, { isLive:false, title:s.title ?? null, state:'ended', sessionId:s.session_id, loading:false });
    }
  }
  return { reconnecting, ended };
}

export async function getLiveStatus(env: Env): Promise<any> {
  if (env.LIVE_STATUS_KV) {
    const cached = await env.LIVE_STATUS_KV.get("live_status");
    if (cached) return JSON.parse(cached);
  }
  const session = await env.DB.prepare(
    `SELECT session_id,title,status,fallback_media_id,reconnect_deadline FROM live_broadcast_sessions ORDER BY session_id DESC LIMIT 1`
  ).first<any>();
  if (session) return { isLive: session.status !== 'ended', title: session.title ?? null, state: session.status, sessionId: session.session_id, fallbackMediaId: session.fallback_media_id ?? null, reconnectDeadline: session.reconnect_deadline ?? null, loading: session.status === 'reconnecting' };
  const row = await env.DB.prepare("SELECT is_live, current_title FROM live_broadcast_status ORDER BY id DESC LIMIT 1").first<any>();
  return row ? { isLive: !!row.is_live, title: row.current_title, state: row.is_live ? 'live' : 'ended', sessionId: null } : { isLive: false, title: null, state: 'ended', sessionId: null };
}

