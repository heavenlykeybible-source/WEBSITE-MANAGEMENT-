-- ============================================================
-- Temporary Media Storage + Retention (Project resource-control policy)
-- Large media belongs in R2; D1 stores metadata only.
-- Default retention is 48 hours unless explicitly kept.
-- ============================================================

ALTER TABLE media ADD COLUMN storage_key TEXT;
ALTER TABLE media ADD COLUMN storage_bucket TEXT DEFAULT 'MEDIA_R2';
ALTER TABLE media ADD COLUMN storage_status TEXT NOT NULL DEFAULT 'metadata_only';
ALTER TABLE media ADD COLUMN keep_media INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN retention_until TEXT;
ALTER TABLE media ADD COLUMN uploaded_at TEXT;
ALTER TABLE media ADD COLUMN deleted_at TEXT;

CREATE INDEX idx_media_retention ON media(storage_status, keep_media, retention_until);
CREATE INDEX idx_media_storage_key ON media(storage_key);

CREATE TABLE media_cleanup_log (
    cleanup_id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER,
    storage_key TEXT NOT NULL,
    action TEXT NOT NULL, -- deleted | skipped_kept | skipped_referenced | failed
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (media_id) REFERENCES media(media_id)
);

CREATE TABLE broadcast_recordings (
    recording_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    storage_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'recording', -- recording | ready | downloaded | deleted | failed
    keep_recording INTEGER NOT NULL DEFAULT 0,
    retention_until TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    deleted_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id)
);
CREATE INDEX idx_recordings_retention ON broadcast_recordings(status, keep_recording, retention_until);

CREATE TABLE playout_assets (
    playout_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    starts_at TEXT,
    ends_at TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | playing | completed | cancelled
    keep_asset INTEGER NOT NULL DEFAULT 0,
    retention_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (media_id) REFERENCES media(media_id)
);
CREATE INDEX idx_playout_schedule ON playout_assets(status, starts_at);

-- A delivery job is lightweight D1 metadata. The actual media remains in R2
-- only for as long as needed by the delivery workflow.
CREATE TABLE distribution_jobs (
    job_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_item_id INTEGER,
    campaign_id INTEGER NOT NULL,
    media_id INTEGER,
    account_id INTEGER,
    channel_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | sent | failed | retrying | cancelled
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    locked_at TEXT,
    external_post_id TEXT,
    error_detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    FOREIGN KEY (campaign_item_id) REFERENCES broadcast_campaign_items(item_id),
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id),
    FOREIGN KEY (media_id) REFERENCES media(media_id),
    FOREIGN KEY (account_id) REFERENCES social_accounts(account_id)
);
CREATE INDEX idx_distribution_jobs_due ON distribution_jobs(status, next_attempt_at);
CREATE INDEX idx_distribution_jobs_media ON distribution_jobs(media_id, status);
