CREATE TABLE IF NOT EXISTS member_passkeys (
  credential_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_member_passkeys_user ON member_passkeys(user_id);
CREATE TABLE IF NOT EXISTS member_passkey_challenges (
  challenge_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('register','login')),
  challenge TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passkey_challenge_expiry ON member_passkey_challenges(expires_at);
