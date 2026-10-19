-- ============================================================
-- Global Christian Platform — Module 6: Community Administration
-- Cloudflare D1 Schema (SQLite dialect)
-- ============================================================

-- One continuous ledger of every moderation action taken against a user or content item.
CREATE TABLE moderation_actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL,        -- the moderator/admin taking the action
    target_user_id INTEGER,                -- nullable if the action targets content, not a user
    target_content_type TEXT,              -- nullable if the action targets a user, not content
    target_content_id INTEGER,
    action_type TEXT NOT NULL,             -- friendly_reminder | official_warning | temporary_restriction |
                                            -- temporary_suspension | permanent_ban | restore | content_removed
    reason TEXT NOT NULL,
    restriction_expires_at TEXT,           -- for temporary_restriction / temporary_suspension only
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id),
    FOREIGN KEY (target_user_id) REFERENCES users(user_id)
);
CREATE INDEX idx_modactions_target_user ON moderation_actions(target_user_id);

-- Internal-only notes — never shown to the member involved.
CREATE TABLE moderator_notes (
    note_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id INTEGER,                     -- optional link to a specific moderation_actions row
    target_user_id INTEGER,
    author_id INTEGER NOT NULL,
    note_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (action_id) REFERENCES moderation_actions(action_id),
    FOREIGN KEY (target_user_id) REFERENCES users(user_id),
    FOREIGN KEY (author_id) REFERENCES users(user_id)
);

-- Appeals against a moderation action.
CREATE TABLE appeals (
    appeal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id INTEGER NOT NULL,            -- the moderation_actions row being appealed
    submitted_by INTEGER NOT NULL,
    appeal_reason TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewing_user_id INTEGER,             -- nullable until picked up
    decision TEXT,                         -- upheld | overturned | partially_overturned
    decision_notes TEXT,
    decided_at TEXT,
    FOREIGN KEY (action_id) REFERENCES moderation_actions(action_id),
    FOREIGN KEY (submitted_by) REFERENCES users(user_id),
    FOREIGN KEY (reviewing_user_id) REFERENCES users(user_id)
);

-- Reports (member-submitted flags) feed the existing moderation_queue (Module 2) —
-- a report is simply a moderation_queue row with source = 'user_report'.
ALTER TABLE moderation_queue ADD COLUMN source TEXT NOT NULL DEFAULT 'ai_flag'; -- ai_flag | user_report

-- Moderator Dashboard and Community Health views are read-only aggregate queries over
-- existing tables (testimonies, prayer_requests, questions, decisions, counselling,
-- users, groups, moderation_queue) — no new tables required for either dashboard.
