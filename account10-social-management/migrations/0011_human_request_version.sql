-- Monotonic handover generation prevents stale operators from resolving a later request.
ALTER TABLE conversations ADD COLUMN human_request_version INTEGER NOT NULL DEFAULT 0 CHECK(human_request_version >= 0);
