# Account 10 — Heavenly Key Social Management

Independent Cloudflare Worker, D1 database, and operator dashboard for unified social management. **Not yet verified for global production launch.** No advertisements.

## Implemented in source
- Authenticated dashboard, conversations, operator drafts, internal approval, human takeover, rules, post drafts, diagnostics, and basic migration endpoints.
- Meta webhook challenge verification and signed webhook ingestion with deduplication.
- Background import of signed WhatsApp Business text messages, preserving provider timestamps for the 24-hour customer service window.
- WhatsApp Business account metadata and live token-to-phone-number connection check (requires configured Worker secret).
- Explicitly confirmed operator-approved WhatsApp Cloud API text sending, gated on verified phone number, signed recent inbound message, and one durable delivery attempt per approved draft. Ambiguous provider responses are **never automatically retried**.
- Signed WhatsApp sent/delivered/read/failed receipt ingestion, delivery ledger, and operator-visible receipt states.
- Gemini operator reply suggestions, never sent without human review.
- Draft-only post creation. Facebook, Instagram, YouTube, and TikTok publishing are **not implemented**.

## Cloudflare setup
1. Review `wrangler.toml`, provision the intended D1 database, and initialize `schema.sql`.
2. Apply migrations `0002_webhook_events.sql`, `0003_conversation_lookup.sql`, `0004_whatsapp_delivery.sql`, and `0005_whatsapp_receipts.sql` **in order**. See `npm run db:migrate:remote`.
3. Configure `ADMIN_TOKEN`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `META_WHATSAPP_ACCESS_TOKEN` as Worker secrets, never in source or browser. `GEMINI_API_KEY` is optional for suggestions.
4. Register the WhatsApp phone number ID in the dashboard, then verify its access against Meta before sending.
5. Run `npm run check` and `npm run build:check`; verify signed inbound webhook, delivery attempts, receipts, permissions, and mobile/desktop UX in a real staging deployment.

## Launch blockers
- Provider approvals and live end-to-end Meta testing, including receipt ordering and recovery.
- Official authorization and delivery/publishing adapters for other social platforms.
- Scheduled publisher, monitoring, production rate limits, audit logging, authenticated operator sessions/roles, privacy and retention review, and disaster recovery.
- Full device tests and successful production Cloudflare deployment.

Do not represent a Meta API acceptance response as proof of delivery. Check `DEPLOYMENT-VERIFICATION.md` before launch. No customer data should be imported without authorization.
