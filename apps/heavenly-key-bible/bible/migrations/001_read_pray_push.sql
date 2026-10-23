CREATE TABLE IF NOT EXISTS read_pray_push (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, local_time TEXT NOT NULL, timezone TEXT NOT NULL, last_sent_day TEXT, claim_until TEXT, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS read_pray_push_updated ON read_pray_push(updated_at);
