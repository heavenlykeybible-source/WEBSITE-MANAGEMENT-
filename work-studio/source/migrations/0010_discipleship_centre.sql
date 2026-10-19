-- ============================================================
-- Discipleship Centre — Schema Extension (ACR-007)
-- Extends Module 3's existing COURSES / LESSONS / COURSE_PROGRESS.
-- No parallel system created — see ACR-007 Architectural Finding.
-- ============================================================

-- Richer lesson fields, added to the EXISTING `lessons` table from Module 3.
ALTER TABLE lessons ADD COLUMN memory_verse_ref TEXT;
ALTER TABLE lessons ADD COLUMN lesson_objectives TEXT;
ALTER TABLE lessons ADD COLUMN main_reading_ref TEXT;         -- primary KJV passage for the lesson
ALTER TABLE lessons ADD COLUMN scripture_explanation TEXT;
ALTER TABLE lessons ADD COLUMN supporting_scriptures TEXT;    -- structured list, collapsible in UI
ALTER TABLE lessons ADD COLUMN reflection_questions TEXT;
ALTER TABLE lessons ADD COLUMN practical_application TEXT;
ALTER TABLE lessons ADD COLUMN prayer_points TEXT;
ALTER TABLE lessons ADD COLUMN recommended_maturity TEXT;     -- nullable; ministry-set, e.g. 'general' | 'adult' — content governance only, not a technical restriction

-- Quiz support — new tables, since Module 3 had no knowledge-check concept yet.
CREATE TABLE lesson_quiz_questions (
    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    options TEXT NOT NULL,   -- structured list of answer choices
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id)
);

CREATE TABLE lesson_quiz_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Discipleship Centre "flagship" course — the 21-lesson curriculum, seeded as data,
-- not a new schema concept. Uses the EXISTING `courses` and `lessons` tables.
-- (Illustrative seed — full 21 lessons authored by Ministry Leadership, not invented here.)
INSERT INTO courses (title, description) VALUES
  ('The Discipleship Centre — Foundations', 'A structured path from conversion to spiritual maturity, using the King James Bible.');

-- Cross-linking to devotionals, sermons, testimonies, and Q&A reuses the EXISTING
-- `related_content` polymorphic table from Module 3 — e.g.:
--   source_type='lesson', source_id=<lesson_id>, related_type='testimony', related_id=<testimony_id>
-- No new join tables required for "related sermons / devotionals / testimonies."

-- Discipleship Insight (platform-wide widget) requires NO new table — it is a query
-- against `lessons` + `daily_spiritual_content`-style rotation logic already built
-- for Verse of the Day, reusing the same caching pattern (Volume 2 §7).

-- Community integration (lesson discussion, Q&A, prayer requests tied to a lesson,
-- group study) reuses the EXISTING polymorphic content_type/content_id pattern —
-- content_type = 'lesson' becomes a valid value alongside 'testimony', 'discussion', etc.
-- across comments, reactions, prayer_requests linkage, and questions.
