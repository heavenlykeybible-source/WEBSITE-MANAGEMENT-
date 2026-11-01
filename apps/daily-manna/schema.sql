-- Dedicated Daily Manna D1 database; run migrations before deploying the application.
CREATE TABLE IF NOT EXISTS manna_entries (
 id TEXT PRIMARY KEY, publish_date TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 scripture TEXT NOT NULL, body TEXT NOT NULL, prayer TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','published','corrected')),
 revision INTEGER NOT NULL DEFAULT 1, approved_revision INTEGER,
 release_mode TEXT CHECK(release_mode IN ('reviewed','unreviewed')),
 approved_at TEXT, published_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS manna_subscribers (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, verified INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 0, token_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS manna_deliveries (
 id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, destination TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0, error TEXT, provider_post_id TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(entry_id,destination)
);
CREATE INDEX IF NOT EXISTS idx_manna_status_date ON manna_entries(status,publish_date);

-- Editorial audit trail. Store no bearer tokens or subscriber secrets here.
CREATE TABLE IF NOT EXISTS manna_audit (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL CHECK(action IN ('created','edited','approved','published','corrected','image_uploaded','image_removed')),
 entry_id TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manna_audit_entry ON manna_audit(entry_id,created_at);

-- Optional uploaded header: empty image_date is default, YYYY-MM-DD is a day override.
CREATE TABLE IF NOT EXISTS manna_post_images (
 image_date TEXT PRIMARY KEY,
 object_key TEXT NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Immutable historical copies captured before each published correction.
CREATE TABLE IF NOT EXISTS manna_entry_revisions (
 entry_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 publish_date TEXT NOT NULL,
 title TEXT NOT NULL,
 scripture TEXT NOT NULL,
 body TEXT NOT NULL,
 prayer TEXT NOT NULL,
 captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(entry_id, revision)
);
