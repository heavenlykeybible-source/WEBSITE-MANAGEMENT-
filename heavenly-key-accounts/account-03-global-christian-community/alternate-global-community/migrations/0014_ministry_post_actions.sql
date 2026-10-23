DROP TABLE IF EXISTS ministry_editorial_audit_v2_unused;
CREATE TABLE IF NOT EXISTS ministry_editorial_audit_v2 (audit_id INTEGER PRIMARY KEY AUTOINCREMENT,admin_user_id INTEGER NOT NULL REFERENCES users(user_id),action TEXT NOT NULL CHECK(action IN ('publish','reply','edit','remove')),profile_id TEXT NOT NULL,subject_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO ministry_editorial_audit_v2 (audit_id,admin_user_id,action,profile_id,subject_id,created_at) SELECT audit_id,admin_user_id,action,profile_id,subject_id,created_at FROM ministry_editorial_audit;
DROP TABLE ministry_editorial_audit;
ALTER TABLE ministry_editorial_audit_v2 RENAME TO ministry_editorial_audit;
CREATE INDEX IF NOT EXISTS idx_ministry_editorial_audit ON ministry_editorial_audit(created_at DESC);
