import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

/**
 * Generates real scheduled campaign_items from a cadence rule — the actual
 * "30 images over 30 days" feature. No architectural limit on item count
 * (per ACR-013 confirmation) — this loop scales to however many media
 * items are provided.
 */
export async function generateCampaignItems(
  env: Env,
  campaignId: number,
  mediaIds: number[],
  cadenceType: "daily" | "every_n_days" | "weekly" | "monthly",
  startDate: string,
  intervalDays = 1
): Promise<ServiceResult<{ itemsCreated: number }>> {
  const campaign = await env.DB.prepare("SELECT campaign_id FROM broadcast_campaigns WHERE campaign_id = ?").bind(campaignId).first();
  if (!campaign) return { success: false, error: "Campaign not found." };
  if (!Array.isArray(mediaIds) || mediaIds.length === 0 || mediaIds.length > 366) return { success: false, error: "Provide between 1 and 366 media items." };
  if (!['daily','every_n_days','weekly','monthly'].includes(cadenceType)) return { success: false, error: "Invalid cadence type." };
  if (Number.isNaN(Date.parse(startDate))) return { success: false, error: "startDate must be a valid ISO timestamp." };
  if (cadenceType === 'every_n_days' && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)) return { success: false, error: "intervalDays must be between 1 and 365." };
  const placeholders = mediaIds.map(() => '?').join(',');
  const mediaRows = await env.DB.prepare(`SELECT media_id, storage_status, storage_key FROM media WHERE media_id IN (${placeholders})`).bind(...mediaIds).all<any>();
  if (mediaRows.results.length !== new Set(mediaIds).size) return { success: false, error: "One or more media items were not found." };
  if (mediaRows.results.some((m: any) => m.storage_status !== 'stored' || !m.storage_key)) return { success: false, error: "Every campaign item must reference stored R2 media." };

  const stepDays = cadenceType === "daily" ? 1 : cadenceType === "weekly" ? 7 : cadenceType === "monthly" ? 30 : intervalDays;

  let created = 0;
  const start = new Date(startDate);
  for (let i = 0; i < mediaIds.length; i++) {
    const scheduledDate = new Date(start.getTime() + i * stepDays * 24 * 60 * 60 * 1000);
    await env.DB.prepare(
      `INSERT INTO broadcast_campaign_items (campaign_id, media_id, sequence_order, scheduled_at, status)
       VALUES (?, ?, ?, ?, 'scheduled')`
    )
      .bind(campaignId, mediaIds[i], i + 1, scheduledDate.toISOString())
      .run();
    created++;
  }

  return { success: true, data: { itemsCreated: created } };
}

export async function getCampaignCalendar(env: Env, campaignId: number): Promise<any[]> {
  const result = await env.DB.prepare(
    `SELECT item_id, media_id, sequence_order, scheduled_at, status, caption
     FROM broadcast_campaign_items WHERE campaign_id = ? ORDER BY scheduled_at`
  )
    .bind(campaignId)
    .all();
  return result.results as any[];
}

export async function pauseCampaignItem(env: Env, itemId: number): Promise<ServiceResult> {
  await env.DB.prepare("UPDATE broadcast_campaign_items SET status = 'paused' WHERE item_id = ? AND status = 'scheduled'").bind(itemId).run();
  return { success: true };
}

export async function resumeCampaignItem(env: Env, itemId: number): Promise<ServiceResult> {
  await env.DB.prepare("UPDATE broadcast_campaign_items SET status = 'scheduled' WHERE item_id = ? AND status = 'paused'").bind(itemId).run();
  return { success: true };
}

export async function cancelCampaignItem(env: Env, itemId: number): Promise<ServiceResult> {
  await env.DB.prepare("UPDATE broadcast_campaign_items SET status = 'cancelled' WHERE item_id = ?").bind(itemId).run();
  return { success: true };
}

// ---------- Hashtag Collections ----------
export async function createHashtagCollection(env: Env, name: string, tags: string[]): Promise<ServiceResult<{ collectionId: number }>> {
  const row = await env.DB.prepare("INSERT INTO hashtag_collections (name) VALUES (?) RETURNING collection_id").bind(name).first<{ collection_id: number }>();
  if (!row) return { success: false, error: "Failed to create collection." };

  for (const tag of tags) {
    let hashtag = await env.DB.prepare("SELECT hashtag_id FROM hashtags WHERE tag = ?").bind(tag).first<{ hashtag_id: number }>();
    if (!hashtag) {
      hashtag = await env.DB.prepare("INSERT INTO hashtags (tag) VALUES (?) RETURNING hashtag_id").bind(tag).first<{ hashtag_id: number }>();
    }
    await env.DB.prepare("INSERT OR IGNORE INTO hashtag_collection_items (collection_id, hashtag_id) VALUES (?, ?)").bind(row.collection_id, hashtag!.hashtag_id).run();
  }
  return { success: true, data: { collectionId: row.collection_id } };
}

export async function getHashtagsForCollection(env: Env, collectionId: number): Promise<string[]> {
  const result = await env.DB.prepare(
    `SELECT h.tag FROM hashtag_collection_items hci JOIN hashtags h ON h.hashtag_id = hci.hashtag_id WHERE hci.collection_id = ?`
  )
    .bind(collectionId)
    .all();
  return (result.results as any[]).map((r) => r.tag);
}
