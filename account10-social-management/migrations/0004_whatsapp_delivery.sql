-- One irreversible delivery attempt per approved operator message.
-- A reserved attempt is never retried automatically: the provider may have accepted it
-- even when the response is lost. Operators must reconcile uncertain attempts.
CREATE TABLE IF NOT EXISTS whatsapp_delivery_attempts (
 draft_id TEXT PRIMARY KEY REFERENCES messages(id),
 phone_number_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','sent','rejected','unknown')),
 provider_message_id TEXT,
 provider_status INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_delivery_state ON whatsapp_delivery_attempts(state,created_at);
