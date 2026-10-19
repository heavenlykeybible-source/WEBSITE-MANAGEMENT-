-- ============================================================
-- Bible Training: Courses, Lessons, Course Progress
-- FIX: these were part of the ORIGINAL Core Domain Model (frozen at the
-- very start of this project -- "Bible Training: Courses, Lessons,
-- Progress, Certificates") but were never actually created in Module 3's
-- migration. The Discipleship Centre extension (0010, formerly 0009)
-- assumed they already existed and only ALTERed them -- a real gap
-- traced back to its root cause by sandbox execution, not assumed fixed
-- by patching the symptom.
-- ============================================================

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
);

CREATE TABLE lessons (
    lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    lesson_order INTEGER,
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE course_progress (
    progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    completion_status TEXT NOT NULL DEFAULT 'not_started',
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
-- Certificates reserved for v2.0 (per Module 3's original design note) --
-- attaches to course_progress when built, per ACR-007's confirmation.
