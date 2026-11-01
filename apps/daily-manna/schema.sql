-- Dedicated Daily Manna D1 database; run migrations before deploying the application.
CREATE TABLE IF NOT EXISTS manna_entries (
 id TEXT PRIMARY KEY, publish_date TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 scripture TEXT NOT NULL, body TEXT NOT NULL, prayer TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','published')),
 revision INTEGER NOT NULL DEFAULT 1, approved_revision INTEGER,
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
 attempts INTEGER NOT NULL DEFAULT 0, error TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(entry_id,destination)
);
CREATE INDEX IF NOT EXISTS idx_manna_status_date ON manna_entries(status,publish_date);
