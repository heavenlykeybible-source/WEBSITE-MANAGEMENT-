-- WordPress-like visual website editor with isolated drafts and revision history.
-- No production schema change occurs until owner approves deployment.
CREATE TABLE IF NOT EXISTS site_cms_drafts (
 page_key TEXT PRIMARY KEY,
 content_json TEXT NOT NULL,
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_cms_revisions (
 revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
 page_key TEXT NOT NULL,
 content_json TEXT NOT NULL,
 action TEXT NOT NULL,
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_site_cms_revisions_page ON site_cms_revisions(page_key,revision_id DESC);
CREATE TABLE IF NOT EXISTS site_cms_slider_state (
 slider_key TEXT PRIMARY KEY,
 draft_json TEXT,
 published_json TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_cms_slider_revisions (
 revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
 slides_json TEXT NOT NULL,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_cms_assets (
 asset_id TEXT PRIMARY KEY,
 object_key TEXT UNIQUE NOT NULL,
 filename TEXT NOT NULL,
 mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 8388608),
 archived INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Editable homepage section layout and independently versioned unpublished drafts.
CREATE TABLE IF NOT EXISTS site_cms_layout (
 page_key TEXT PRIMARY KEY,
 draft_json TEXT,
 published_json TEXT,
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_cms_layout_revisions (
 revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
 page_key TEXT NOT NULL,
 layout_json TEXT NOT NULL,
 action TEXT NOT NULL,
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cms_layout_history ON site_cms_layout_revisions(page_key,revision_id DESC);
