-- Secure OAuth provider application configuration for dashboard-managed social connectors.
CREATE TABLE IF NOT EXISTS social_provider_apps (
  platform TEXT PRIMARY KEY CHECK(platform IN ('facebook','instagram','youtube','tiktok','x','linkedin')),
  client_id TEXT NOT NULL,
  client_secret_ciphertext TEXT NOT NULL,
  client_secret_iv TEXT NOT NULL,
  configured INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(updated_by) REFERENCES users(user_id)
);
