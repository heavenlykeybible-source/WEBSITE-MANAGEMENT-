-- Apply once after 0001_user_roles.sql on existing databases. Back up D1 first.
ALTER TABLE users ADD COLUMN storage_used INTEGER NOT NULL DEFAULT 0 CHECK(storage_used>=0);
UPDATE users SET storage_used=(SELECT COALESCE(SUM(size),0) FROM media WHERE media.user_id=users.id AND deleted=0);
