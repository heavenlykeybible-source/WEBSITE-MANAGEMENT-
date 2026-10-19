-- Enforce the platform policy that only one live broadcast session may be active at a time.
-- The cleanup step keeps the latest session if a pre-existing database somehow contains duplicates.
UPDATE live_broadcast_sessions
SET status = 'ended', ended_at = COALESCE(ended_at, datetime('now'))
WHERE status IN ('live','reconnecting')
  AND session_id <> (
    SELECT MAX(session_id) FROM live_broadcast_sessions WHERE status IN ('live','reconnecting')
  );

CREATE UNIQUE INDEX idx_live_sessions_one_active
ON live_broadcast_sessions((1))
WHERE status IN ('live','reconnecting');
