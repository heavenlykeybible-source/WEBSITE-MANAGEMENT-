CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, channel TEXT NOT NULL, sender_id TEXT NOT NULL, human_paused INTEGER NOT NULL DEFAULT 0, requested_human INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound','ai')), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);

CREATE TABLE IF NOT EXISTS social_posts (id TEXT PRIMARY KEY, body TEXT NOT NULL, platform TEXT NOT NULL CHECK(platform IN ('facebook_page','instagram_professional','youtube','tiktok')), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','published','failed')), scheduled_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status,scheduled_at);

CREATE TABLE IF NOT EXISTS automation_rules (id TEXT PRIMARY KEY, keyword TEXT NOT NULL, reply TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS social_accounts (id TEXT PRIMARY KEY, channel TEXT NOT NULL, provider_account_ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unverified', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_unique ON social_accounts(channel,provider_account_ref);
