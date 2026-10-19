-- Follow-up fixes for public website integration.
-- 1) Preserve the type of salvation decision submitted by the public website.
-- 2) Ensure public_site_submissions allows prayer/testimony even if 0029 was
--    already applied before those intake types were added.

ALTER TABLE decisions ADD COLUMN decision_type TEXT;

ALTER TABLE public_site_submissions RENAME TO public_site_submissions_old;

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

INSERT INTO public_site_submissions
  (submission_id, submission_type, payload_encrypted, payload_iv, status, created_at, reviewed_at, reviewed_by)
SELECT submission_id, submission_type, payload_encrypted, payload_iv, status, created_at, reviewed_at, reviewed_by
FROM public_site_submissions_old;

DROP TABLE public_site_submissions_old;

CREATE INDEX idx_public_site_submissions_type_status
  ON public_site_submissions(submission_type, status, created_at);
