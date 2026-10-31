# Account 10 — Deployment verification checklist

This checklist distinguishes repository code from an operational Cloudflare deployment.

## Database
- [ ] Apply `migrations/0008_ai_rate_limits.sql` after all previous migrations and before enabling Gemini suggestions.
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

## Runtime check — 2026-10-31
- Read-only Cloudflare Account 10 connection verifies that D1 `heavenlykey-social-management-db` exists with the configured database ID, and R2 bucket `heavenlykey-social-management-storage` exists.
- These inventory checks **do not prove** either resource is bound to the deployed Worker or that migrations have been applied.
- Worker maintenance status returned `No active maintenance permission for this agent and account`; deployment state, configured Gemini secret and active custom-domain route remain unverified.
- Latest GitHub source hardens operator credential-switch privacy, asynchronous chat switching, and Gemini suggestion/human-takeover isolation. Dashboard JavaScript parsing and specific source assertions passed; full local Node tests and end-to-end provider testing were not run.
- Preserve owner-approved manual deployment. Do not deploy source-only Worker code without its full static dashboard assets and D1/R2 bindings.
- **Release remains blocked** until authenticating operators individually, database migration verification, Cloudflare asset/binding checks, live WhatsApp opt-in delivery receipts, Gemini tests, and security/device verification.

## Production security gates (OWASP ASVS 5.0 / Cloudflare guidance)
- [ ] Replace shared `ADMIN_TOKEN` with individual operator identities, short-lived sessions, server-side session invalidation on logout, least-privilege roles, and auditable access changes.
- [ ] Enable Cloudflare edge rate limiting on authenticated APIs and Gemini suggestion requests, and an appropriately scoped failed-authentication rule, with safeguards against blocking real operators.
- [ ] Verify `ADMIN_TOKEN`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_WHATSAPP_ACCESS_TOKEN` and `GEMINI_API_KEY` are configured as encrypted Cloudflare secrets rather than Wrangler plaintext variables.
- [ ] Verify the operator dashboard returns `Cache-Control: no-store` for HTML, and private JSON API responses are never cached by a CDN.
- [ ] Verify stale session responses cannot repopulate other operators' conversations, and live tests cover sign-out during an outstanding Gemini call.
- [ ] Confirm the official domain, TLS, D1 and R2 bindings, database migrations and dashboard assets on the **deployed** Worker.
- [ ] Perform independent authenticated penetration testing, incident response, backup recovery, disaster recovery and mobile/desktop accessibility checks.
- [ ] Preserve manual deployment approval and do not enable provider publishing or autonomous sending before separate authorization and live testing.

## Gemini rate-limit release gate
- [ ] Apply `migrations/0008_ai_rate_limits.sql` to staging and production before deploying new code. The AI endpoint fails closed (503) until the table exists.
- [ ] Verify test conversations enforce a maximum of 8 suggestions per minute and 40 per hour, with an account-wide hourly ceiling of 300; do not send high-volume requests to Gemini in tests.
- [ ] Verify exhausted limits yield 429 and manual human response remains available.
- [ ] Independently configure Cloudflare edge abuse and authentication throttling; the D1 counter is an AI-specific cost safeguard, not complete site-wide rate limiting.
- [ ] Establish a retention and cleanup policy for old request counter rows.

## Gemini and social-media staging verification
- [ ] Deploy only after owner approval and apply migration 0008_ai_rate_limits.sql first.
- [ ] Authenticated POST /api/ai/connection-check reaches Gemini with a KJV reference check; verify anonymous requests get 401 and the sixth hourly check receives 429 without exposing secrets.
- [ ] Authenticated POST /api/ai/suggest-post returns review-only ministry suggestions for Facebook Page, Instagram professional, YouTube, TikTok and X; no post is saved, queued, sent or published automatically.
- [ ] X accounts remain unverified and cannot publish; every provider needs its own official authorization and a tested publishing adapter.
- [ ] /api/automation/evaluate-and-draft must not generate a rule-based reply when a visitor explicitly asks to speak to Evangelist Emmanuel or a human.
- [ ] Conduct a live WhatsApp test using a consented test number: signed webhook, handover, operator approval, delivery ledger, signed receipts.
- [ ] Verify CI typecheck, bundle and test results, and review security scanning and rollback before global launch.

## Human-request lifecycle security gate
- [ ] In the operator dashboard, an explicit visitor request for Evangelist Emmanuel or a human must display the pending state. The resume button must require operator confirmation and call POST /api/human-requests/resolve rather than POST /api/takeover.
- [ ] At the API level, POST /api/takeover with paused=false must return HTTP 409 while requested_human=1. The human-request resolution route remains the only authorized way for the operator to clear requested_human and resume Gemini.
- [ ] Test concurrent inbound WhatsApp human requests versus operator resume, using consented test conversations, and confirm no automated content is sent.
- [ ] This follows OWASP server-side authorization and deny-by-default guidance and WhatsApp Business Policy's clear human-escalation requirement.
