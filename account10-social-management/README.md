# Account 10 — Heavenly Key Social Management

Independent Cloudflare Worker and D1 database for a private, operator-managed unified inbox. This is an initial backend scaffold, **not a deployed or production-ready messaging service**.

## Included
- Health and configuration status endpoint
- Bearer-protected conversation list and detail endpoints
- Human takeover toggle stored in D1
- Database schema for conversations and messages

## Before launch
1. Create a separate Cloudflare Account 10 and D1 database; configure the binding in wrangler.toml.
2. Set ADMIN_TOKEN using Cloudflare secrets, not source code. Replace the starter bearer-token scheme with authenticated sessions and role permissions before public launch.
3. Connect a separate Gemini project securely; implement AI response service and cost/rate limits.
4. Implement verified Meta WhatsApp Business and Facebook Messenger webhooks, consent, idempotency, rate limiting and platform-compliant sending.
5. Implement notifications, message ingestion, human takeover enforcement, privacy/retention policy, and real integration tests.
6. Never copy private conversations from the existing Online Assistant without authorization.

The API does not currently receive, intercept or send live platform messages.
