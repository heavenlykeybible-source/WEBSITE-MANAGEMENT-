-- Link distribution jobs directly to finalized live recordings.
ALTER TABLE distribution_jobs ADD COLUMN recording_id INTEGER REFERENCES broadcast_recordings(recording_id);
CREATE INDEX idx_distribution_jobs_recording ON distribution_jobs(recording_id, status);
