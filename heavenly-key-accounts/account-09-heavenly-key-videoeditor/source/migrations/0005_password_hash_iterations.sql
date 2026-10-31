-- Apply once to an existing Account 9 D1 database before deploying the upgraded API.
-- Existing hashes were generated with 100,000 PBKDF2-HMAC-SHA-256 iterations.
-- Preserve that value for legacy verification; successful login upgrades each account to 600,000.
ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000;
