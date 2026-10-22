CREATE TABLE IF NOT EXISTS media_uploads (
 media_id INTEGER PRIMARY KEY REFERENCES media_objects(media_id),
 upload_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 chunk_bytes INTEGER NOT NULL, total_bytes INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'uploading', expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS media_upload_parts (
 media_id INTEGER NOT NULL, part_number INTEGER NOT NULL,
 etag TEXT NOT NULL, size_bytes INTEGER NOT NULL,
 PRIMARY KEY(media_id,part_number)
);
