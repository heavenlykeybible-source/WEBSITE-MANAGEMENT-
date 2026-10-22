ALTER TABLE messages ADD COLUMN client_request_id TEXT;
CREATE UNIQUE INDEX idx_message_retry ON messages(conversation_id,sender_user_id,client_request_id);
