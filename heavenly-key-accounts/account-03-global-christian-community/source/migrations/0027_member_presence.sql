-- Presence is ephemeral and visible only to mutually accepted friends.
CREATE TABLE IF NOT EXISTS member_presence (
 user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
 last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_member_presence_seen ON member_presence(last_seen_at);
