# Strength for Today — Daily Manna application (Phase 1)

This is an independent Cloudflare Worker app, not yet deployed. It is deliberately kept separate from Account 4's existing Worker so editorial changes cannot accidentally overwrite the Control Room.

## Setup
1. Create a dedicated D1 database and apply `schema.sql`.
2. Bind it as `DB` on a new Worker using `worker.mjs`.
3. Add `EDITOR_TOKEN` as a Cloudflare secret, never in source or a URL.
4. Configure the cron trigger `0 * * * *` (hourly UTC). The handler only publishes at midnight in `Africa/Lagos`.
5. Protect editor routes behind Account 4 owner login before exposing them to the browser. The token is intended for server-to-server requests only.
6. Test on a staging Worker and review existing Daily Word data before switching any live domain.

## API
- `GET /api/today` — publicly visible devotional for current Lagos date.
- `GET /api/entries` — owner editorial list (Bearer token).
- `POST /api/entries` — draft creation (Bearer token).
- `PUT /api/entries/:id` — edit; resets approval and increments revision.
- `POST /api/approve` — approve up to 100 entries in a batch.
- `POST /api/publish-check` — authorized manual publication recovery check.

## Publication rules
Only an entry with `status=approved` and `approved_revision=revision` can publish. A D1 conditional update makes daily publication idempotent. Website visibility is independent of downstream distribution. Delivery rows for community, Buffer, and email are queued but **not transmitted** yet. They require integrations, permission checks, retries, opt-in management, and channel-specific credentials. No social publishing or subscriber messages are claimed operational.

## Account 4 integration
Build a secure owner-only proxy from Account 4 to the editor API, backed by the vault; do not expose the bearer token to the browser. Add Daily Manna to Account 4 navigation after staging tests. Connect the existing Daily Word Worker and Global Christian Community only after inspecting their live code, D1 schema, and publishing interfaces. Never overwrite their existing data.

## Next milestones
- Owner editorial UI: calendar, single-day editing, monthly bulk approval, approval audit.
- D1-backed opt-in confirmation, unsubscribe, inbox subscriptions.
- Community Space publisher and permission-scoped delivery.
- Buffer multi-account OAuth and provider-specific scheduling.
- Delivery workers with idempotency, rate limits, retry and failure alerts.
- Integration tests and staging deployment; manual owner approval before production cutover.
