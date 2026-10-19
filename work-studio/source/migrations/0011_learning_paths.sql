-- ============================================================
-- Learning Paths & Lesson Metadata — Schema Patch (ACR-008)
-- Extends existing Module 3 course infrastructure. All new
-- columns are nullable — no backfill required on existing rows.
-- ============================================================

CREATE TABLE learning_paths (
    path_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,              -- e.g. "New Believers Discipleship", "Ministers Preparation"
    description TEXT,
    audience TEXT,                    -- e.g. 'new_believers' | 'youth' | 'ministers' | 'missionaries' | 'general'
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Courses may optionally belong to a Learning Path and have an order within it.
ALTER TABLE courses ADD COLUMN learning_path_id INTEGER REFERENCES learning_paths(path_id);
ALTER TABLE courses ADD COLUMN path_order INTEGER;

-- Optional lesson metadata (ACR-008) — all nullable.
ALTER TABLE lessons ADD COLUMN difficulty TEXT;              -- beginner | intermediate | advanced
ALTER TABLE lessons ADD COLUMN estimated_minutes INTEGER;
ALTER TABLE lessons ADD COLUMN recommended_age_group TEXT;   -- ministry-set, content governance only
ALTER TABLE lessons ADD COLUMN prerequisite_lesson_id INTEGER REFERENCES lessons(lesson_id);
ALTER TABLE lessons ADD COLUMN theme TEXT;
ALTER TABLE lessons ADD COLUMN ministry_approval_version TEXT;  -- simple version tag, ties to existing approval governance

-- "Related lessons/sermons/devotionals/reading plans" reuse the EXISTING
-- related_content polymorphic table from Module 3 — no new tables.

-- Growth Dashboard requires NO new tables — it is a read-only aggregate over:
--   course_progress, memory_verse_progress, lesson_quiz_results, reading_plan_progress
-- (same pattern as the Module 6 Moderator Dashboard / Community Health view)
