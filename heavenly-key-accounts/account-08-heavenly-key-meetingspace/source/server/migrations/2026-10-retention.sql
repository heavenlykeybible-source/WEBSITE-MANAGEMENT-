-- For a database created before the retention update. Run each line once.
ALTER TABLE teams ADD COLUMN ttl INTEGER NOT NULL DEFAULT 30;
ALTER TABLE users ADD COLUMN seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN warned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conns ADD COLUMN used INTEGER NOT NULL DEFAULT 0;
UPDATE users SET seen = created WHERE seen = 0;
UPDATE conns SET used = strftime('%s','now') * 1000 WHERE used = 0;
