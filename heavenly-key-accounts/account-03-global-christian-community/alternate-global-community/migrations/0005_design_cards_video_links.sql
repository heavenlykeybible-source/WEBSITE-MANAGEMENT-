-- Additive migration: existing posts and approved legacy media are retained.
ALTER TABLE posts ADD COLUMN post_format TEXT NOT NULL DEFAULT 'article' CHECK(post_format IN ('design_card','article','video_link'));
ALTER TABLE posts ADD COLUMN design_category TEXT NOT NULL DEFAULT 'faith';
ALTER TABLE posts ADD COLUMN design_settings TEXT;
ALTER TABLE posts ADD COLUMN scripture TEXT;
ALTER TABLE posts ADD COLUMN video_url TEXT;
ALTER TABLE posts ADD COLUMN video_provider TEXT;
