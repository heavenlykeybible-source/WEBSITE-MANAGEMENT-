CREATE TABLE IF NOT EXISTS account_rate_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_rate_expiry ON account_rate_limits(expires_at);
