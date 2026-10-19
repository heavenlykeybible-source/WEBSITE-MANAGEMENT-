-- Recording distribution idempotency.
-- A finalized recording should have at most one active delivery job per
-- destination account/channel, even if registration/retry paths run twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_distribution_recording_account_channel
ON distribution_jobs(recording_id, account_id, channel_name)
WHERE recording_id IS NOT NULL AND account_id IS NOT NULL;
