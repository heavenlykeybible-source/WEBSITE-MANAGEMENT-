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

## Ministry account human-contact choices
- [ ] Apply `0009_human_contact_target.sql` after migration 0008 before using the updated human-contact API.
- [ ] Confirm the welcome menu offers **Heavenly Key Evangelistic Movement agent** and **Evangelist Emmanuel Ogheneochuko Adiohwo** as separate options.
- [ ] POST /api/human-requests with an authorized conversation ID and target `ministry_agent` or `speak_to_evangelist` must pause Gemini and preserve the selected target. Reject any other target with HTTP 400.
- [ ] GET /api/human-requests must show the selected destination to the authorized ministry operator; no automated claim of direct notification or conversation initiation.

## Contact destination integrity — October 2026
- [ ] When a consented WhatsApp test user sends 'I want to speak with a Heavenly Key Evangelistic Movement agent', the signed-event processor stores `human_contact_target=ministry_agent` and pauses Gemini.
- [ ] When a consented WhatsApp test user sends 'I want to speak with Evangelist Emmanuel Ogheneochuko Adiohwo', the processor stores `human_contact_target=speak_to_evangelist` and pauses Gemini.
- [ ] Repeated requests must not silently change an already-pending destination; the API rejects duplicate requests, and the operator queue displays the saved destination.
- [ ] Operator resolution of an already-resolved request must return HTTP 409 rather than modifying a different conversation state.
- [ ] Ensure D1 migration `0009_human_contact_target.sql` is applied before processing inbound human-contact requests. Roll out only after approval; the integration sends no automatic human-notification message.

## Unified destination-aware AI escalation
- [ ] After migration 0009, request Gemini operator suggestion with the phrase 'I want to speak with Evangelist Emmanuel Ogheneochuko Adiohwo'; verify `human_contact_target=speak_to_evangelist`, `human_paused=1`, no Gemini provider call, and no outbound message.
- [ ] Repeat with 'I want to speak with a Heavenly Key Evangelistic Movement agent' and verify `human_contact_target=ministry_agent`.
- [ ] Both POST /api/ai/suggest-reply and POST /api/automation/evaluate-and-draft must honor the same destination and reject changes to pending or paused human requests.
- [ ] Check browser dashboard's human requests list visibly distinguishes both routing choices and does not imply a human has already been notified.

## WhatsApp human handover replay protection — migration 0010
- [ ] Apply `0010_whatsapp_handover_dedupe.sql` after migration 0009 before activating the upgraded WhatsApp event processor; an unapplied migration should fail closed, not silently skip recording the handover.
- [ ] Replay the same signed WhatsApp message in distinct stored webhook events; after the first processed event and operator resolution, the duplicate must not reopen the request or overwrite its chosen destination.
- [ ] Verify the ledger consumes the handover message atomically with database processing and preserves `consumed=1` on duplicate events.
- [ ] Run `npm run verify:local`, including typecheck, security tests, dashboard tests and Cloudflare dry-run, before seeking owner approval for staging deployment.

## Authenticated D1 release readiness
- [ ] After approved staging migration, call authenticated `GET /api/automation/readiness` and require `migrationReady=true`, `humanContactColumn=true`, `whatsappReplayLedger=true`, and `aiUsageLimits=true`.
- [ ] Remove or simulate each required D1 object in a disposable test database and verify readiness returns false; never use a production database for destructive testing.
- [ ] Treat `providerWebhooks=false` and `providerPublishing=false` as launch blockers even when schema checks pass. Schema presence is not proof of live provider acceptance.
- [ ] Confirm documented migrations through `0010_whatsapp_handover_dedupe.sql` were applied in order to the selected D1 environment.

## Operator human-request attention counter
- [ ] After authenticated sign-in, verify the Human Requests tab shows the number of pending handovers currently returned by the server (at most 100 are listed; `100+` denotes a capped count).
- [ ] Open Human Requests and resolve a consented test request; the count must refresh without sending any third-party notification.
- [ ] Sign out or change access credentials; the count must immediately clear and any in-flight request for the old session must not restore it.
- [ ] The counter is a dashboard aid, not a push alert, assignment to a specific operator, or evidence that Evangelist Emmanuel received a message.

## Dashboard stale-response privacy regression
- [ ] Switch among Accounts, Human Requests, Activity, and Launch Checks while requests are still loading. Responses from the previous tab must not replace the new tab's content.
- [ ] Sign out or change credentials while Launch Checks is loading. Neither the first management request nor nested webhook/integrity requests may display confidential data afterward.
- [ ] Verify the application still uses a shared admin token; client-side request cancellation is only a defense in depth. Individual revocable sessions, RBAC, idle timeouts, and server-side revocation remain global-launch blockers.

## Handover generation / stale operator protection
- [ ] Apply migration `0011_human_request_version.sql` after migration 0010 before deploying the new API or dashboard.
- [ ] Generate an agent handover request, note its `human_request_version`, resolve it, then generate a new request for the same conversation. Confirm an older operator's resolution with the original version receives HTTP 409 without clearing the newer request.
- [ ] Confirm operator dashboard resume and Mark Handled send the exact version from the corresponding conversation or queue item, and clear cached versions upon sign-out or credential change.
- [ ] Verify authenticated `/api/automation/readiness` remains false if `human_request_version` is absent, and true only if all required handover and rate-limiting schema elements exist.
- [ ] This version control prevents stale handover resolution but does not replace individual operator logins, auditable actor identities, or provider-side human notification.

## Operator secret and browser-origin security gate
- [ ] Before deploying the new Worker, check the existing Cloudflare `ADMIN_TOKEN` secret out of band: generate a fresh cryptographically random token of at least 32 and at most 512 characters, with no whitespace. Store it using Cloudflare Workers secrets, never in GitHub, logs, chat, or frontend source. Rotate the old credential in a controlled maintenance window. This is a shared secret, not individual access control.
- [ ] In staging, a missing, short, or malformed `ADMIN_TOKEN` must return HTTP 503 on authenticated API routes; a wrong bearer token must receive HTTP 401. Do not publish the actual token in test evidence.
- [ ] After authentication, verify mutating POST/PUT/PATCH/DELETE requests with a foreign or `null` Origin are rejected with HTTP 403, while same-origin requests and authorized service clients without an Origin remain eligible for normal route validation.
- [ ] This does not replace per-person identity, role-based authorization, session revocation, edge abuse controls, and a complete production penetration test.

## Bounded operator-token verification
- [ ] Confirm the shared admin bearer token comparison uses the Cloudflare Web Crypto SHA-256 verifier and a full digest byte comparison; no credential value appears in logs, error responses or frontend source.
- [ ] Test valid token, wrong same-length token, extra token bytes, malformed Authorization scheme, and an excessively long Authorization header.
- [ ] Verify the new authentication helper is exercised by the automated security contract suite and that the production secret is still stored only in Cloudflare Workers secrets.
- [ ] Treat this as temporary shared-token hardening, NOT completion of person-specific access, role-based authorization, MFA, or session revocation.
