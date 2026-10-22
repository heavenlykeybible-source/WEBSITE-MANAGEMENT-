CREATE TABLE broadcast_settings (
 channel TEXT PRIMARY KEY CHECK(channel IN ('radio','video')),
 playlist_enabled INTEGER NOT NULL DEFAULT 1 CHECK(playlist_enabled IN (0,1))
);
INSERT INTO broadcast_settings(channel) VALUES ('radio'),('video');
ALTER TABLE live_sessions ADD COLUMN destination TEXT NOT NULL DEFAULT 'both' CHECK(destination IN ('radio','video','both'));
