-- Upgrade ONLY from the schema shipped with the previous Control Room package.
-- Back up D1 first. Apply once; SQLite does not support ADD COLUMN IF NOT EXISTS.
ALTER TABLE upload_files ADD COLUMN object_key TEXT;
ALTER TABLE upload_files ADD COLUMN object_etag TEXT;
CREATE TABLE proposal_reviews (proposal_id INTEGER NOT NULL, user_id INTEGER NOT NULL, candidate_hash TEXT NOT NULL, baseline_hash TEXT NOT NULL, snapshot_hash TEXT NOT NULL, manifest_json TEXT NOT NULL, expires_at INTEGER NOT NULL, previewed_at INTEGER, PRIMARY KEY(proposal_id,user_id));
CREATE TABLE operation_locks (lock_key TEXT PRIMARY KEY, token TEXT NOT NULL, acquired_at INTEGER NOT NULL);
CREATE TABLE releases (id TEXT PRIMARY KEY, proposal_id INTEGER NOT NULL, owner_id INTEGER, user_id INTEGER NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, target_key TEXT NOT NULL, candidate_hash TEXT NOT NULL, snapshot_hash TEXT NOT NULL, before_json TEXT NOT NULL, after_hash TEXT, status TEXT NOT NULL, result_json TEXT, error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT);
CREATE INDEX releases_owner_date ON releases(owner_id,created_at);
CREATE INDEX releases_proposal ON releases(proposal_id);
