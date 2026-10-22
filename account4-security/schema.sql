-- Account 4: proposed central security case storage for Cloudflare D1.
-- Deployment requires creating/binding a D1 database and integrating authenticated Workers.
-- This migration does not itself hold users or grant administrator privileges.
CREATE TABLE IF NOT EXISTS security_cases (
  id TEXT PRIMARY KEY,
  subject_site TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','on_hold','verification_pending','restored','suspended','dismissed')),
  reason_code TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
  evidence_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  reviewed_by TEXT,
  UNIQUE(subject_site,subject_user_id,status)
);
CREATE INDEX IF NOT EXISTS security_cases_status_idx ON security_cases(status,created_at);
CREATE INDEX IF NOT EXISTS security_cases_subject_idx ON security_cases(subject_site,subject_user_id);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  site TEXT NOT NULL,
  subject_user_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('info','low','medium','high','critical')),
  details_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(case_id) REFERENCES security_cases(id)
);
CREATE INDEX IF NOT EXISTS security_events_site_time_idx ON security_events(site,occurred_at);

CREATE TABLE IF NOT EXISTS security_verification_challenges (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','expired','revoked')),
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(case_id) REFERENCES security_cases(id)
);

CREATE TABLE IF NOT EXISTS security_audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  case_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(case_id) REFERENCES security_cases(id)
);
