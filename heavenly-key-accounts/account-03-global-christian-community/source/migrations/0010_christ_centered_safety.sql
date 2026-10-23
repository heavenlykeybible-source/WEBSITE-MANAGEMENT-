ALTER TABLE content_reports ADD COLUMN group_id INTEGER REFERENCES groups(group_id);
ALTER TABLE content_reports ADD COLUMN group_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(group_review_status IN ('pending','reviewed'));
ALTER TABLE content_reports ADD COLUMN group_review_note TEXT;
ALTER TABLE content_reports ADD COLUMN group_reviewer_user_id INTEGER REFERENCES users(user_id);
UPDATE content_reports SET group_id=CASE target_type WHEN 'post' THEN (SELECT group_id FROM posts WHERE post_id=target_id) WHEN 'comment' THEN (SELECT p.group_id FROM comments c JOIN posts p ON p.post_id=c.post_id WHERE c.comment_id=target_id) WHEN 'group' THEN target_id END;
CREATE INDEX idx_group_reports ON content_reports(group_id,group_review_status,status);
ALTER TABLE moderation_events ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','reviewed'));
ALTER TABLE moderation_events ADD COLUMN content_type TEXT;
CREATE INDEX idx_pending_moderation ON moderation_events(review_status,moderation_event_id);
CREATE UNIQUE INDEX idx_safety_single_group_review ON safety_audit(target_id) WHERE action='group_report_review';
CREATE UNIQUE INDEX idx_safety_single_flag_review ON safety_audit(target_id) WHERE action='flag_review';
CREATE TABLE account_restrictions (
 restriction_id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(user_id),
 actor_user_id INTEGER NOT NULL REFERENCES users(user_id),
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','lifted')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 lifted_at TEXT,
 lifted_by INTEGER REFERENCES users(user_id)
);
CREATE UNIQUE INDEX idx_one_active_restriction ON account_restrictions(user_id) WHERE status='active';
CREATE UNIQUE INDEX idx_safety_single_unlock ON safety_audit(target_id) WHERE action='account_unlock';
