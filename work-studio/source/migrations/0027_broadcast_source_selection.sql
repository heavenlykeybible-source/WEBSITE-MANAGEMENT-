-- Lightweight broadcast source configuration.
-- The Worker stores the selected source; actual media transport/encoding remains external.
ALTER TABLE live_broadcast_sessions ADD COLUMN source_type TEXT;
ALTER TABLE live_broadcast_sessions ADD COLUMN source_ref_id INTEGER;
ALTER TABLE live_broadcast_sessions ADD COLUMN source_media_id INTEGER;
ALTER TABLE live_broadcast_sessions ADD COLUMN visual_media_id INTEGER;
CREATE INDEX idx_live_sessions_source ON live_broadcast_sessions(source_type, source_ref_id);
