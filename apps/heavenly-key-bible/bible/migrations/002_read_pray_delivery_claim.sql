-- Apply ONLY to existing installations that used migration 001 before claim_until was added.
-- New installations already have the column in updated migration 001.
ALTER TABLE read_pray_push ADD COLUMN claim_until TEXT;
