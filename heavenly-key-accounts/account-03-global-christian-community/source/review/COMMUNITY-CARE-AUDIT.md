# Community Care audit — fixes in draft

Scope: daily/weekly encouragement, ministry approval, server preferences, prayer support/history, privacy withdrawal, notifications, scheduling, the new UI and integration with existing authentication/moderation. This is not certification of the entire website or a live production audit.

## Findings corrected

1. **Privacy withdrawal could be blocked by a timed participation restriction or unavailable moderation provider.** Added narrowly scoped DELETE actions: archive an owned prayer privately with no authored text, or delete only the current member's own prayer-support subscription. These do not publish content or bypass ownership checks. Text updates and joining/supporting remain subject to the original posting restrictions and moderation. Manual account locks, authentication, CSRF and write-rate limits stay authoritative. Closure remains idempotent and preserves owner-only visibility if Care is disabled later.
2. **Followers could receive a new notification for every legitimate prayer update.** Added coalescing: no new notification while that request has an unread update, and no further notification within one hour of the previous one even after it was read. History still records each accepted update. A partial index supports the recipient/request lookup. Existing audience, membership, active-account and block checks are retained.
3. **Stopping support required reading the request first.** A member who lost connection/circle access could not withdraw a previous subscription. The withdrawal action deletes only the current user's row and returns a generic result even for an unknown request ID. The UI offers Stop following when the selected request is unavailable and Stop prayer support & updates on an existing subscription.
4. **An edited update after a failed response reused the previous request key.** Unchanged retries retain their key; editing text/type generates a new one. This permits a genuinely new update without removing duplicate protection. Choosing Close disables the text area and sends only the close action and its request key.
5. **An earlier maintenance failure could prevent the care scheduler from running.** Existing cleanup, moderation draining, social-flow cleanup and Care now run independently with Promise.allSettled. All jobs get an opportunity to run; the scheduled invocation then fails visibly with generic failed task names. Private exception details are not copied into that summary. Existing cron frequency and resource bindings are unchanged.

## Verification

- Full `npm run buildcheck` passed: TypeScript, frontend syntax, preflight and 29 automated tests.
- Extended Worker/SQLite integration tests verify follower coalescing while unread, after reading and after the hour window; withdrawal after circle access is revoked; non-enumerating unknown-ID withdrawal; owner-only/CSRF-protected private closure; unchanged written-update restrictions; temporary participation restrictions versus manual account locks; idempotent closure; ignoring text attached to the non-publishing close route; and deleting only the caller's support record.
- Injected failures prove Care runs when independent social cleanup fails, and existing maintenance runs when Care fails. The scheduler still reports each failure.
- Existing 1,000-member batching/deduplication, private testimony, approvals, consent, connection/circle/block privacy and daily/weekly/DST scheduling tests pass.
- DOM checks pass, including unchanged retry-key reuse, new keys after editing, disabled close text area, the text-free DELETE request, owner controls surviving history loading, preferences, private defaults, circle selection and consent-based private encouragement.

## Files changed in this audit

- global-community/src/community-care.ts
- global-community/src/index.ts
- global-community/migrations/0018_community_care.sql (adds the pending partial index)
- global-community/public/community-care-ui.js
- global-community/public/app.js (module cache version)
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
- global-community/test/community-care.checks.mjs
- global-community/review/COMMUNITY-CARE-REVIEW.md
- global-community/review/COMMUNITY-CARE-ACTIVATION.md
- global-community/review/COMMUNITY-CARE-AUDIT.md

HTML changes only refresh the shared JavaScript version so the audit fixes reach every Community entry point. Design Cards, approved imagery, comments, Christian reactions, Groups, Spaces, member messaging/consent, footer, resource bindings and Account 4 remain unchanged.

## Remaining release work

No merge, deployment, production migration or member message was performed. Migration 0018 remains required; the audit does not add another numbered migration. If an earlier version of 0018 was applied to a disposable staging database, add only the new index with IF NOT EXISTS or rebuild staging rather than rerunning ALTER TABLE. The seven starter readings still require ministry review. Real desktop/mobile visual testing, Cloudflare scheduling/capacity and integrated CI/protected-state acceptance remain outstanding. Local SQLite tests are not a production load test. No email/SMS/device-push delivery has been connected.
