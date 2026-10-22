-- Add missing ministry tables only; never alter, delete, or republish existing content.
CREATE TABLE IF NOT EXISTS ministry_editorial_posts (post_id INTEGER PRIMARY KEY AUTOINCREMENT,profile_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'published',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_ministry_editorial_posts ON ministry_editorial_posts(post_id DESC);
CREATE TABLE IF NOT EXISTS ministry_editorial_messages (message_id INTEGER PRIMARY KEY AUTOINCREMENT,profile_id TEXT NOT NULL,member_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,sender_kind TEXT NOT NULL CHECK(sender_kind IN ('member','ministry')),body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_ministry_editorial_inbox ON ministry_editorial_messages(profile_id,member_user_id,message_id);
CREATE TABLE IF NOT EXISTS ministry_editorial_audit (audit_id INTEGER PRIMARY KEY AUTOINCREMENT,admin_user_id INTEGER NOT NULL REFERENCES users(user_id),action TEXT NOT NULL CHECK(action IN ('publish','reply','edit','remove')),profile_id TEXT NOT NULL,subject_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_ministry_editorial_audit ON ministry_editorial_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS ministry_bulk_activation_audit (audit_id INTEGER PRIMARY KEY AUTOINCREMENT,admin_user_id INTEGER NOT NULL REFERENCES users(user_id),activated_count INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
