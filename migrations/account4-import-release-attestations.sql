-- Review before applying. Keep import objects private until a trusted scanner
-- supplies a clean verdict and the owner explicitly approves the release.
-- This migration does not grant permission or trigger a deployment.
CREATE TABLE IF NOT EXISTS account4_import_release_attestations (
  session_id TEXT PRIMARY KEY REFERENCES account4_import_sessions(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 1073741824),
  verdict TEXT NOT NULL CHECK(verdict IN ('pending','clean','malicious','error')),
  scanned_at TEXT,
  scanned_version TEXT CHECK(scanned_version IS NULL OR (length(scanned_version) BETWEEN 8 AND 256)),
  scanned_sha256 TEXT CHECK(scanned_sha256 IS NULL OR (length(scanned_sha256)=64 AND scanned_sha256 NOT GLOB '*[^0-9a-f]*')),
  approved_sha256 TEXT CHECK(approved_sha256 IS NULL OR (length(approved_sha256)=64 AND approved_sha256 NOT GLOB '*[^0-9a-f]*')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  CHECK ((approved_by IS NULL AND approved_at IS NULL AND approved_sha256 IS NULL) OR
         (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approved_sha256 IS NOT NULL))
);
