-- ============================================================
-- Global Christian Platform — Module 3 Addendum
-- Expanded Hymns · Prayer Guides · Bible Dictionary · Bible Maps
-- · Universal Cross-Linking
-- ============================================================

-- ---------- Hymns: expanded fields ----------
ALTER TABLE hymns ADD COLUMN hymn_number INTEGER;
ALTER TABLE hymns ADD COLUMN first_line TEXT;
ALTER TABLE hymns ADD COLUMN author TEXT;
ALTER TABLE hymns ADD COLUMN composer TEXT;
ALTER TABLE hymns ADD COLUMN year_written INTEGER;
ALTER TABLE hymns ADD COLUMN scripture_ref TEXT;
ALTER TABLE hymns ADD COLUMN theme TEXT;
ALTER TABLE hymns ADD COLUMN meter TEXT;
ALTER TABLE hymns ADD COLUMN tune_name TEXT;
ALTER TABLE hymns ADD COLUMN musical_key TEXT;          -- reserved for future use
ALTER TABLE hymns ADD COLUMN chorus_text TEXT;
ALTER TABLE hymns ADD COLUMN verses_text TEXT;           -- structured verses, separate from chorus
ALTER TABLE hymns ADD COLUMN sheet_music_url TEXT;       -- reserved for future use (R2)
ALTER TABLE hymns ADD COLUMN pdf_download_url TEXT;      -- reserved for future use (R2)

-- ---------- Prayer Guides ----------
CREATE TABLE prayer_guides (
    guide_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,             -- e.g. "Morning Prayer", "Prayer During Persecution"
    scripture_ref TEXT,
    prayer_points TEXT NOT NULL,     -- structured text/JSON list
    audio_url TEXT,                  -- reserved for future use
    created_by INTEGER NOT NULL,     -- content author (staff)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- ---------- Bible Dictionary ----------
CREATE TABLE bible_dictionary (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    entry_type TEXT NOT NULL,   -- 'name' | 'place' | 'event' | 'object' | 'custom' | 'feast' | 'measure'
    definition TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_dictionary_term ON bible_dictionary(term);

-- ---------- Bible Maps (future-ready, lightweight now) ----------
CREATE TABLE bible_maps (
    map_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,        -- e.g. "Paul's First Missionary Journey"
    description TEXT,
    map_image_url TEXT,         -- reserved — no maps imported yet
    status TEXT NOT NULL DEFAULT 'planned'  -- planned | active
);

-- ---------- Universal Cross-Linking (reuses the polymorphic pattern already frozen) ----------
-- Links ANY content item to ANY other content item, in either direction.
CREATE TABLE related_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,     -- 'bible_verse' | 'devotional' | 'kingdom_keys' | 'prayer_guide' | 'testimony' | 'hymn' | 'dictionary_entry'
    source_id INTEGER NOT NULL,
    related_type TEXT NOT NULL,
    related_id INTEGER NOT NULL,
    relationship_note TEXT,        -- optional, e.g. "referenced in" or "same theme"
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_related_source ON related_content(source_type, source_id);
CREATE INDEX idx_related_target ON related_content(related_type, related_id);

-- Example: Bible verse -> related devotional, Kingdom Keys lesson, prayer guide, testimony, hymn, dictionary entry
-- all live in this ONE table rather than six separate join tables — one place to query, one place to maintain.
