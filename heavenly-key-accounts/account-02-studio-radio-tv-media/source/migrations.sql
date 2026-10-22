-- Heavenly Key Media/Broadcast Engine schema.
-- This database contains operational media/broadcast metadata only.
-- Temporary media objects are lifecycle-managed; permanent retention requires keep_media=1.

CREATE TABLE IF NOT EXISTS media_objects (
  media_id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK(media_type IN ('image','audio','video')),
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','published','deleted','failed')),
  keep_media INTEGER NOT NULL DEFAULT 0 CHECK(keep_media IN (0,1)),
  retention_until TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_expiry ON media_objects(retention_until, keep_media, status);

CREATE TABLE IF NOT EXISTS live_sessions (
  session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('offline','live','reconnecting','ended')),
  source_type TEXT NOT NULL CHECK(source_type IN ('camera','picture_audio','bible','hymn','video')),
  source_ref TEXT,
  visual_media_id INTEGER,
  fallback_media_id INTEGER,
  started_at TEXT,
  last_heartbeat_at TEXT,
  reconnect_deadline TEXT,
  ended_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_live ON live_sessions((1)) WHERE status IN ('live','reconnecting');

CREATE TABLE IF NOT EXISTS playout_items (
  playout_id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','playing','completed','cancelled')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_playout_window ON playout_items(starts_at, ends_at, status);

CREATE TABLE IF NOT EXISTS social_accounts (
  account_id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_name TEXT NOT NULL,
  provider_account_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','disabled','error')),
  automatable INTEGER NOT NULL DEFAULT 1 CHECK(automatable IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_name, provider_account_ref)
);

CREATE TABLE IF NOT EXISTS distribution_jobs (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER,
  recording_id INTEGER,
  account_id INTEGER NOT NULL,
  channel_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_distribution_media_account_channel ON distribution_jobs(media_id, account_id, channel_name) WHERE media_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_distribution_recording_account_channel ON distribution_jobs(recording_id, account_id, channel_name) WHERE recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recordings (
  recording_id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  live_session_id INTEGER,
  keep_recording INTEGER NOT NULL DEFAULT 0 CHECK(keep_recording IN (0,1)),
  retention_until TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','distributing','delivered','failed','deleted')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recording_expiry ON recordings(retention_until, keep_recording, status);

CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  media_id INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','processing','completed','cancelled','failed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_campaign_schedule ON campaigns(scheduled_for, status);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
