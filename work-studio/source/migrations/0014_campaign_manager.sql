-- ============================================================
-- Content Campaign Manager Enhancement (ACR-012)
-- Extends broadcast_campaigns (ACR-011) with per-item scheduling.
-- ============================================================

CREATE TABLE broadcast_campaign_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    media_id INTEGER,                 -- references existing media table
    sequence_order INTEGER NOT NULL,  -- position within the campaign (Image 1, Image 2, ...)
    scheduled_at TEXT NOT NULL,       -- computed from the campaign's chosen cadence
    caption TEXT,                     -- overrides campaign-level default caption, if set
    scripture_ref TEXT,
    prayer_point TEXT,
    call_to_action TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | sent | paused | cancelled | failed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id),
    FOREIGN KEY (media_id) REFERENCES media(media_id)
);
CREATE INDEX idx_campaign_items_schedule ON broadcast_campaign_items(campaign_id, scheduled_at);

-- Cadence configuration lives on the parent campaign, added to the existing
-- broadcast_campaigns table from ACR-011.
ALTER TABLE broadcast_campaigns ADD COLUMN cadence_type TEXT;  -- daily | every_n_days | weekly | custom
ALTER TABLE broadcast_campaigns ADD COLUMN cadence_interval_days INTEGER;  -- used when cadence_type = 'every_n_days'
ALTER TABLE broadcast_campaigns ADD COLUMN daily_send_time TEXT;  -- e.g. '08:00' — applied to every generated item

-- Hashtag library
CREATE TABLE hashtags (
    hashtag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL UNIQUE,     -- e.g. '#HeavenlyKey'
    category TEXT                 -- optional grouping, e.g. 'salvation' | 'prayer' | 'general'
);

CREATE TABLE campaign_item_hashtags (
    item_id INTEGER NOT NULL,
    hashtag_id INTEGER NOT NULL,
    PRIMARY KEY (item_id, hashtag_id),
    FOREIGN KEY (item_id) REFERENCES broadcast_campaign_items(item_id),
    FOREIGN KEY (hashtag_id) REFERENCES hashtags(hashtag_id)
);

-- Image processing metadata — records what was generated at upload time,
-- per Resolution 3 (process once, store variants in R2, no per-delivery transformation cost).
CREATE TABLE media_variants (
    variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    variant_type TEXT NOT NULL,   -- e.g. 'instagram_square' | 'facebook_landscape' | 'compressed_original'
    r2_path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (media_id) REFERENCES media(media_id)
);

-- Duplicate-post detection reuses the existing ai_response_review-style pattern:
-- no new table — flagged items route through the same moderation_queue already
-- used platform-wide (source = 'ai_duplicate_check').
