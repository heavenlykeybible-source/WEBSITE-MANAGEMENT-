-- Apply to an EXISTING D1 database once, before deploying the updated API.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
