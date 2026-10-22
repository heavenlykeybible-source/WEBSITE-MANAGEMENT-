-- ACTIVE is opt-in. When enabled, a member's eligible recent posts may appear
-- in the ACTIVE strip of people who Global Connect to that member.
ALTER TABLE profiles ADD COLUMN active_auto_share INTEGER NOT NULL DEFAULT 0 CHECK(active_auto_share IN (0,1));
