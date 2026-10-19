-- Guided OAuth account/page selection after provider authorization.
ALTER TABLE social_connection_states ADD COLUMN selection_options TEXT;
ALTER TABLE social_connection_states ADD COLUMN pending_credential_ciphertext TEXT;
ALTER TABLE social_connection_states ADD COLUMN pending_credential_iv TEXT;
ALTER TABLE social_connection_states ADD COLUMN pending_token_expiry TEXT;
