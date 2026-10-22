-- Enable LiveKit browser camera/microphone ingest without changing the existing source_type contract.
-- Live sessions keep source_type='camera' and store source_ref='livekit:<room>'.
CREATE INDEX IF NOT EXISTS idx_live_sessions_source_ref ON live_sessions(source_ref);
