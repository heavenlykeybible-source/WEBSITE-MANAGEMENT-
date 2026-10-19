-- ============================================================
-- Multi-Account Social Media Management (ACR-014)
-- Extends broadcast_channels (ACR-011) with actual connected accounts.
-- Facebook Groups posting and Page-invite automation are deliberately
-- NOT represented here — both are unavailable via any official API
-- as of this writing (see ACR-014 corrections).
-- ============================================================

CREATE TABLE social_accounts (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,          -- FK to broadcast_channels (the platform TYPE)
    display_name TEXT NOT NULL,           -- e.g. "Heavenly Key Main Page", "Heavenly Key Youth Page"
    external_account_id TEXT,             -- the platform's own ID for this account/page/channel
    status TEXT NOT NULL DEFAULT 'disconnected', -- connected | disconnected
    credentials_ref TEXT,                 -- Cloudflare Secrets reference, never raw tokens
    token_expiry TEXT,
    last_successful_publish TEXT,
    permission_status TEXT,               -- e.g. 'full' | 'limited' | 'revoked'
    admin_notes TEXT,
    connected_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES broadcast_channels(channel_id)
);

-- Account-level engagement snapshots (followers, reach) — distinct from
-- per-post metrics in campaign_engagement_stats (ACR-013).
CREATE TABLE social_account_stats (
    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    metric_type TEXT NOT NULL,   -- 'followers' | 'reach' | 'page_likes'
    metric_value INTEGER NOT NULL DEFAULT 0,
    snapshot_date TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES social_accounts(account_id)
);

-- Multi-destination publishing: campaigns can now target specific accounts,
-- not just a platform type generically.
ALTER TABLE broadcast_campaign_channels ADD COLUMN account_id INTEGER REFERENCES social_accounts(account_id);

-- No table exists for Facebook Group posting or Page-invite automation —
-- intentionally omitted; see ACR-014 corrections. If Meta ever reinstates
-- either capability, this requires a fresh ACR, not a silent schema addition,
-- since it would be new architecture at that point, not a gap being filled.

-- ============================================================
-- Addendum: Manual Ministry Tasks (ACR-014 revision)
-- ============================================================

-- Facebook Groups (and any other non-automatable "account") are recorded
-- as informational rows in social_accounts, flagged non-automatable —
-- not a parallel entity. Automation-facing UI/queries filter on this flag.
ALTER TABLE social_accounts ADD COLUMN is_automatable INTEGER NOT NULL DEFAULT 1;

CREATE TABLE manual_ministry_tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,              -- nullable — some manual tasks aren't tied to a specific campaign
    account_id INTEGER,               -- nullable — e.g. links to the specific Group/account involved
    task_type TEXT NOT NULL,          -- 'share_to_group' | 'invite_followers' | 'respond_to_comments' | 'pastoral_followup' | 'other'
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | skipped
    completed_by INTEGER,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id),
    FOREIGN KEY (account_id) REFERENCES social_accounts(account_id),
    FOREIGN KEY (completed_by) REFERENCES users(user_id)
);
