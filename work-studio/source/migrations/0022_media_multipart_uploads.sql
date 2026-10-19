-- Multipart uploads keep large media off Worker memory and allow files larger
-- than the Free-plan 100 MB single-request body limit. Upload sessions are
-- short-lived metadata; unfinished R2 multipart uploads are aborted by cron.
CREATE TABLE media_multipart_uploads (
    upload_id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    r2_upload_id TEXT NOT NULL UNIQUE,
    storage_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated', -- initiated | completed | aborted
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    aborted_at TEXT,
    FOREIGN KEY (media_id) REFERENCES media(media_id)
);
CREATE INDEX idx_media_multipart_cleanup ON media_multipart_uploads(status, created_at);
CREATE INDEX idx_media_multipart_media ON media_multipart_uploads(media_id, status);
