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

## Gemini ministry doctrine and verified knowledge
Gemini's `systemInstruction` uses `src/assistant-profile.ts`. This source is now ministry-only and specifies the Authorized KJV for Bible quotations, the Heavenly Key identity, REVIVAL/HOLINESS/POWER, the fivefold ministry vision, relevant holiness/sanctification guidance, a helpful Christian response style and the existing human-takeover and approval-only rules. The original Gemini rate limits and operator-approval controls remain in force.

The doctrine is aligned by reference with published Deeper Christian Life Ministry teaching (official overview: https://dclm.org/about/what-we-believe/) and the ministry instructions supplied by the owner. This is **not** a declaration of endorsement or of exact duplication of Pastor W. F. Kumuyi's teachings. Do not reproduce long passages from copyrighted devotionals or sermons.

**Knowledge coverage limitation:** This Worker does not yet fetch or index the authoritative and current full Heavenly Key statement of faith or all pages at `www.heavenlykey.org`. The profile explicitly instructs Gemini to acknowledge missing or time-sensitive details rather than inventing them. The previous assistant's private prompt, memory, and full data store have not been retrieved or cloned; this profile is an audited best-effort adaptation of known requirements.

**To complete knowledge parity:** obtain an approved version-controlled source of truth for the full Heavenly Key statement of faith, ministry departments, public website pages, service links and schedules; build a read-only curated knowledge retrieval endpoint; enforce source citations, versioning and approval of edits; test responses against doctrinal and privacy cases before owner-approved deployment. Keep secrets and private conversations out of the ministry knowledge base.

## Human takeover for WhatsApp and Gemini
- The original welcome menu remains available with the option to speak to Evangelist Emmanuel Ogheneochuko Adiohwo, prayer requests, KJV Bible questions, radio and Global Christian Community.
- `src/human-handover.ts` conservatively recognizes explicit requests to speak to a ministry representative. During **authorized processing of signed inbound WhatsApp text webhooks**, the D1 conversation is marked `requested_human=1` and `human_paused=1`. Existing operator dashboard human-request views can surface it.
- The Gemini suggestion route detects an explicit human request **before** requiring an API key or contacting Gemini. It marks the same conversation for human attention and returns `sent:false` and `externalNotificationsSent:false`. A human operator must respond; the system does not impersonate or automatically notify the Evangelist.
- Resuming Gemini requires an explicit operator resolution using the existing human-request resolution route. Do not auto-resume on unrelated inbound messages.
- **Not yet live:** automatic WhatsApp welcome-menu delivery, Meta account/provider-side approval, Facebook/Instagram/X/TikTok/YouTube integrations, verified notification delivery to a human, staging test, and production deployment. Do not claim these functions are connected or operational until tested.

## Gemini social content suggestions (draft-only)
Authenticated operators can call `POST /api/ai/suggest-post` with JSON such as `{"platform":"youtube","topic":"A KJV-based message about prayer and holiness"}`. Supported draft destinations: `facebook_page`, `instagram_professional`, `youtube`, `tiktok`. The endpoint reuses the Heavenly Key ministry/KJV system instruction, caps Gemini usage with D1 migration 0008, and returns `action:"review_post"` plus an editorial suggestion. It does **not** save, schedule, send, upload or publish content; an operator must independently review and approve it. Actual provider permissions, video upload APIs and cross-platform delivery are not connected by this endpoint.

X/Twitter is planned but not in the existing `social_posts` database platform constraint, so it must not be presented as operational until a tested D1 schema migration and adapter are implemented. Google/YouTube video uploads require OAuth 2.0 permission and an actual authorized video payload; a Gemini suggestion is not an upload. Avoid any live platform action without explicit owner approval.
