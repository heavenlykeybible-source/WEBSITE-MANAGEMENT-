-- Apply to existing Account 9 D1 databases before production rollout.
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id,expires_at);
