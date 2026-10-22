# Member messaging audit and text-chat improvements

## Audit outcome

The existing service had consent-based one-to-one text requests, participant-only access, blocking/privacy checks, reporting/moderation, sent/received bubbles, date separators, per-chat memory drafts, retry-safe sends, basic search, mobile list/thread switching, a latest-message jump and a 15-second visible-page poll. It was not a full WhatsApp equivalent.

WhatsApp official sources inspected on 19 October 2026:
- https://www.whatsapp.com/privacy
- https://faq.whatsapp.com/236979282604093
- https://faq.whatsapp.com/665923838265756/

These document encryption, messaging/calling and receipt functionality that this Community draft does not provide. No signed-in WhatsApp usability session was performed; no superiority or feature-parity claim is made.

## What changed

- Inbox rows show the most recent delivered message preview/time and the member's existing approved profile photo. Held/removed content is excluded from previews by query. No fabricated unread/online/seen indicators.
- Chats refresh every five seconds while visible, skipping overlapping poll cycles. This is polling, not instant server push. Added manual Refresh chats, visible sync errors and initial-history retry. Hidden pages do not poll.
- Message history loads older pages of up to 100 via a validated before cursor, retaining chronological order, deduplicating message IDs and preserving scroll position when prepending. Exhausted pagination stays exhausted during live refresh. Search explicitly covers loaded messages. Reopening a chat starts from current authorized history.
- Added Copy message alongside the existing report control. Original sending/retry identifier, per-chat drafts, reporting, safe text rendering and the honest encryption notice remain.
- Version/revision, host and session guards discard stale inbox/thread/search/history responses after newer reads or navigation. Sending responses from a previous view/session cannot erase current session data.
- Refined navy/wine text-chat presentation: clearer previews, history bubbles, composer, keyboard focus and mobile chat-list/thread switching. No ordinary media upload, voice note or calling feature was added, in keeping with the owner's text-only instruction.

## Files changed

- `global-community/public/app.js`
- `global-community/public/active-content.css`
- `global-community/src/services.ts`
- `global-community/src/index.ts`
- `global-community/test/group-controls.checks.mjs`
- `global-community/test/frontend-feed.checks.mjs`
- `global-community/review/MESSAGING-REVIEW.md`
- `global-community/public/safety.html`
- `global-community/public/spaces.html`
- `global-community/public/fellowship.html`
- `global-community/public/index.html`
- `global-community/public/prayer.html`
- `global-community/public/profile.html`
- `global-community/public/missions.html`
- `global-community/public/grow.html`
- `global-community/public/groups.html`
- `global-community/public/salvation.html`
- `global-community/public/account.html`
- `global-community/public/messages.html`

HTML changes only revise existing shared script/style cache versions.

## Existing functionality preserved

Authentication; participant-only access; recipient approval; profile messaging preferences; blocks in either direction; active-account checks; moderation/reporting; request accept/decline; existing member profiles; retry deduplication; date/time bubbles; drafts; desktop Enter/Shift+Enter behavior and mobile Send. No unrelated Community/Control Room/footer/security baseline changes.

## Tests performed

Full Community buildcheck passed (27 tests), including TypeScript/frontend syntax, all existing suites and extended real-SQLite messaging checks. New checks cover history beyond 100, non-overlapping older pages, invalid cursors, outsider denial even with a valid cursor, held-content exclusion from inbox previews and original photo fields. Existing tests cover consent, blocks, suspended accounts, outsider send/read denial, idempotency, conflicting retry keys and notification-failure retry.

After final view/session cleanup, frontend syntax and feed/navigation tests passed. DOM interaction checks passed for paging/deduplication, exhausted cursor persistence, copy-message, newer-read precedence, stale-session suppression, original profile photo and inbox previews. These are source/DOM tests; they do not certify browser rendering or two physical devices.

## What remains unfinished

No claim of a full WhatsApp experience. Missing: end-to-end encryption, server-push/WebSocket delivery, typing indicators, live presence/last-seen, delivered-to-device/read receipts, persistent unread counters, reply threads/quoted replies, message editing/deletion, attachments/voice notes/calls, push notifications and encrypted multi-device/offline history. Calls/voice/media are deliberately outside the approved text-only scope. Messages remain server-readable under existing reported-message moderation policy; the UI says they are not end-to-end encrypted.

Browser/mobile-keyboard and two-user real-device checks, load testing of five-second polling and integrated CI/protected-state checks remain before deployment. History cached in an open view is refreshed page-wise; older loaded pages are not continuously re-fetched. Memory drafts are not promised to survive a reload. Search is loaded-history only; the inbox retains its existing 100-conversation cap.

## Database migration

None for this messaging update. Existing messages, conversations, profile-photo and retry-key fields are reused. No user data reset or deletion. Earlier ACTIVE migrations remain separate.

## Review state

Draft source only, saved for owner review. No merge, production SQL or deployment.
