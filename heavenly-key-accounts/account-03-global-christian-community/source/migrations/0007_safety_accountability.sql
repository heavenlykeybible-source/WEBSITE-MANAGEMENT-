PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS safety_decisions (
 decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
 report_id INTEGER NOT NULL UNIQUE REFERENCES content_reports(report_id),
 subject_user_id INTEGER REFERENCES users(user_id),
 actor_user_id INTEGER NOT NULL REFERENCES users(user_id),
 action TEXT NOT NULL CHECK(action IN ('remove','dismiss')),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS safety_requests (
 request_id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(user_id),
 kind TEXT NOT NULL CHECK(kind IN ('appeal','access','deletion','correction','privacy','safety')),
 decision_id INTEGER REFERENCES safety_decisions(decision_id),
 details TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 response TEXT,
 reviewer_user_id INTEGER REFERENCES users(user_id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_safety_requests ON safety_requests(status,created_at);
CREATE TABLE IF NOT EXISTS safety_audit (
 audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_user_id INTEGER NOT NULL REFERENCES users(user_id),
 action TEXT NOT NULL,
 target_type TEXT NOT NULL,
 target_id INTEGER NOT NULL,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS safety_audit_no_update BEFORE UPDATE ON safety_audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
CREATE TRIGGER IF NOT EXISTS safety_audit_no_delete BEFORE DELETE ON safety_audit BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_request_response_once ON safety_audit(target_type,target_id) WHERE action='request_response';
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_appeal ON safety_requests(user_id,decision_id) WHERE kind='appeal' AND status='pending';

CREATE TABLE IF NOT EXISTS account_acknowledgements (
 user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
 policy_version TEXT NOT NULL,
 adult_attestation INTEGER NOT NULL CHECK(adult_attestation=1),
 acknowledged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
