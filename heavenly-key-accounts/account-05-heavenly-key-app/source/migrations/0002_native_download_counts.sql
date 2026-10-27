-- Private aggregate download request counters, with no visitor identifiers.
CREATE TABLE IF NOT EXISTS native_download_counts (
 app_id TEXT NOT NULL,
 platform TEXT NOT NULL CHECK(platform IN ('android','windows','mac')),
 downloads INTEGER NOT NULL DEFAULT 0 CHECK(downloads >= 0),
 PRIMARY KEY(app_id, platform)
);
