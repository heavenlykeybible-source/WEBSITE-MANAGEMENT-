# Community Care — reviewable draft

Members can opt into daily or weekly KJV encouragement, choose an IANA time zone and preferred hour, and pause it. Preferences live in D1, not localStorage. A home/sidebar reading card links to preferences on Prayer; signed-in Account also exposes preferences. Delivery goes into the existing Community notifications, visibly attributed to Community Care. It is not a personal chat or a message pretending to come from the President.

Seven exact KJV readings and separately labelled suggested prayers are seeded for ministry review. All start unapproved. Administrators/owner can review, approve and pause each scripture/prayer pair in Account. Decisions are audited. Only approved items appear to members or enter automatic delivery; there is no AI generation or external content provider. Weekly delivery rotates readings by week rather than repeating the same weekday's reading.

Prayer Care extends existing prayer requests: a real member explicitly selects “I am praying with you”, may opt into update notifications, and may withdraw support or stop updates. Counts derive from actual recorded actions. Send private encouragement opens the existing consent-based message-request flow; it does not send automated messages or bypass the recipient’s acceptance. The requester may post Still trusting God, an update, a testimony, or close the request. Followers can stop their own support/updates even after audience access is revoked. Notification updates coalesce while unread and are limited to one per request/member per hour after reading. A requester can explicitly schedule one reminder in approximately three days, cancel it, or pause all request reminders in preferences. Existing requests receive no automatic reminder; an update clears the old reminder. A new reminder requires another explicit selection.

Audience rules remain authoritative. Private ministry requests retain the original owner-only access; staff are not silently granted access. The UI states this honestly. The form starts private, identifies Community as public, and includes a selector for joined Prayer Circles. Current connections, circle membership, active account and blocks are checked for request/history access and update recipients. The dedicated close action publishes no user-authored text and remains available during timed posting restrictions; manual account locks, rate limits, authentication and CSRF remain authoritative. Closing narrows the request to owner-only visibility, so it remains private even if Care is disabled later. Testimonies remain attached to the same audience and never create a public feed post. Follower notifications contain no author, title, request text or testimony, and opening them checks current access again.

Prayer updates pass existing text rules and the moderation-only contextual gate when enforce is enabled. The existing answered endpoint is retained. Update request keys and an optimistic version check protect against retries and concurrent lost changes. Encouragement has a durable per-member/local-date delivery ledger and transactional SQL notification triggers. Repeated scheduler runs do not duplicate delivery; a concurrent opt-out or reading pause prevents delivery at insert time. Same-day retries advance scheduling without another message.

## Exact files changed

- global-community/migrations/0018_community_care.sql
- global-community/src/community-care.ts
- global-community/src/index.ts
- global-community/src/services.ts
- global-community/src/types.ts
- global-community/src/content-screening.ts
- global-community/public/community-care-ui.js
- global-community/public/community-care.css
- global-community/public/app.js
- global-community/public/account.html
- global-community/public/fellowship.html
- global-community/public/groups.html
- global-community/public/grow.html
- global-community/public/index.html
- global-community/public/messages.html
- global-community/public/missions.html
- global-community/public/prayer.html
- global-community/public/profile.html
- global-community/public/safety.html
- global-community/public/salvation.html
- global-community/public/spaces.html
- global-community/package.json
- global-community/test/community-care.checks.mjs
- global-community/review/COMMUNITY-CARE-REVIEW.md
- global-community/review/COMMUNITY-CARE-ACTIVATION.md

HTML changes only reference the new scoped stylesheet and update the shared app cache version. No other page design is replaced. The registration theme is loaded for SPA entry points and removed when leaving Account.

## Preserved

Design Cards, approved banner/photos, existing posts/feed filters, Christian reactions, comments, Groups, Spaces, member messages, connection/privacy rules, moderation/reporting, authentication/password protection and the existing footer remain. Existing hourly cron configuration, resource bindings, Account 4 and security baseline files are unchanged. Community Care and the original maintenance jobs run independently; failures are reported by task name after every job has had an opportunity to run.

## Tests and limits

`npm run buildcheck`: TypeScript, frontend syntax, preflight and 29 tests pass. New SQLite/API integration coverage includes defaults/off state, admin approval, invalid preferences, CSRF/auth, due delivery, retry/concurrency deduplication, real prayer support, private/connection/circle/block revocation, follower message redaction, reminder opt-in/pause/once-only behaviour, unchanged private testimonies, closure, required contextual screening and feature-off behaviour. Scheduling checks include daily/weekly, DST and half-hour time zones. A local 1,000-member delivery scenario drains 900 then 100 without duplicates; this is not a Cloudflare production load benchmark.

Additional DOM checks passed: no silent enrolment; preference submit; unapproved reading state; real support count; history loading keeps owner forms intact; failed-update retries retain their request key; private default; circle selector; member/owner controls. No real browser visual, mobile device, Cloudflare cron or external email/push test was performed.

## Unfinished / activation

This is source in the existing draft only: no merge, deployment, production migration, member enrolment, notification send or provider setup was performed. See activation instructions. Database migration 0018 is required before enabling COMMUNITY_CARE. The seven readings require owner/ministry review and approval. Email, SMS, device push, custom direct-message bots and a larger editorial catalogue are not included.

The existing hourly cron is retained: preferred delivery is approximate. Each tick processes up to 900 encouragements and 100 reminders, oldest due first. Larger backlogs wait for subsequent ticks; missed days are not flooded back to members. Real Cloudflare capacity, query/CPU budgets, scheduler reliability, delivery timing and notification UX need staging verification before owner approval. No exact-time or background phone-alert promise is made.

Audit follow-up: see COMMUNITY-CARE-AUDIT.md for the fixes and additional test evidence.
