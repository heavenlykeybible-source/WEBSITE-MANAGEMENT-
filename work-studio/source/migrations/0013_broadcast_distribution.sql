-- ============================================================
-- Broadcast & Distribution Centre + Campaign Manager (ACR-011)
-- Adapter pattern: interface reserved for all channels;
-- working adapters implemented for Website, Platform, Email only at launch.
-- Table names use the broadcast_ prefix to avoid colliding with the
-- existing prayer_campaigns table (Module 2).
-- ============================================================

CREATE TABLE broadcast_channels (
    channel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_name TEXT NOT NULL UNIQUE,  -- 'website' | 'platform' | 'email' | 'sms' | 'whatsapp' |
                                          -- 'whatsapp_channels' | 'telegram' | 'facebook' | 'youtube' |
                                          -- 'x' | 'instagram' | 'rss' | 'push'
    is_active INTEGER NOT NULL DEFAULT 0,   -- 0 for every channel except website/platform/email at launch
    provider_name TEXT,                     -- nullable until configured, e.g. 'sendgrid', 'twilio', 'termii'
    credentials_ref TEXT,                   -- reference to Cloudflare Secrets binding, never raw tokens here
    configured_at TEXT
);

-- Seed: only these three are active at launch; the rest exist as reserved, inactive rows,
-- proving the adapter interface without pre-building every integration (ACR-011, Section 2).
INSERT INTO broadcast_channels (channel_name, is_active) VALUES
  ('website', 1), ('platform', 1), ('email', 1),
  ('sms', 0), ('whatsapp', 0), ('whatsapp_channels', 0), ('telegram', 0),
  ('facebook', 0), ('youtube', 0), ('x', 0), ('instagram', 0), ('rss', 0), ('push', 0);

CREATE TABLE broadcast_campaigns (
    campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    media_id INTEGER,               -- references existing media table (ACR-010), nullable for text-only campaigns
    body TEXT,
    schedule_type TEXT NOT NULL DEFAULT 'scheduled', -- immediate | scheduled | recurring | emergency
    scheduled_at TEXT,
    status TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | sent | partially_failed | failed
    approved_by INTEGER,             -- Administrator+ required for 'emergency' schedule_type, per ACR-011
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
);

CREATE TABLE broadcast_campaign_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    channel_name TEXT NOT NULL,       -- must match an entry in broadcast_channels
    caption_override TEXT,            -- platform-specific caption
    thumbnail_override_url TEXT,      -- platform-specific thumbnail
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id)
);

CREATE TABLE broadcast_delivery_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    channel_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | retrying
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_detail TEXT,
    sent_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id)
);

-- Live broadcast status — simple KV-cached flag, per ACR-010 Resolution 2.
-- Website/Platform poll this every ~30s rather than using real-time push infrastructure.
CREATE TABLE live_broadcast_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_live INTEGER NOT NULL DEFAULT 0,
    campaign_id INTEGER,            -- if tied to a scheduled campaign premiering as live
    current_title TEXT,
    started_at TEXT,
    ended_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(campaign_id)
);

-- Permission gate: emergency schedule_type requires Administrator role or above —
-- enforced in application logic against the existing roles table (Module 1).
-- No schema change needed there; RBAC already exists.
