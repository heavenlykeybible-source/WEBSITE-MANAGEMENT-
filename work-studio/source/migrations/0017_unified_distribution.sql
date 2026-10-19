-- ============================================================
-- Unified Distribution & Manual Task Centre (ACR-015)
-- Final schema for the Broadcast & Social Media module chain.
-- ============================================================

-- Generalize manual_ministry_tasks (ACR-014) beyond publishing-only use.
ALTER TABLE manual_ministry_tasks ADD COLUMN related_type TEXT;  -- 'decision' | 'testimony' | 'prayer_request' | 'campaign' | 'account' | 'new_convert' | 'other'
ALTER TABLE manual_ministry_tasks ADD COLUMN related_id INTEGER; -- polymorphic — no DB-level FK possible, same accepted tradeoff as elsewhere (Module 3 Database Audit Finding 8)
ALTER TABLE manual_ministry_tasks ADD COLUMN assigned_to INTEGER REFERENCES users(user_id);
ALTER TABLE manual_ministry_tasks ADD COLUMN due_date TEXT;
ALTER TABLE manual_ministry_tasks ADD COLUMN priority TEXT DEFAULT 'normal';  -- low | normal | high | urgent
-- campaign_id / account_id (ACR-014) remain for backward compatibility with existing
-- publishing-related tasks; new tasks should prefer related_type/related_id going forward.

-- Platform Capability Registry — the high-value addition of this ACR.
CREATE TABLE platform_capability_registry (
    platform_name TEXT PRIMARY KEY,       -- 'facebook_page' | 'facebook_group' | 'instagram' | 'youtube' | 'x' | 'telegram' | 'whatsapp_channel' | etc.
    api_available INTEGER NOT NULL DEFAULT 0,
    publishing_supported INTEGER NOT NULL DEFAULT 0,
    analytics_supported INTEGER NOT NULL DEFAULT 0,
    scheduling_supported INTEGER NOT NULL DEFAULT 0,
    media_upload_supported INTEGER NOT NULL DEFAULT 0,
    live_streaming_supported INTEGER NOT NULL DEFAULT 0,
    manual_action_required INTEGER NOT NULL DEFAULT 0,
    last_verified_date TEXT NOT NULL DEFAULT (datetime('now')),
    documentation_link TEXT,
    notes TEXT
);

-- Seed with what this project has already verified firsthand.
INSERT INTO platform_capability_registry
  (platform_name, api_available, publishing_supported, analytics_supported, scheduling_supported, media_upload_supported, live_streaming_supported, manual_action_required, notes)
VALUES
  ('facebook_page', 1, 1, 1, 1, 1, 1, 0, 'Verified current — Pages API remains supported.'),
  ('facebook_group', 0, 0, 0, 0, 0, 0, 1, 'Groups API deprecated by Meta, April 2024. No automated posting possible for any application. Verified this session.'),
  ('facebook_page_invite', 0, 0, 0, 0, 0, 0, 1, 'invitable_friends API deprecated by Meta, 2018. No automated invite mechanism exists. Verified this session.');

-- Content Calendar — optional lookup table for ministry-recognized holidays/observances.
CREATE TABLE calendar_holidays (
    holiday_id INTEGER PRIMARY KEY AUTOINCREMENT,
    holiday_date TEXT NOT NULL,
    name TEXT NOT NULL
);

-- Delivery History — one additive column aligning with ACR-014's multi-account model.
ALTER TABLE broadcast_delivery_log ADD COLUMN account_id INTEGER REFERENCES social_accounts(account_id);
