# Account 10 — Deployment verification checklist

This checklist distinguishes repository code from an operational Cloudflare deployment.

## Database
- [ ] Apply `schema.sql` to the Account 10 D1 database.
- [ ] Apply `migrations/0002_webhook_events.sql` once, after the base schema.
- [ ] Confirm `webhook_events` exists with a unique primary key.
- [ ] Confirm repeated signed events are stored only once.
- [ ] Confirm pending event records survive Worker restarts.

## Secrets and authentication
- [ ] Configure `ADMIN_TOKEN` and `META_APP_SECRET` as Worker secrets, not committed files.
- [ ] Configure `META_WEBHOOK_VERIFY_TOKEN` as a secret.
- [ ] Confirm unauthenticated requests to `/api/webhooks/events` return 401.
- [ ] Confirm incorrect webhook signatures return 401.
- [ ] Confirm oversized webhook bodies return 413.
- [ ] Confirm a valid signed request returns stored:true only after database write succeeds.

## End-to-end functionality
- [ ] Connect approved Meta accounts and validate permissions.
- [ ] Implement and verify incoming event-to-conversation processing.
- [ ] Implement actual provider delivery and delivery status reporting.
- [ ] Verify human takeover prevents automated replies.
- [ ] Test draft review and outbound approval separately from provider delivery.
- [ ] Test publishing, scheduling, retries and idempotency.
- [ ] Verify Account 2 migration counts and preserve source data until approved cutover.

## Launch gate
Do not announce production readiness until the above checks pass on a deployed Worker, with verified provider credentials and device testing. Current webhook storage does not by itself deliver messages or process events.
