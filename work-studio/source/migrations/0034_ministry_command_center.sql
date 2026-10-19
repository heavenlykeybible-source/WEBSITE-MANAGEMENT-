-- Heavenly Key Ministry Command Center foundation.
-- Adds true multi-WhatsApp routing, ministry workflows, programs, follow-up and organization scoping.

CREATE TABLE IF NOT EXISTS organizations (
  organization_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  website TEXT,
  vision TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO organizations(organization_id,name,slug,website,vision,active)
VALUES(1,'Heavenly Key Evangelistic Movement','heavenly-key-evangelistic-movement','https://heavenlykey.org','TAKING CHRIST TO THE NATIONS OF THE WORLD',1);

CREATE TABLE IF NOT EXISTS ministry_settings (
  setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id,setting_key),
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id),
  FOREIGN KEY(updated_by) REFERENCES users(user_id)
);

ALTER TABLE whatsapp_accounts ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_accounts ADD COLUMN purpose TEXT;
ALTER TABLE whatsapp_accounts ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_accounts ADD COLUMN auto_reply_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_accounts ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_accounts ADD COLUMN human_handover_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_accounts ADD COLUMN working_hours TEXT;
ALTER TABLE whatsapp_accounts ADD COLUMN welcome_message TEXT;
ALTER TABLE whatsapp_accounts ADD COLUMN menu_config TEXT;

ALTER TABLE whatsapp_contacts ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_contacts ADD COLUMN consent_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE whatsapp_contacts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE whatsapp_contacts ADD COLUMN first_interaction_at TEXT;

ALTER TABLE whatsapp_conversations ADD COLUMN whatsapp_account_id INTEGER;
ALTER TABLE whatsapp_conversations ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_conversations ADD COLUMN pending_workflow TEXT;
ALTER TABLE whatsapp_conversations ADD COLUMN pending_step TEXT;

ALTER TABLE whatsapp_messages ADD COLUMN whatsapp_account_id INTEGER;
ALTER TABLE whatsapp_messages ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS idx_wa_one_open_conversation;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_one_open_conversation_per_number
ON whatsapp_conversations(contact_id,whatsapp_account_id) WHERE status='open';
CREATE INDEX IF NOT EXISTS idx_wa_conversations_account ON whatsapp_conversations(whatsapp_account_id,status,last_message_at);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_org ON whatsapp_accounts(organization_id,active,status);

CREATE TABLE IF NOT EXISTS ministry_programs (
  program_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  starts_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  location TEXT,
  delivery_mode TEXT NOT NULL DEFAULT 'physical' CHECK(delivery_mode IN ('physical','online','hybrid')),
  description TEXT,
  registration_info TEXT,
  contact_info TEXT,
  streaming_link TEXT,
  flyer_media_id INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','live','completed','cancelled')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id),
  FOREIGN KEY(created_by) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_programs_status ON ministry_programs(organization_id,status,starts_at);

CREATE TABLE IF NOT EXISTS ministry_prayer_requests (
  prayer_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  whatsapp_account_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  name TEXT,
  wa_id TEXT,
  request TEXT NOT NULL,
  assigned_to INTEGER,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_prayer','follow_up','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(whatsapp_account_id) REFERENCES whatsapp_accounts(account_id),
  FOREIGN KEY(conversation_id) REFERENCES whatsapp_conversations(conversation_id),
  FOREIGN KEY(contact_id) REFERENCES whatsapp_contacts(contact_id),
  FOREIGN KEY(assigned_to) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_ministry_prayer_requests_status ON ministry_prayer_requests(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS partnership_requests (
  partnership_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  whatsapp_account_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  name TEXT,
  wa_id TEXT,
  country TEXT,
  city TEXT,
  partnership_type TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','follow_up','partner','completed')),
  assigned_to INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(whatsapp_account_id) REFERENCES whatsapp_accounts(account_id),
  FOREIGN KEY(conversation_id) REFERENCES whatsapp_conversations(conversation_id),
  FOREIGN KEY(contact_id) REFERENCES whatsapp_contacts(contact_id),
  FOREIGN KEY(assigned_to) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_partnership_status ON partnership_requests(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS evangelist_requests (
  evangelist_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  whatsapp_account_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  name TEXT,
  wa_id TEXT,
  country TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','follow_up','completed')),
  assigned_to INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(whatsapp_account_id) REFERENCES whatsapp_accounts(account_id),
  FOREIGN KEY(conversation_id) REFERENCES whatsapp_conversations(conversation_id),
  FOREIGN KEY(contact_id) REFERENCES whatsapp_contacts(contact_id),
  FOREIGN KEY(assigned_to) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_evangelist_requests_status ON evangelist_requests(organization_id,status,created_at);

CREATE TABLE IF NOT EXISTS volunteer_requests (
  volunteer_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  whatsapp_account_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  name TEXT,
  wa_id TEXT,
  country TEXT,
  skills TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ministry_encouragements (
  encouragement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  whatsapp_account_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  wa_id TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ministry_followups (
  followup_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  category TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
  assigned_to INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_followups_due ON ministry_followups(organization_id,status,due_at);

CREATE TABLE IF NOT EXISTS ministry_activity_log (
  activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL,
  platform TEXT,
  whatsapp_account_id INTEGER,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_user_id INTEGER,
  result TEXT NOT NULL DEFAULT 'success',
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ministry_activity ON ministry_activity_log(organization_id,created_at DESC);

ALTER TABLE social_managed_accounts ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE social_publish_jobs ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE social_publish_jobs ADD COLUMN publish_mode TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE social_publish_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO ministry_settings(organization_id,setting_key,setting_value) VALUES
(1,'ministry_name','Heavenly Key Evangelistic Movement'),
(1,'website','https://heavenlykey.org'),
(1,'vision','TAKING CHRIST TO THE NATIONS OF THE WORLD'),
(1,'ministry_description','Heavenly Key Evangelistic Movement is a Christian ministry committed to spreading the Gospel of Jesus Christ, reaching lives, encouraging believers and helping people draw closer to God.'),
(1,'welcome_message','WELCOME TO HEAVENLY KEY EVANGELISTIC MOVEMENT\n\nWe are glad to connect with you.\n\nHow can we serve you today?'),
(1,'daily_post_times','08:00,11:00,14:00,17:00,20:00'),
(1,'timezone','Africa/Lagos');
