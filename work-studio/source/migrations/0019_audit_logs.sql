-- ============================================================
-- Audit Logs
-- FIX: "audit everything sensitive" has been a load-bearing security
-- principle since Volume 3 (Rule C) -- login, role changes, content
-- approval/deletion, identity reveals, Decisions/Counselling access,
-- permission changes -- but no CREATE TABLE audit_logs statement was
-- ever actually written anywhere in this project. This is the third
-- instance of the same root-cause pattern (courses/lessons, media,
-- now this) -- caught this time BEFORE it ran, by checking first,
-- rather than discovered by a crash.
-- ============================================================

CREATE TABLE audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    reason TEXT,
    result TEXT NOT NULL DEFAULT 'success',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at);
