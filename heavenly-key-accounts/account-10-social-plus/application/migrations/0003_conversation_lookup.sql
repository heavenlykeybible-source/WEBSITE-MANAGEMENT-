-- Accelerate matching provider inbound events to existing conversations.
CREATE INDEX IF NOT EXISTS idx_conversations_channel_sender ON conversations(channel, sender_id);
-- Keep pending event polling efficient as the webhook inbox grows.
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON webhook_events(processing_status, received_at, id);
