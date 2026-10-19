-- ============================================================
-- Media Library
-- FIX: referenced by media_variants, group_media, and milestone_records
-- (all already committed in prior migrations) but never actually created
-- anywhere -- part of the original Media Rights resolution from early in
-- this project (owner, photographer, license, usage rights, attribution)
-- but the CREATE TABLE statement itself was never written. Caught
-- proactively this time, before Media Management work assumed it existed,
-- by checking foreign-key references against actual table definitions
-- after the Discipleship Centre bug revealed this exact failure pattern.
-- ============================================================

CREATE TABLE media (
    media_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,          -- uploader
    file_type TEXT NOT NULL,           -- image | video | audio | document
    file_url TEXT,                     -- R2 path once uploaded (Cloudflare-Verified stage)
    owner TEXT,                        -- e.g. "Heavenly Key Evangelistic Movement"
    photographer_creator TEXT,
    source TEXT,
    license_type TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | public_domain | ministry_owned | licensed
    usage_rights TEXT,
    rights_expiry_date TEXT,
    attribution_required INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    speaker TEXT,
    event TEXT,
    series TEXT,
    bible_references TEXT,
    topic TEXT,
    language TEXT,
    duration_seconds INTEGER,
    description TEXT,
    thumbnail_url TEXT,
    publish_status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
    publish_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX idx_media_publish_status ON media(publish_status);

-- Reuse principle (ACR-010): one media_id, referenced from group_media,
-- media_variants, milestone_records, and the Discipleship Centre's related_content
-- table -- never duplicated per module.
