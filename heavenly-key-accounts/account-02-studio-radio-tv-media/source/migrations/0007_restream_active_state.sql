-- Authoritative broadcast state. D1 reads/writes avoid KV's eventual-consistency window.
CREATE TABLE IF NOT EXISTS restream_active_state (
  state_key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
