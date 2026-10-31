-- Account 4 private import sessions; apply only after migration review and backup.
CREATE TABLE IF NOT EXISTS account4_import_sessions (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE,
  upload_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 1073741824),
  part_count INTEGER NOT NULL CHECK(part_count BETWEEN 1 AND 103),
  state TEXT NOT NULL DEFAULT 'uploading'
    CHECK(state IN ('uploading','private-awaiting-review','aborted','expired')),
  expires_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS account4_import_owner_state
  ON account4_import_sessions(owner_id,state);
CREATE TABLE IF NOT EXISTS account4_import_parts (
  session_id TEXT NOT NULL REFERENCES account4_import_sessions(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK(part_number BETWEEN 1 AND 103),
  etag TEXT NOT NULL,
  PRIMARY KEY(session_id,part_number)
);
