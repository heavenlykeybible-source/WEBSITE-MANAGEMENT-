-- Live broadcast resilience: 10-minute reconnect grace + fallback slate.
CREATE TABLE live_broadcast_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'live', -- live | reconnecting | ended
    fallback_media_id INTEGER,
    reconnect_started_at TEXT,
    reconnect_deadline TEXT,
    last_heartbeat_at TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    recording_id INTEGER,
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id),
    FOREIGN KEY (fallback_media_id) REFERENCES media(media_id),
    FOREIGN KEY (recording_id) REFERENCES broadcast_recordings(recording_id)
);
CREATE INDEX idx_live_sessions_status ON live_broadcast_sessions(status, reconnect_deadline);
CREATE INDEX idx_live_sessions_heartbeat ON live_broadcast_sessions(status, last_heartbeat_at);
