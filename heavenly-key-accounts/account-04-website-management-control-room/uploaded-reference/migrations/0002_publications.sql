CREATE TABLE IF NOT EXISTS cms_publications (
 site TEXT NOT NULL,kind TEXT NOT NULL,entry_key TEXT NOT NULL,content TEXT NOT NULL,
 revision_version INTEGER NOT NULL,published_by TEXT NOT NULL,
 published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(site,kind,entry_key)
);
CREATE TABLE IF NOT EXISTS cms_publication_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,site TEXT NOT NULL,kind TEXT NOT NULL,entry_key TEXT NOT NULL,
 content TEXT NOT NULL,revision_version INTEGER NOT NULL,published_by TEXT NOT NULL,
 published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cms_publication_lookup ON cms_publication_history(site,kind,entry_key,id DESC);
CREATE TABLE IF NOT EXISTS cms_ai_limits (bucket_key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
