-- Isolated website AI inbox. Existing WhatsApp records are not modified.
CREATE TABLE IF NOT EXISTS website_ai_conversations (
 id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','in_progress','resolved')),
 visitor_name TEXT, visitor_phone TEXT, visitor_email TEXT, contact_consent INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS website_ai_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL,
 speaker TEXT NOT NULL CHECK(speaker IN ('visitor','assistant')), body TEXT NOT NULL CHECK(length(body)<=4000),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 FOREIGN KEY(conversation_id) REFERENCES website_ai_conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_website_ai_messages_date ON website_ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_website_ai_messages_conv ON website_ai_messages(conversation_id);
