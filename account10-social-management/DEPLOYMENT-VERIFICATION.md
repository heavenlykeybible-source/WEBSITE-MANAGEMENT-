# Account 10 — Deployment verification checklist

This checklist distinguishes repository code from an operational Cloudflare deployment.

## Database
- [ ] Apply `schema.sql` to the Account 10 D1 database.
- [ ] Apply `migrations/0002_webhook_events.sql`, `0003_conversation_lookup.sql`, and `0004_whatsapp_delivery.sql`, `0005_whatsapp_receipts.sql`, and `0006_whatsapp_receipt_inbox.sql`, and `0007_post_media.sql` in order after the base schema.
- [ ] Confirm `webhook_events` exists with a unique primary key.
- [ ] Confirm repeated signed events are stored only once.
- [ ] Confirm pending event records survive Worker restarts.

## Secrets and authentication
- [ ] Configure `ADMIN_TOKEN` and `META_APP_SECRET` as Worker secrets, not committed files.
- [ ] Configure `META_WEBHOOK_VERIFY_TOKEN` as a secret.
- [ ] Configure `META_WHATSAPP_ACCESS_TOKEN` as a Worker secret (never in browser or source).
- [ ] Verify WhatsApp phone number ownership and Meta permissions with `/api/whatsapp/connection-check`.
- [ ] Confirm only authorized operators know `ADMIN_TOKEN`; rotate it before public launch.
- [ ] Confirm unauthenticated requests to `/api/webhooks/events` return 401.
- [ ] Confirm incorrect webhook signatures return 401.
- [ ] Confirm oversized webhook bodies return 413.
- [ ] Confirm a valid signed request returns stored:true only after database write succeeds.

## End-to-end functionality
- [ ] Connect approved Meta accounts and validate permissions.
- [ ] Implement and verify incoming event-to-conversation processing.
- [ ] Verify operator-approved WhatsApp Cloud API text delivery against a real opted-in test recipient within the 24-hour service window.
- [ ] Verify `whatsapp_delivery_attempts` blocks duplicate send requests and uncertain responses are never retried automatically.
- [ ] Verify signed WhatsApp delivery/read receipts update the ledger and the dashboard.
- [ ] Test delayed and out-of-order WhatsApp receipt reconciliation on live Meta webhooks; implement remaining platform delivery adapters.
- [ ] Verify human takeover prevents automated replies.
- [ ] Test draft review and outbound approval separately from provider delivery.
- [ ] Test publishing, scheduling, retries and idempotency.
- [ ] Verify Account 2 migration counts and preserve source data until approved cutover.

## Launch gate
Do not announce production readiness until the above checks pass on a deployed Worker, with verified provider credentials and device testing. Signed WhatsApp text webhooks can be imported into the internal inbox, and an explicitly approved operator reply can be submitted to the WhatsApp Cloud API when configured. This does not establish successful live delivery, Meta compliance approval, or launch readiness.

## Verified Cloudflare inventory — 2026-10-29
- Account 10 connection ID: 10; account ID: `c26cc139515e4f56b9fc7010bd98d1b5` (read access verified).
- Worker `heavenly-key-social-management` exists; last modified `2026-10-28T12:42:36.183219Z`.
- Worker reports compatibility date `2025-01-01`, **zero bindings**, and `has_assets: false`. This is inconsistent with the repository's D1 binding and `[assets]` configuration. Do not call the live Worker production-ready.
- D1 `heavenlykey-social-management-db` exists with ID `96001ae8-d057-40d1-ba8a-167d8eab63cc`, matching `wrangler.toml`. Schema and migration state have **not** been checked.
- R2 `heavenlykey-social-management-storage` exists. It is not currently bound to the Worker; repository R2 binding remains commented out.
- Cloudflare Workers Builds configuration access was denied; token may require Workers Builds Configuration: Edit for the correct account. No deployment or configuration mutation performed.
- NEXT: confirm token and Worker deployment permissions; configure bindings and static assets from canonical source with owner approval, validate D1 schema/migrations, run tests and staging provider checks before production cutover.

## Release controls
- [ ] Run `npm run verify:local` and record the passing output for the exact commit proposed for release.
- [ ] Keep Gemini suggestions under operator approval until automated outbound messages have verified opt-in, human takeover and provider testing.
- [ ] Replace the shared admin bearer token with individual operator authentication and audited role permissions before a multi-user launch.
- [ ] Require owner approval before deploying Account 10; verify D1 and R2 bindings against the deployed Worker and test rollback.
