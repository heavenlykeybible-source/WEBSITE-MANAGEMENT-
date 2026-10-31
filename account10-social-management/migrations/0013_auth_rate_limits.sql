-- Rate-limit failed private-API credentials by a one-way hash of the Cloudflare edge IP.
-- Raw IP addresses are never stored. One rolling 15-minute bucket per address.
CREATE TABLE IF NOT EXISTS auth_rate_limits(
 client_hash TEXT PRIMARY KEY CHECK(length(client_hash)=64),
 window_start INTEGER NOT NULL,
 failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK(failed_attempts>=0),
 blocked_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits(window_start);
