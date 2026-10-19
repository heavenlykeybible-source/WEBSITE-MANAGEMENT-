-- WhatsApp inbox + social media management integrated into the existing administration system.
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  account_id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL DEFAULT 'Heavenly Key WhatsApp',
  phone_number_id TEXT NOT NULL UNIQUE,
  business_account_id TEXT,
  credential_ciphertext TEXT,
  credential_iv TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_id TEXT NOT NULL UNIQUE,
  profile_name TEXT,
  access_mode TEXT NOT NULL DEFAULT 'active' CHECK(access_mode IN ('active','human_only','website_only','blocked')),
  notes TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  category TEXT,
  handoff_reason TEXT,
  assigned_to INTEGER,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(contact_id) REFERENCES whatsapp_contacts(contact_id),
  FOREIGN KEY(assigned_to) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_status ON whatsapp_conversations(status,last_message_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_one_open_conversation ON whatsapp_conversations(contact_id) WHERE status='open';

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  message_pk INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_message_id TEXT UNIQUE,
  conversation_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  provider_status TEXT,
  provider_timestamp TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(conversation_id) REFERENCES whatsapp_conversations(conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON whatsapp_messages(conversation_id,created_at);

CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(conversation_id) REFERENCES whatsapp_conversations(conversation_id)
);

CREATE TABLE IF NOT EXISTS social_managed_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram','youtube','tiktok','x','linkedin')),
  display_name TEXT NOT NULL,
  account_ref TEXT NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  credential_iv TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  connection_status TEXT NOT NULL DEFAULT 'connected',
  token_expiry TEXT,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_social_managed_platform ON social_managed_accounts(platform,active);

CREATE TABLE IF NOT EXISTS social_connection_states (
  state_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(created_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS social_publish_jobs (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  text TEXT,
  media_urls TEXT NOT NULL DEFAULT '[]',
  media_ids TEXT NOT NULL DEFAULT '[]',
  media_type TEXT,
  publish_at TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','publishing','published','failed')),
  provider_post_id TEXT,
  error TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(account_id) REFERENCES social_managed_accounts(id),
  FOREIGN KEY(created_by) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_publish_due ON social_publish_jobs(status,publish_at);
