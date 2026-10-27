-- Account 5 only. Never expose this table through public routes.
CREATE TABLE IF NOT EXISTS native_download_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','windows','mac')),
  downloaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_download_events_app_platform ON native_download_events(app_id, platform);
