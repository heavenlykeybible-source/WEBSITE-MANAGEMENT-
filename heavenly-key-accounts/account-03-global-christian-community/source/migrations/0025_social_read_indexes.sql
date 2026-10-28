-- Add read-path indexes without changing or removing existing community data.
CREATE INDEX IF NOT EXISTS idx_notifications_latest_member ON notifications(user_id,notification_id DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_requester_recent ON conversations(requester_user_id,updated_at DESC,conversation_id DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_recipient_recent ON conversations(recipient_user_id,updated_at DESC,conversation_id DESC);
