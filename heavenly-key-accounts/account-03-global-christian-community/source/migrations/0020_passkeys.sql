-- Public WebAuthn credentials only; biometric templates stay on the device.
CREATE TABLE IF NOT EXISTS member_passkeys (
 credential_id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 rp_id TEXT NOT NULL,
 public_key TEXT NOT NULL,
 counter INTEGER NOT NULL DEFAULT 0,
 transports TEXT NOT NULL DEFAULT '[]',
 label TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS member_passkeys_user ON member_passkeys(user_id,rp_id);
CREATE TABLE IF NOT EXISTS member_passkey_flows (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 origin TEXT NOT NULL,
 challenge TEXT NOT NULL,
 password_version TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS member_passkey_flows_expiry ON member_passkey_flows(expires_at);
