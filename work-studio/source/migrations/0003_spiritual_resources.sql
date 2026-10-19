-- ============================================================
-- Global Christian Platform — Module 3: Spiritual Resources
-- Cloudflare D1 Schema (SQLite dialect)
-- NOTE: Seed data below is PLACEHOLDER ONLY. Do not treat as
-- real Scripture, hymn, or audio content. See:
--   BIBLE-SOURCE-RECOMMENDATION.md
--   AUDIO-BIBLE-RECOMMENDATION.md
--   HYMN-CONTENT-RECOMMENDATION.md
-- for the approved-content import process.
-- ============================================================

-- ---------- Bible structure (static reference data) ----------
CREATE TABLE bible_books (
    book_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    testament_order INTEGER NOT NULL,
    testament TEXT NOT NULL  -- 'old' | 'new'
);

CREATE TABLE bible_chapters (
    chapter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    FOREIGN KEY (book_id) REFERENCES bible_books(book_id)
);

CREATE TABLE bible_verses (
    verse_id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    verse_number INTEGER NOT NULL,
    text_kjv TEXT NOT NULL,  -- PLACEHOLDER until source approved — see recommendation doc
    is_placeholder INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (chapter_id) REFERENCES bible_chapters(chapter_id)
);

-- Minimal placeholder seed — structure only, not real text
INSERT INTO bible_books (name, testament_order, testament) VALUES ('John', 43, 'new');
INSERT INTO bible_chapters (book_id, chapter_number) VALUES (1, 3);
INSERT INTO bible_verses (chapter_id, verse_number, text_kjv, is_placeholder) VALUES
 (1, 16, '[PLACEHOLDER — awaiting approved KJV source] Sample verse text goes here.', 1);

-- ---------- Audio Bible (metadata only — no audio imported yet) ----------
CREATE TABLE audio_bible (
    audio_id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    audio_file_url TEXT,          -- NULL until source approved
    duration_seconds INTEGER,
    source_label TEXT,             -- e.g. "LibriVox" — filled in only after approval
    FOREIGN KEY (chapter_id) REFERENCES bible_chapters(chapter_id)
);

-- ---------- Bookmarks, Highlights, Notes (per-user — fully functional regardless of text source) ----------
CREATE TABLE bookmarks (
    bookmark_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    verse_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (verse_id) REFERENCES bible_verses(verse_id)
);

CREATE TABLE highlights (
    highlight_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    verse_id INTEGER NOT NULL,
    color TEXT NOT NULL DEFAULT 'gold',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (verse_id) REFERENCES bible_verses(verse_id)
);

CREATE TABLE bible_notes (
    note_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    verse_id INTEGER NOT NULL,
    note_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (verse_id) REFERENCES bible_verses(verse_id)
);

-- ---------- Reading Plans ----------
CREATE TABLE reading_plans (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_name TEXT NOT NULL,
    duration_days INTEGER NOT NULL
);

CREATE TABLE reading_plan_progress (
    progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    current_day INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (plan_id) REFERENCES reading_plans(plan_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Cross References ----------
CREATE TABLE cross_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verse_id INTEGER NOT NULL,
    related_verse_id INTEGER NOT NULL,
    FOREIGN KEY (verse_id) REFERENCES bible_verses(verse_id),
    FOREIGN KEY (related_verse_id) REFERENCES bible_verses(verse_id)
);

-- ---------- Verse of the Day / Memory Verse engine ----------
CREATE TABLE daily_spiritual_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,   -- 'verse_of_day' | 'memory_verse' | 'devotional' | 'prayer_focus'
    verse_id INTEGER,
    scheduled_date TEXT NOT NULL,
    body TEXT,                    -- devotional meditation/prayer text, if applicable
    created_by INTEGER,
    FOREIGN KEY (verse_id) REFERENCES bible_verses(verse_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);
CREATE INDEX idx_daily_content_date ON daily_spiritual_content(content_type, scheduled_date);

CREATE TABLE memory_verse_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    daily_content_id INTEGER NOT NULL,
    marked_complete INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (daily_content_id) REFERENCES daily_spiritual_content(id)
);

-- ---------- Hymns (structure only — no lyrics/audio imported yet) ----------
CREATE TABLE hymns (
    hymn_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    title TEXT NOT NULL,
    lyrics TEXT,          -- NULL / placeholder until source approved
    audio_file_url TEXT,  -- NULL until source approved
    copyright_status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | public_domain | licensed
    source_label TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE hymn_favourites (
    user_id INTEGER NOT NULL,
    hymn_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, hymn_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (hymn_id) REFERENCES hymns(hymn_id)
);

CREATE TABLE hymn_recently_played (
    user_id INTEGER NOT NULL,
    hymn_id INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (hymn_id) REFERENCES hymns(hymn_id)
);

-- ---------- Kingdom Keys ----------
CREATE TABLE kingdom_keys (
    lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,  -- content author (staff)
    title TEXT NOT NULL,
    teaching TEXT NOT NULL,
    scripture_refs TEXT,
    application TEXT,
    reflection_questions TEXT,
    published_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Faith Challenge ----------
CREATE TABLE faith_challenges (
    challenge_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    week_of TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE faith_challenge_responses (
    response_id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    response_text TEXT NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (challenge_id) REFERENCES faith_challenges(challenge_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
