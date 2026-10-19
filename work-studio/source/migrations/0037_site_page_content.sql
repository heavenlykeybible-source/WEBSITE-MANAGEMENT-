-- Site-wide safe page editor
CREATE TABLE IF NOT EXISTS site_page_content (
  page_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','image','alt')),
  content_value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_key, field_key)
);
CREATE INDEX IF NOT EXISTS idx_site_page_content_page ON site_page_content(page_key);
