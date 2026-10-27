CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_type TEXT NOT NULL, payload TEXT NOT NULL, processing_status TEXT NOT NULL DEFAULT 'pending', received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(processing_status, received_at);
