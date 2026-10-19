-- ============================================================
-- Global Christian Platform — Module 2: Community
-- Cloudflare D1 Schema (SQLite dialect)
-- Assumes Module 1 tables (users, roles) already exist.
-- ============================================================

-- ---------- Categories (shared across modules, per frozen pattern) ----------
CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    module TEXT NOT NULL,           -- 'prayer' | 'testimony' | 'question' | 'discussion'
    parent_category_id INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (parent_category_id) REFERENCES categories(category_id)
);

INSERT INTO categories (name, module, display_order) VALUES
 ('Salvation','prayer',1),('Healing','prayer',2),('Deliverance','prayer',3),('Family','prayer',4),
 ('Marriage','prayer',5),('Children','prayer',6),('Financial Needs','prayer',7),('Employment','prayer',8),
 ('Ministry','prayer',9),('Missions','prayer',10),('Nation','prayer',11),('Church','prayer',12),
 ('Spiritual Growth','prayer',13),('Thanksgiving','prayer',14),('Other','prayer',15),

 ('Salvation','testimony',1),('Healing','testimony',2),('Deliverance','testimony',3),('Answered Prayer','testimony',4),
 ('Family','testimony',5),('Marriage','testimony',6),('Provision','testimony',7),('Evangelism','testimony',8),
 ('Missions','testimony',9),('Revival','testimony',10),('Bible Growth','testimony',11),('Restoration','testimony',12),
 ('Other','testimony',13),

 ('Salvation','question',1),('Prayer','question',2),('Holiness','question',3),('Bible Doctrine','question',4),
 ('Christian Living','question',5),('Evangelism','question',6),('Missions','question',7),('Family','question',8),
 ('Marriage','question',9),('Youth','question',10),('Ministry','question',11),('End Times','question',12),
 ('Bible Study','question',13),('Other','question',14),

 ('General Fellowship','discussion',1),('Evangelism','discussion',2),('Revival','discussion',3),('Prayer','discussion',4),
 ('Bible Study','discussion',5),('Christian Living','discussion',6),('Missions','discussion',7),('Youth','discussion',8),
 ('Marriage','discussion',9),('Family','discussion',10),('Ministry','discussion',11),('Testimonies','discussion',12),
 ('Announcements','discussion',13),('Other','discussion',14);

-- ---------- Prayer Requests & Responses ----------
CREATE TABLE prayer_requests (
    prayer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,               -- always populated, even if anonymous
    category_id INTEGER NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    request_text TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public',  -- public | ministry_only
    status TEXT NOT NULL DEFAULT 'active',      -- active | flagged | archived | deleted
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE prayer_responses (
    response_id INTEGER PRIMARY KEY AUTOINCREMENT,
    prayer_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    response_type TEXT NOT NULL,   -- praying | verse | encouragement
    content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (prayer_id) REFERENCES prayer_requests(prayer_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Prayer Campaigns / Prayer Chains ----------
CREATE TABLE prayer_campaigns (
    campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    theme_scripture TEXT,
    duration_days INTEGER,           -- e.g. 7 for "7 Days Prayer for Nigeria"
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE campaign_daily_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    prayer_point TEXT NOT NULL,
    scripture_ref TEXT,
    FOREIGN KEY (campaign_id) REFERENCES prayer_campaigns(campaign_id)
);

CREATE TABLE campaign_participants (
    campaign_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    reminder_opt_in INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (campaign_id, user_id),
    FOREIGN KEY (campaign_id) REFERENCES prayer_campaigns(campaign_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Testimonies ----------
CREATE TABLE testimonies (
    testimony_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    story TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'text',  -- text | audio | video
    media_url TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | edits_requested
    featured_on_homepage INTEGER NOT NULL DEFAULT 0,  -- requires administrator approval
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_by INTEGER,
    reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- ---------- Bible Questions & Answers ----------
CREATE TABLE questions (
    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    question_text TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE answers (
    answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    answer_text TEXT NOT NULL,
    recommended INTEGER NOT NULL DEFAULT 0,  -- moderator-marked
    votes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (question_id) REFERENCES questions(question_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------- Community Discussions ----------
CREATE TABLE discussions (
    discussion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- ---------- Universal Comments & Reactions (polymorphic) ----------
CREATE TABLE comments (
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL,   -- 'prayer_request' | 'testimony' | 'question' | 'discussion' | 'group_post'
    content_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX idx_comments_content ON comments(content_type, content_id);

CREATE TABLE reactions (
    reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    reaction_type TEXT NOT NULL,  -- 'praying' | 'amen' | 'encouraged' | 'like'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE UNIQUE INDEX idx_reactions_unique ON reactions(user_id, content_type, content_id, reaction_type);

-- ---------- Moderation Queue ----------
CREATE TABLE moderation_queue (
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    ai_flag_reason TEXT,           -- null if human-reported, not AI-flagged
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | cleared | escalated | removed
    reviewed_by INTEGER,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);

-- ---------- Follow ----------
CREATE TABLE follows (
    follower_user_id INTEGER NOT NULL,
    followed_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_user_id, followed_user_id),
    FOREIGN KEY (follower_user_id) REFERENCES users(user_id),
    FOREIGN KEY (followed_user_id) REFERENCES users(user_id)
);

CREATE TABLE follow_blocks (
    blocker_user_id INTEGER NOT NULL,
    blocked_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (blocker_user_id, blocked_user_id),
    FOREIGN KEY (blocker_user_id) REFERENCES users(user_id),
    FOREIGN KEY (blocked_user_id) REFERENCES users(user_id)
);
