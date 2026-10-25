-- Apply only after verifying existing open sessions and owner lifecycle.
-- Prevent concurrent unclosed reservations from consuming one quota multiple times.
-- Requires historical unclosed sessions to be reconciled before migration.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_sessions_one_open_per_owner
ON meeting_sessions(owner_user_id)
WHERE ended_at IS NULL;
