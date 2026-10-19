-- ============================================================
-- Campaign Manager Refinements (ACR-013)
-- Small, additive changes only — extends ACR-011/012.
-- ============================================================

-- Cadence enrichment
ALTER TABLE broadcast_campaigns ADD COLUMN daily_send_times TEXT;  -- JSON list, e.g. '["08:00","18:00"]' — replaces single daily_send_time usage going forward
-- cadence_type now also accepts 'monthly' (no schema change needed — it was already a free-text field)

-- Status model unification — collaborative workflow
ALTER TABLE broadcast_campaigns ADD COLUMN submitted_by INTEGER REFERENCES users(user_id);
ALTER TABLE broadcast_campaigns ADD COLUMN submitted_at TEXT;
-- status column already exists; application logic now uses the fuller value set:
-- draft | submitted | approved | scheduled | publishing | published | archived
-- (approved_by/approved_at already existed from ACR-011, now used for every campaign, not only 'emergency')

-- Hashtag Collections
CREATE TABLE hashtag_collections (
    collection_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL   -- e.g. 'Revival', 'Youth', 'Missions'
);

CREATE TABLE hashtag_collection_items (
    collection_id INTEGER NOT NULL,
    hashtag_id INTEGER NOT NULL,
    PRIMARY KEY (collection_id, hashtag_id),
    FOREIGN KEY (collection_id) REFERENCES hashtag_collections(collection_id),
    FOREIGN KEY (hashtag_id) REFERENCES hashtags(hashtag_id)
);

-- Retry configuration per channel/provider
ALTER TABLE broadcast_channels ADD COLUMN max_retries INTEGER DEFAULT 3;
ALTER TABLE broadcast_channels ADD COLUMN retry_backoff_minutes INTEGER DEFAULT 15;

-- Engagement analytics — the one genuinely new storage need
CREATE TABLE campaign_engagement_stats (
    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    channel_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,   -- 'likes' | 'shares' | 'views' | 'clicks' | etc., varies by provider
    metric_value INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES broadcast_campaign_items(item_id)
);
