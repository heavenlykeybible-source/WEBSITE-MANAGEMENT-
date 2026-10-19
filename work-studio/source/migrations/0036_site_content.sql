-- Editable public homepage content.
-- Values are plain text only. The application exposes only the allow-listed keys
-- defined in src/routes/site-content.ts; no arbitrary HTML or scripts are stored.

CREATE TABLE IF NOT EXISTS site_content (
  content_key TEXT PRIMARY KEY,
  content_value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(user_id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_content_updated_at
  ON site_content(updated_at);
