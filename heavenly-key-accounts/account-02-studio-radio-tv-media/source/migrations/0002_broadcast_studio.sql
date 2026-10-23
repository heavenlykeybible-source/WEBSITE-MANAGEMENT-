-- Broadcast studio configuration and destination controls.
-- Runtime media processing remains client-side/open-source-first; this table
-- stores the selected production configuration and platform toggles.

CREATE TABLE IF NOT EXISTS broadcast_studio_profiles (
  profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  video_format TEXT NOT NULL CHECK(video_format IN ('tiktok_9_16','facebook_3_4','landscape_16_9')),
  width INTEGER NOT NULL CHECK(width > 0),
  height INTEGER NOT NULL CHECK(height > 0),
  camera_mode TEXT NOT NULL DEFAULT 'original' CHECK(camera_mode IN ('original','virtual_background')),
  camera_facing TEXT NOT NULL DEFAULT 'user' CHECK(camera_facing IN ('user','environment')),
  mirror_preview INTEGER NOT NULL DEFAULT 0 CHECK(mirror_preview IN (0,1)),
  microphone_enabled INTEGER NOT NULL DEFAULT 1 CHECK(microphone_enabled IN (0,1)),
  noise_suppression INTEGER NOT NULL DEFAULT 1 CHECK(noise_suppression IN (0,1)),
  echo_cancellation INTEGER NOT NULL DEFAULT 1 CHECK(echo_cancellation IN (0,1)),
  auto_gain_control INTEGER NOT NULL DEFAULT 1 CHECK(auto_gain_control IN (0,1)),
  voice_enhancement INTEGER NOT NULL DEFAULT 1 CHECK(voice_enhancement IN (0,1)),
  programme_banner_enabled INTEGER NOT NULL DEFAULT 0 CHECK(programme_banner_enabled IN (0,1)),
  programme_banner_text TEXT,
  background_ref TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broadcast_destinations (
  destination_id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_key TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('connected','disconnected','error')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO broadcast_destinations(destination_key) VALUES
('website_video'),('website_radio'),('youtube'),('facebook'),('tiktok'),('instagram'),('linkedin'),('x');
