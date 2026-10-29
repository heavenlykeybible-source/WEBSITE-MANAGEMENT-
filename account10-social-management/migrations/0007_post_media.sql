-- Apply after schema.sql and migrations 0002-0006.
ALTER TABLE social_posts ADD COLUMN media_id TEXT;
CREATE INDEX IF NOT EXISTS idx_social_posts_media ON social_posts(media_id);
