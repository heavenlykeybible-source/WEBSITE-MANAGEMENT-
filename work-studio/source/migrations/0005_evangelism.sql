-- ============================================================
-- Global Christian Platform — Module 4: Evangelism
-- Cloudflare D1 Schema (SQLite dialect)
-- Counselling escalation logic intentionally NOT implemented —
-- see safeguarding_placeholder columns below.
-- ============================================================

-- ---------- Nations ----------
CREATE TABLE nations (
    nation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_name TEXT NOT NULL UNIQUE,
    prayer_focus TEXT,
    is_featured_today INTEGER NOT NULL DEFAULT 0,
    featured_date TEXT
);

CREATE TABLE campaign_nations (
    campaign_id INTEGER NOT NULL,
    nation_id INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, nation_id),
    FOREIGN KEY (campaign_id) REFERENCES prayer_campaigns(campaign_id),
    FOREIGN KEY (nation_id) REFERENCES nations(nation_id)
);

CREATE TABLE mission_nations (
    mission_id INTEGER NOT NULL,
    nation_id INTEGER NOT NULL,
    PRIMARY KEY (mission_id, nation_id),
    FOREIGN KEY (nation_id) REFERENCES nations(nation_id)
);

-- ---------- Missions & Crusades ----------
CREATE TABLE missions (
    mission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,          -- creator/reporter (ministry staff)
    title TEXT NOT NULL,
    report TEXT,
    mission_type TEXT NOT NULL DEFAULT 'crusade', -- crusade | outreach | mission_trip
    event_date TEXT,
    status TEXT NOT NULL DEFAULT 'planned', -- planned | completed | archived
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Decisions for Christ (🔒 High Security) ----------
CREATE TABLE decisions (
    decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                      -- nullable — a first-time visitor may not have an account
    name_encrypted TEXT,                  -- optional, application-layer encrypted
    country TEXT NOT NULL,
    decision_date TEXT NOT NULL DEFAULT (datetime('now')),
    heard_via TEXT,                       -- website | radio | crusade | social_media | friend | other
    wants_followup INTEGER NOT NULL DEFAULT 1,
    contact_method TEXT,
    contact_value_encrypted TEXT,         -- encrypted email/phone
    is_minor_flag INTEGER NOT NULL DEFAULT 0,  -- set if respondent indicates under 18
    status TEXT NOT NULL DEFAULT 'new',   -- new | assigned | contacted | closed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Contacts & Counselling (🔒 Highest Security) ----------
-- Escalation workflow is INTENTIONALLY NOT IMPLEMENTED. The columns below
-- exist as a documented placeholder only, per the approved safeguarding hold.
CREATE TABLE counselling (
    contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                       -- nullable — anonymous inquiries allowed
    category TEXT NOT NULL,                -- Prayer | Biblical Questions | Salvation | Family | Marriage | Youth | Other
    subject TEXT,
    message_encrypted TEXT NOT NULL,
    contact_method TEXT,
    priority TEXT NOT NULL DEFAULT 'normal', -- normal | high | urgent
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | assigned | in_progress | closed
    assigned_counsellor_id INTEGER,          -- FK to follow_up_workers, nullable

    -- ============ SAFEGUARDING PLACEHOLDER — DO NOT IMPLEMENT LOGIC ============
    -- These columns exist so the schema won't need restructuring once the
    -- ministry's safeguarding policy is approved. No escalation routing,
    -- notification, or automated action may be built against them yet.
    is_minor_flag INTEGER NOT NULL DEFAULT 0,          -- placeholder only
    safeguarding_escalated INTEGER NOT NULL DEFAULT 0, -- placeholder only, always 0 in v1.0
    safeguarding_notes_encrypted TEXT,                 -- placeholder only, unused in v1.0
    -- ============================================================================

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Follow-up System ----------
CREATE TABLE follow_up_workers (
    worker_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    region TEXT,
    ministry_role TEXT,        -- evangelism_followup | counselling | discipleship
    max_active_followups INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active', -- active | inactive
    approved_by INTEGER,
    approved_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE follow_up_assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,   -- 'decision' | 'counselling'
    source_id INTEGER NOT NULL,
    assignment_status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | closed
    notes TEXT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (worker_id) REFERENCES follow_up_workers(worker_id)
);
CREATE INDEX idx_followup_source ON follow_up_assignments(source_type, source_id);

-- ---------- Volunteers ----------
CREATE TABLE volunteers (
    volunteer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    area_of_interest TEXT,     -- evangelism | media | logistics | translation | counselling | other
    availability TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | inactive
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
