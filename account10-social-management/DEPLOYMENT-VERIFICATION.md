# Account 10 — Deployment verification checklist

This checklist distinguishes repository code from an operational Cloudflare deployment.

## Database
- [ ] Apply `schema.sql` to the Account 10 D1 database.
- [ ] Apply `migrations/0002_webhook_events.sql`, `0003_conversation_lookup.sql`, and `0004_whatsapp_delivery.sql` in order after the base schema.
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
- [ ] Implement provider delivery receipts, reconciliation, and remaining platform delivery adapters.
- [ ] Verify human takeover prevents automated replies.
- [ ] Test draft review and outbound approval separately from provider delivery.
- [ ] Test publishing, scheduling, retries and idempotency.
- [ ] Verify Account 2 migration counts and preserve source data until approved cutover.

## Launch gate
Do not announce production readiness until the above checks pass on a deployed Worker, with verified provider credentials and device testing. Signed WhatsApp text webhooks can be imported into the internal inbox, and an explicitly approved operator reply can be submitted to the WhatsApp Cloud API when configured. This does not establish successful live delivery, Meta compliance approval, or launch readiness.
