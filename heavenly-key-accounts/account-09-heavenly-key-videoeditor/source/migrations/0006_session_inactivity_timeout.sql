-- Apply once to an existing Account 9 D1 database after a verified backup.
-- Existing sessions were created with a fixed 30-day expires_at lifetime.
-- Use their original login timestamp as the initial inactivity baseline.
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER;
UPDATE sessions SET last_seen_at = expires_at - 2592000000 WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_last_seen ON sessions(user_id,last_seen_at);
