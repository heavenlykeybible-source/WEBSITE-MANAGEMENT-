-- Serializes broadcast start/stop operations across Cloudflare Worker isolates.
CREATE TABLE IF NOT EXISTS restream_operation_lock (
  lock_name TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
