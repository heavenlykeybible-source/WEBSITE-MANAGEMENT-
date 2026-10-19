-- Spiritual resource media links.
-- Audio/video files are ministry-owned/approved R2 objects referenced by ID;
-- no external/random media URLs are used for playback.
ALTER TABLE audio_bible ADD COLUMN media_id INTEGER;
ALTER TABLE hymns ADD COLUMN media_id INTEGER;
CREATE INDEX idx_audio_bible_media ON audio_bible(media_id);
CREATE INDEX idx_hymns_media ON hymns(media_id);
