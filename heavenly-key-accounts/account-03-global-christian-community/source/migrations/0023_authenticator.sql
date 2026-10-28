CREATE TABLE IF NOT EXISTS account_authenticators (
  user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  sealed_secret TEXT NOT NULL,
  setup_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  last_step INTEGER NOT NULL DEFAULT -1,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS authenticator_recovery_codes (
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  PRIMARY KEY(user_id, code_hash)
);
