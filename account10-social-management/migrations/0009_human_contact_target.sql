-- Track the visitor's explicit human-contact choice without inventing delivery.
ALTER TABLE conversations ADD COLUMN human_contact_target TEXT NOT NULL DEFAULT 'ministry_agent' CHECK(human_contact_target IN ('ministry_agent','speak_to_evangelist'));
