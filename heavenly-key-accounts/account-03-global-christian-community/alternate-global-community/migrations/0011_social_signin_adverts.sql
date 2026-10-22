PRAGMA foreign_keys=ON;
CREATE TABLE social_identities (
 provider TEXT NOT NULL CHECK(provider IN ('google','facebook')),
 subject TEXT NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(user_id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(provider,subject),
 UNIQUE(provider,user_id)
);
CREATE TABLE social_login_flows (
 state TEXT PRIMARY KEY,
 provider TEXT NOT NULL,
 payload TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX idx_social_flow_expiry ON social_login_flows(expires_at);
CREATE TABLE community_adverts (
 advert_id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 sponsor TEXT NOT NULL,
 link_url TEXT NOT NULL,
 image_url TEXT,
 button_label TEXT NOT NULL DEFAULT 'Learn more',
 placement TEXT NOT NULL CHECK(placement IN ('feed','sidebar','banner')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','paused','archived')),
 starts_at TEXT,
 ends_at TEXT,
 priority INTEGER NOT NULL DEFAULT 0,
 created_by INTEGER NOT NULL REFERENCES users(user_id),
 updated_by INTEGER NOT NULL REFERENCES users(user_id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_adverts_delivery ON community_adverts(status,placement,priority,advert_id);
CREATE TABLE advert_images (
 image_id TEXT PRIMARY KEY,
 object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL,
 created_by INTEGER NOT NULL REFERENCES users(user_id),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
