-- Public website intake forms.
-- Sensitive form payloads are encrypted at the application layer before storage.
CREATE TABLE public_site_submissions (
  submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_type TEXT NOT NULL CHECK(submission_type IN ('contact','newsletter','partner','prayer','testimony')),
  payload_encrypted TEXT NOT NULL,
  payload_iv TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by INTEGER,
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);
CREATE INDEX idx_public_site_submissions_type_status
  ON public_site_submissions(submission_type, status, created_at);
