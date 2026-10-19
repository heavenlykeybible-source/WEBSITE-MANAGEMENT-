-- ============================================================
-- Ministry Relationship Management (ACR-016)
-- Timeline is a query, not a table — see ACR-016 privacy note.
-- ============================================================

-- Small additive fields supporting the Ministry Care Dashboard
ALTER TABLE counselling ADD COLUMN scheduled_session_at TEXT;       -- nullable
ALTER TABLE follow_up_assignments ADD COLUMN next_contact_date TEXT; -- nullable

-- Follow-up Workflows — new, small, reuses manual_ministry_tasks as the execution layer
CREATE TABLE followup_workflow_templates (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- e.g. 'Seven-Day New Convert Follow-up', 'Baptism Preparation'
    description TEXT,
    duration_days INTEGER,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE followup_workflow_steps (
    step_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    day_offset INTEGER NOT NULL,     -- e.g. 0, 1, 3, 7 — days after workflow start
    task_description TEXT NOT NULL,
    task_type TEXT,                  -- maps to manual_ministry_tasks.task_type on generation
    FOREIGN KEY (template_id) REFERENCES followup_workflow_templates(template_id)
);

-- When a workflow is started for a specific person, the Worker generates real rows in
-- manual_ministry_tasks (ACR-014/015) with due_date = start_date + day_offset, and
-- related_type/related_id (ACR-015) pointing at the person's decision/user record.
-- No new "workflow instance" table needed — the generated tasks ARE the instance,
-- traceable back to their template via a nullable `source_template_id` reference.
ALTER TABLE manual_ministry_tasks ADD COLUMN source_template_id INTEGER REFERENCES followup_workflow_templates(template_id);

-- NOTE: Giving/financial records are referenced by ACR-016 as a Timeline category but have
-- NO schema in this project. Explicitly out of scope here — flagged for its own future ACR
-- when the ministry is ready to design financial tracking, not assumed or stubbed in now.

-- ============================================================
-- Refinements: Event Registry & Spiritual Milestones (ACR-016 final)
-- ============================================================

CREATE TABLE ministry_journey_event_types (
    event_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    category TEXT,                          -- e.g. 'discipleship' | 'evangelism' | 'community' | 'pastoral_care'
    icon TEXT,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    visibility_class TEXT NOT NULL DEFAULT 'general',  -- PRESENTATION METADATA ONLY — see ACR-016 note.
                                                          -- Real access control always comes from the source
                                                          -- category's own existing rule, never from this field.
    show_on_own_timeline INTEGER NOT NULL DEFAULT 1,
    show_on_ministry_dashboard INTEGER NOT NULL DEFAULT 1,
    ai_may_reference INTEGER NOT NULL DEFAULT 1,
    is_milestone INTEGER NOT NULL DEFAULT 0
);

-- Seed the examples given, as configuration data — not code.
INSERT INTO ministry_journey_event_types (event_name, category, is_milestone, visibility_class) VALUES
  ('Salvation', 'evangelism', 1, 'general'),
  ('Water Baptism', 'discipleship', 1, 'general'),
  ('Sanctification', 'discipleship', 1, 'general'),
  ('Holy Ghost Baptism', 'discipleship', 1, 'general'),
  ('Discipleship Lesson Completed', 'discipleship', 0, 'general'),
  ('Bible Reading Milestone', 'discipleship', 0, 'general'),
  ('Prayer Request', 'community', 0, 'general'),
  ('Testimony', 'community', 0, 'general'),
  ('Event Attendance', 'community', 0, 'general'),
  ('Ministry Service', 'community', 0, 'general'),
  ('Counselling Session', 'pastoral_care', 0, 'highly_restricted'),  -- label only; real rule enforced by counselling table
  ('Follow-up Visit', 'pastoral_care', 0, 'restricted'),
  ('Manual Ministry Task', 'operations', 0, 'restricted'),
  ('Reading Plan Completed', 'discipleship', 0, 'general'),
  ('Membership Reception', 'discipleship', 1, 'general'),
  ('Leadership Commissioning', 'discipleship', 1, 'general'),
  ('Missionary Sending', 'evangelism', 1, 'general'),
  ('Bible Training Graduation', 'discipleship', 1, 'general');

-- Spiritual Milestones — richer presentation, reuses existing entities rather than duplicating them
CREATE TABLE milestone_records (
    milestone_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type_id INTEGER NOT NULL,
    achieved_at TEXT NOT NULL DEFAULT (datetime('now')),
    reflection_note TEXT,           -- private by default, per existing growth-data privacy rule (Volume 3 §14)
    testimony_id INTEGER,           -- optional link to an existing testimony
    photo_media_id INTEGER,         -- optional link to existing media table
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (event_type_id) REFERENCES ministry_journey_event_types(event_type_id),
    FOREIGN KEY (testimony_id) REFERENCES testimonies(testimony_id),
    FOREIGN KEY (photo_media_id) REFERENCES media(media_id)
);
-- Certificates (when built, per Module 3's v2.0-reserved hook) attach to milestone_records
-- the same way they'd attach to course_progress — same mechanism, no duplication.
