# Account 10 — Heavenly Key Social Management

Independent Cloudflare Worker, D1 database, and operator dashboard for unified social management. **Not yet verified for global production launch.** No advertisements.

## Implemented in source
- Authenticated dashboard, conversations, operator drafts, internal approval, human takeover, rules, post drafts, diagnostics, and basic migration endpoints.
- Meta webhook challenge verification and signed webhook ingestion with deduplication.
- Background import of signed WhatsApp Business text messages, preserving provider timestamps for the 24-hour customer service window.
- WhatsApp Business account metadata and live token-to-phone-number connection check (requires configured Worker secret).
- Explicitly confirmed operator-approved WhatsApp Cloud API text sending, gated on verified phone number, signed recent inbound message, and one durable delivery attempt per approved draft. Ambiguous provider responses are **never automatically retried**.
- Signed WhatsApp sent/delivered/read/failed receipt ingestion, durable early-receipt reconciliation, delivery ledger, and operator-visible receipt states.
- Gemini operator reply suggestions, never sent without human review.
- Draft-only post creation. Facebook, Instagram, YouTube, and TikTok publishing are **not implemented**.

## Cloudflare setup
1. Review `wrangler.toml`, provision the intended D1 database, and initialize `schema.sql`.
2. Apply migrations `0002_webhook_events.sql`, `0003_conversation_lookup.sql`, `0004_whatsapp_delivery.sql`, `0005_whatsapp_receipts.sql`, `0006_whatsapp_receipt_inbox.sql`, and `0007_post_media.sql` **in order**. Apply `0007_post_media.sql` and `0008_ai_rate_limits.sql` after migration 0006. See `npm run db:migrate:remote`.
3. Configure `ADMIN_TOKEN`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `META_WHATSAPP_ACCESS_TOKEN` as Worker secrets, never in source or browser. `GEMINI_API_KEY` is optional for suggestions.
4. Register the WhatsApp phone number ID in the dashboard, then verify its access against Meta before sending.
5. Run `npm run check` and `npm run build:check`; verify signed inbound webhook, delivery attempts, receipts, permissions, and mobile/desktop UX in a real staging deployment.

## Launch blockers
- Provider approvals and live end-to-end Meta testing, including receipt ordering and recovery.
- Official authorization and delivery/publishing adapters for other social platforms.
- Scheduled publisher, monitoring, production rate limits, audit logging, authenticated operator sessions/roles, privacy and retention review, and disaster recovery.
- Full device tests and successful production Cloudflare deployment.

Do not represent a Meta API acceptance response as proof of delivery. Check `DEPLOYMENT-VERIFICATION.md` before launch. No customer data should be imported without authorization.

## Operator conversation isolation safeguards
- The dashboard binds Gemini suggestions, internal notes and human takeover actions to the conversation selected when each action begins. Switching chats must not display a completed suggestion or an old conversation history in the newly selected chat.
- Gemini suggestions remain review-only; quota errors return a human-review fallback. This does not mean a WhatsApp message has been sent.
- Run `npm run verify:local` after every update and verify real messaging and human takeover against an authorized staging deployment before launch.
- Custom Domain `socialplus.heavenlykey.org` is declared in `wrangler.toml`, but GitHub changes do not activate DNS, secrets or deployed Worker bindings without the owner's authorized deployment.

## Continuous integration (no automatic deployment)
GitHub Actions workflow `.github/workflows/account10-verify.yml` runs `npm run verify:local` when Account 10 source changes, on related pull requests, and by manual dispatch. It only checks source, tests and dry-run packaging, with read-only repository permissions. No Cloudflare production token or deploy step is configured in this workflow. A green result is a code-build check, **not** a guarantee that production secrets, database migrations, WhatsApp delivery, Gemini quotas or DNS are working. Production remains owner-approved and requires the documented launch checklist.

## Gemini abuse and cost safeguards
Gemini suggestions are human-reviewed and require a D1-backed rate-limit migration (`0008_ai_rate_limits.sql`) **before** updating the Worker. The current source allows up to 8 requests per minute and 40 per hour per conversation, plus 300 per hour across Account 10. Limits are enforced via atomic SQLite upserts before Gemini requests. If the limiter table is unavailable, the AI endpoint fails closed and tells operators to handle messages manually. This is not a substitute for Cloudflare edge rate limits, individual logins, or Google provider quotas. Live rate-limit behavior remains to be tested after an authorized deployment.
