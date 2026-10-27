CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, channel TEXT NOT NULL, sender_id TEXT NOT NULL, human_paused INTEGER NOT NULL DEFAULT 0, requested_human INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound','ai')), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
