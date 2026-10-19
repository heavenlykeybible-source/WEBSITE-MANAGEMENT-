-- Distribution idempotency and retention-reference hardening.
-- Prevent duplicate automation jobs for the same campaign destination.

CREATE UNIQUE INDEX IF NOT EXISTS ux_distribution_item_account_channel
ON distribution_jobs(campaign_item_id, account_id, channel_name)
WHERE campaign_item_id IS NOT NULL AND account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_distribution_item_channel_no_account
ON distribution_jobs(campaign_item_id, channel_name)
WHERE campaign_item_id IS NOT NULL AND account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_items_media_status
ON broadcast_campaign_items(media_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_distribution_processing_lock
ON distribution_jobs(status, locked_at);
