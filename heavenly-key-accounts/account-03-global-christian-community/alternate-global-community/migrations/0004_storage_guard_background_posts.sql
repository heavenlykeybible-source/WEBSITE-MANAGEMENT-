-- Storage-saving Faith Background Posts.
-- Media quota protection itself is enforced in application code so the rest of
-- the Community stays available when uploads are paused.
ALTER TABLE posts ADD COLUMN background_style TEXT;
