-- Named, revocable operator credentials. Token hashes only; plaintext tokens are never stored.
CREATE TABLE IF NOT EXISTS operator_credentials(
 id TEXT PRIMARY KEY,
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
 token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
 role TEXT NOT NULL CHECK(role IN ('operator','viewer')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_operator_credentials_active ON operator_credentials(active,expires_at);
