-- Mutual friend requests are separate from one-way Global Connections.
CREATE TABLE IF NOT EXISTS friend_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipient_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(sender_user_id <> recipient_user_id),
  UNIQUE(sender_user_id,recipient_user_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_received ON friend_requests(recipient_user_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sent ON friend_requests(sender_user_id,status,created_at);
