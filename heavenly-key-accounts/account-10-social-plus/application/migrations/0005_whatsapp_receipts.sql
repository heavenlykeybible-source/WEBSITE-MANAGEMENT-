-- Provider delivery receipts are recorded separately from API acceptance.
ALTER TABLE whatsapp_delivery_attempts ADD COLUMN delivery_status TEXT CHECK(delivery_status IN ('sent','delivered','read','failed'));
ALTER TABLE whatsapp_delivery_attempts ADD COLUMN receipt_at TEXT;
CREATE INDEX IF NOT EXISTS idx_whatsapp_delivery_provider_message ON whatsapp_delivery_attempts(provider_message_id);
