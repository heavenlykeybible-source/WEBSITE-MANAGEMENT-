-- Draft only. Requires existing profiles.active_auto_share from 0011_active_status.sql.
-- ACTIVE contains explicitly published post content; it is never a presence directory.
CREATE TABLE active_entries (
  post_id INTEGER PRIMARY KEY REFERENCES posts(post_id) ON DELETE CASCADE,
  author_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  publication_mode TEXT NOT NULL CHECK(publication_mode IN ('automatic','manual')),
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX active_entries_expiry ON active_entries(expires_at,post_id);
-- Automatic publication is transactional with the post insert, future-only and opt-in.
CREATE TRIGGER active_publish_opt_in AFTER INSERT ON posts
WHEN NEW.status='active' AND NEW.moderation_state='allowed'
 AND NEW.author_space_id IS NULL AND NEW.group_id IS NULL
 AND NEW.visibility IN ('public','connections') AND NEW.post_format IN ('design_card','article')
 AND EXISTS(SELECT 1 FROM profiles WHERE user_id=NEW.author_user_id AND active_auto_share=1)
BEGIN
 INSERT INTO active_entries(post_id,author_user_id,publication_mode,expires_at)
 VALUES(NEW.post_id,NEW.author_user_id,'automatic',datetime('now','+24 hours'));
END;
