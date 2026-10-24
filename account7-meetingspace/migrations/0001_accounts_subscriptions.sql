-- MeetingSpace accounts and subscription ledger (D1; apply only after review).
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT,
 email_verified_at INTEGER,
 created_at INTEGER NOT NULL,
 disabled_at INTEGER
);
CREATE TABLE IF NOT EXISTS subscriptions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 plan_id TEXT NOT NULL CHECK(plan_id IN ('free','starter','pro')),
 status TEXT NOT NULL CHECK(status IN ('active','trialing','past_due','canceled','expired')),
 provider TEXT,
 provider_customer_id TEXT,
 provider_subscription_id TEXT UNIQUE,
 current_period_start INTEGER NOT NULL,
 current_period_end INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_period ON subscriptions(user_id,current_period_end);
CREATE TABLE IF NOT EXISTS meeting_sessions (
 id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL REFERENCES users(id),
 room_id TEXT NOT NULL UNIQUE,
 started_at INTEGER NOT NULL,
 ended_at INTEGER,
 participant_peak INTEGER NOT NULL DEFAULT 0,
 billed_minutes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_owner_start ON meeting_sessions(owner_user_id,started_at);
CREATE TABLE IF NOT EXISTS payment_events (
 provider TEXT NOT NULL,
 event_id TEXT NOT NULL,
 received_at INTEGER NOT NULL,
 PRIMARY KEY(provider,event_id)
);
