# Account 10 — Safe D1 migration procedure

## Why bulk migration commands are disabled

The Account 10 migration history contains both repeat-safe statements (for example, `CREATE TABLE IF NOT EXISTS`) and non-repeat-safe statements (including `ALTER TABLE ... ADD COLUMN` in migrations 0005, 0007, 0009 and 0011). Running the full chain against a database that already contains some of those columns can fail partway through, leaving an uncertain schema state.

For that reason, the package intentionally does **not** expose a one-command remote migration or remote schema-initialization script. Do not restore a bulk `wrangler d1 execute --remote` chain.

## Required controlled procedure

1. Confirm the exact Cloudflare account owns the `heavenlykey.org` zone and the intended Account 10 Worker, D1 database and R2 bucket. The deployment checklist records a prior account/zone mismatch; resolve it before any remote write.
2. Take and verify a D1 backup. Record the database ID, backup identifier, current Worker version and rollback procedure.
3. Inspect the live schema read-only with `PRAGMA table_info(table_name)` and `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`. Check every required table, column, index and constraint against `schema.sql` and migrations 0002–0013.
4. Build a migration ledger outside the production database: mark each migration as not applied, fully applied, or partially applied. Do not infer migration state from the Worker version.
5. Apply only the next missing migration, one file at a time, in numeric order, in staging first. Re-inspect the schema after each file. If a migration is partially applied or errors, stop and reconcile manually; do not rerun it blindly.
6. Run authenticated readiness checks and all integration tests in staging. Only after owner approval, repeat the reviewed plan for production with a verified backup and rollback window.
7. Record migration file, timestamp, target account/database ID, operator, result and post-migration verification. Never record secrets or customer message content.

## Current migration sequence

- Base schema: `schema.sql`
- `0002_webhook_events.sql` through `0013_auth_rate_limits.sql`, in numeric order.

The list is an inventory, **not** an instruction to replay every file. This document does not claim that any remote migration has been applied.
