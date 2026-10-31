-- Track every WhatsApp inbound message that attempted a human takeover. The consumed flag
-- ensures a re-delivered message cannot reopen a request after it was resolved.
CREATE TABLE IF NOT EXISTS whatsapp_handover_events (
 message_id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL,
 contact_target TEXT NOT NULL CHECK(contact_target IN ('ministry_agent','speak_to_evangelist')),
 consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_handover_events_conversation ON whatsapp_handover_events(conversation_id,created_at);
