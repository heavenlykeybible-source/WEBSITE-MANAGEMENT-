-- Review before applying. Keep import objects private until a trusted scanner
-- supplies a clean verdict and the owner explicitly approves the release.
-- This migration does not grant permission or trigger a deployment.
CREATE TABLE IF NOT EXISTS account4_import_release_attestations (
  session_id TEXT PRIMARY KEY REFERENCES account4_import_sessions(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 1073741824),
  verdict TEXT NOT NULL CHECK(verdict IN ('pending','clean','malicious','error')),
  scanned_at TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  CHECK ((approved_by IS NULL AND approved_at IS NULL) OR
         (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
