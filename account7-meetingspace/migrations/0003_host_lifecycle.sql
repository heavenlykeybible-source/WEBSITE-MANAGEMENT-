-- Hosts may reserve room IDs before they actually begin meeting.
-- host_joined_at is set by trusted Durable Object host admission, not a browser timestamp.
-- Retain started_at as reservation creation time for compatibility.
ALTER TABLE meeting_sessions ADD COLUMN host_joined_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_host_join ON meeting_sessions(owner_user_id,host_joined_at);
