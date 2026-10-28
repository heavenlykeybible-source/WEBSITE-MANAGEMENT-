-- Existing installations only. Run once before deploying this update.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('owner','admin','user'));
