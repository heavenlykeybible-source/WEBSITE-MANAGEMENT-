PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS comments (
  comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  parent_comment_id INTEGER,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','held','removed')),
  moderation_state TEXT NOT NULL DEFAULT 'allowed' CHECK(moderation_state IN ('allowed','warned','held','blocked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(user_id),
  FOREIGN KEY(parent_comment_id) REFERENCES comments(comment_id)
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id,status,created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id INTEGER NOT NULL,
  blocked_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(blocker_user_id,blocked_user_id),
  CHECK(blocker_user_id<>blocked_user_id),
  FOREIGN KEY(blocker_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(blocked_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_reports (
  report_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('post','comment','message','profile','space','group')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','actioned','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reporter_user_id,target_type,target_id,reason),
  FOREIGN KEY(reporter_user_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_content_reports_queue ON content_reports(status,created_at DESC);

CREATE TABLE IF NOT EXISTS community_media (
  media_id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','video','audio')),
  size_bytes INTEGER NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'pending_upload' CHECK(upload_status IN ('pending_upload','uploaded','failed')),
  safety_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(safety_status IN ('pending_review','approved','rejected')),
  safety_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  FOREIGN KEY(owner_user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS post_media (
  post_id INTEGER NOT NULL,
  media_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(post_id,media_id),
  FOREIGN KEY(post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY(media_id) REFERENCES community_media(media_id)
);

CREATE TABLE IF NOT EXISTS saved_prayer_people (
  user_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id,target_user_id),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(target_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
