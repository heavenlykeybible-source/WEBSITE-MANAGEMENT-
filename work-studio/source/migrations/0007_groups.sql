-- ============================================================
-- Global Christian Platform — Module 5: Groups & Fellowship
-- Cloudflare D1 Schema (SQLite dialect)
-- ============================================================

CREATE TABLE groups (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    purpose_statement TEXT NOT NULL,   -- required: "every group must state its Christian purpose"
    type TEXT NOT NULL,                -- prayer | bible_study | mission_team | regional | language |
                                        -- youth | mens | womens | ministers | ministry_department | custom
    cover_image_url TEXT,
    rules TEXT,
    visibility TEXT NOT NULL DEFAULT 'public',  -- public | private | hidden
    creator_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',      -- active | archived | deleted
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (creator_id) REFERENCES users(user_id)
);

CREATE TABLE group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',   -- owner | administrator | moderator | member
    -- mission team-specific role (nullable, only meaningful when groups.type = 'mission_team')
    mission_role TEXT,                     -- evangelist | intercessor | supporter | translator
    join_status TEXT NOT NULL DEFAULT 'approved', -- requested | approved
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE group_join_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | declined
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE group_invitations (
    invitation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    invited_by INTEGER NOT NULL,
    invited_user_id INTEGER,        -- nullable if invited via shareable link rather than direct invite
    invite_token TEXT,              -- for shareable links
    status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | expired
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (invited_by) REFERENCES users(user_id)
);

-- Group posts reuse the universal comments/reactions polymorphic pattern:
-- content_type = 'group_post', content_id = group_posts.post_id

CREATE TABLE group_posts (
    post_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    post_type TEXT NOT NULL DEFAULT 'discussion', -- discussion | prayer | announcement
    title TEXT,
    body TEXT NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Shared files/photos — reuses the existing Media Library, scoped via polymorphic link
CREATE TABLE group_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,   -- FK to the existing media table
    shared_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (shared_by) REFERENCES users(user_id)
);

-- Polls
CREATE TABLE polls (
    poll_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- open | closed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE poll_options (
    option_id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(poll_id)
);

CREATE TABLE poll_votes (
    poll_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    voted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (poll_id, user_id),
    FOREIGN KEY (poll_id) REFERENCES polls(poll_id),
    FOREIGN KEY (option_id) REFERENCES poll_options(option_id)
);

-- Ministers Fellowship — protected group type extension
CREATE TABLE minister_profiles (
    profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,   -- the ministers-type group this profile belongs to, OR
    user_id INTEGER NOT NULL,    -- the individual minister within it
    ministry_name TEXT,
    country TEXT,
    region TEXT,
    denomination TEXT,           -- optional
    verification_status TEXT NOT NULL DEFAULT 'unverified', -- unverified | pending | verified
    verified_by INTEGER,         -- must be an authorised ministry administrator
    verified_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
);

-- Group-scoped Reading Plan participation reuses the existing reading_plan_progress table
-- (Module 3) — no new table needed, since progress is already per-user, per-plan.

-- Group Statistics is a presentation-layer aggregate (member count, post count, prayer count)
-- computed from existing tables — no new entity required.
