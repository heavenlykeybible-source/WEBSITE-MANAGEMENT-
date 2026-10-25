-- Apply once to an existing D1 database after taking a backup.
-- A new database created from schema.sql already includes this index.
CREATE INDEX IF NOT EXISTS idx_audit_user_action_at ON audit(user_id,action,at);
