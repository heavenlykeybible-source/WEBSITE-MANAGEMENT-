-- ============================================================
-- Architecture Freeze v1.0 — Schema Patch
-- Resolves Critical Finding 1 (encryption) and High Finding 6 (idempotency)
-- Apply after Module 4 schema, before Phase 7 work begins.
-- ============================================================

-- ---------- Critical Finding 1: Real encryption structure ----------
-- Rationale: AES-256-GCM (via Workers Web Crypto `crypto.subtle`) requires storing
-- ciphertext and its per-record IV (initialization vector) separately — a single
-- TEXT column implied encryption without the structure encryption actually needs.
-- Encryption key itself is held in Cloudflare Workers Secrets, never in D1.

ALTER TABLE decisions ADD COLUMN name_iv TEXT;
ALTER TABLE decisions ADD COLUMN contact_value_iv TEXT;
-- Existing name_encrypted / contact_value_encrypted columns are repurposed to hold
-- ciphertext only (name unchanged to avoid a breaking rename across dependent docs;
-- the *_iv companion column is what makes the encryption real).

ALTER TABLE counselling ADD COLUMN message_iv TEXT;
ALTER TABLE counselling ADD COLUMN safeguarding_notes_iv TEXT;   -- placeholder column, still unused (safeguarding logic remains unimplemented)

-- ---------- High Finding 6: Idempotency protection ----------
-- Rationale: prevents duplicate Decision/Counselling records from a client retry
-- on an unreliable connection — directly matches this platform's target network conditions.

ALTER TABLE decisions ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX idx_decisions_idempotency ON decisions(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE counselling ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX idx_counselling_idempotency ON counselling(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Worker behavior (documented here, implemented in Phase 7+):
-- Client generates a UUID before first submit attempt, sends it with every retry
-- of the same submission. Worker attempts INSERT; on unique-constraint violation,
-- Worker fetches and returns the existing record instead of erroring or duplicating.

-- ---------- AI doctrine enforcement — routing table, not just policy ----------
-- Resolves Critical Finding 2: every AI response from a doctrine-adjacent feature
-- writes here first. Nothing is shown to the user directly from the AI Service;
-- everything passes through this gate.
CREATE TABLE ai_response_review (
    review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature TEXT NOT NULL,             -- e.g. 'bible_study_assistant', 'search_assist'
    user_id INTEGER,
    input_text TEXT NOT NULL,
    ai_output_text TEXT NOT NULL,
    doctrine_flag INTEGER NOT NULL DEFAULT 0,  -- set by the classifier pass, not the model itself
    status TEXT NOT NULL DEFAULT 'auto_approved', -- auto_approved | pending_human_review | rejected
    reviewed_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);
-- doctrine_flag = 1 means: response withheld from user, routed to moderation_queue
-- (source = 'ai_doctrine_check') until a human moderator releases or rejects it.
