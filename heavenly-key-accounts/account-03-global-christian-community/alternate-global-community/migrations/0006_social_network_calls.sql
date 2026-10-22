-- Temporary call signalling only. Audio and video are never stored.
CREATE TABLE IF NOT EXISTS saved_posts (
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS network_calls (
  call_id TEXT PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(conversation_id),
  caller_id INTEGER NOT NULL REFERENCES users(user_id),
  recipient_id INTEGER NOT NULL REFERENCES users(user_id),
  mode TEXT NOT NULL CHECK(mode IN ('voice','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK(status IN ('ringing','accepted','ended','declined')),
  offer TEXT,
  answer TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS network_calls_recipient ON network_calls(recipient_id,status,expires_at);
CREATE INDEX IF NOT EXISTS network_calls_expiry ON network_calls(expires_at);
CREATE TABLE IF NOT EXISTS network_call_members (
  user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
  call_id TEXT NOT NULL REFERENCES network_calls(call_id) ON DELETE CASCADE
);

-- Bound feed and message scans to the requested stream or conversation.
CREATE INDEX IF NOT EXISTS idx_network_posts_latest ON posts(status,post_id DESC);
CREATE INDEX IF NOT EXISTS idx_network_posts_group ON posts(group_id,status,post_id DESC);
CREATE INDEX IF NOT EXISTS idx_network_posts_space ON posts(author_space_id,status,post_id DESC);
CREATE INDEX IF NOT EXISTS idx_network_reactions_post ON reactions(post_id,reaction_type);
CREATE INDEX IF NOT EXISTS idx_network_messages_thread ON messages(conversation_id,status,message_id DESC);
