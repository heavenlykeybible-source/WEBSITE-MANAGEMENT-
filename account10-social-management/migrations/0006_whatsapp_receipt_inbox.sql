-- Keep signed Meta delivery receipts even if they arrive before API acceptance is recorded.
CREATE TABLE IF NOT EXISTS whatsapp_receipt_inbox (
 provider_message_id TEXT NOT NULL,
 phone_number_id TEXT NOT NULL,
 delivery_status TEXT NOT NULL CHECK(delivery_status IN ('sent','delivered','read','failed')),
 received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(provider_message_id,phone_number_id)
);
