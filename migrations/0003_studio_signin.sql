-- Additive only; no existing identity, password, secret or binding changes.
CREATE TABLE IF NOT EXISTS studio_signin_codes (
 code_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, pass_ver INTEGER NOT NULL,
 state TEXT NOT NULL, audience TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_signin_expiry ON studio_signin_codes(expires_at);
