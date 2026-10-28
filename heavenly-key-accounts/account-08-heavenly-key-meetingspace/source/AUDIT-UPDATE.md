# Live deployment update — 20 October 2026

Account 7 meeting app is live at https://heavenly-key-zoom-studio.omegawealthcreator.workers.dev/. Stable Worker: `heavenly-key-zoom-studio`. Owner-selected existing bindings: D1 `heavenlykey-db`, private R2 `heavenlymedia`. Existing records, secrets and resource identities are preserved. Account 2 was not changed by this work.

The reviewed Control Room installer embeds the complete public website. Owner-approved P-7 introduced native guest rooms; owner-approved P-9 published the AI, connection-retention and password-setup repairs. Guest rooms use per-room SQLite Durable Objects with WebSocket hibernation. Host access is signed, guests wait for admission, stage capacity is six, audience capacity is 100, and room state survives idle wakeups. Media remains browser-to-browser. Leaving ends the room. The existing external Node/FFmpeg relay remains necessary for platform RTMP streaming.

Live checks passed: public banner/assets, additive database initialization, Control Room owner entry, admin read access, groups/program list screens, opening/closing a native guest room, host room chat, AI writer output and generated announcement voice. A retired writer model was replaced with the active FP8 variant. Room admission, moderation, expiry, room isolation, hibernation restoration and single-use owner password setup are covered by local tests. Final validation: 151 Control Room checks, 120 backend checks and 14 Node test entries pass.

Saved channel connections no longer expire after 90 days of inactivity. Inactive users with saved channel connections are preserved by cleanup. Explicit disconnection/account deletion and provider revocation remain possible. Other documented message/attendance retention rules remain in place.

A fresh Control Room owner launch provides a single-use ten-minute recovery ticket for the reserved owner password. The owner enters and submits the new password privately. It never changes automatically during deployment or launch. The owner can create `admin` with the Admin role; ordinary admins cannot appoint admins or reset the owner. Live password entry and account creation require the user's browser handoff and are not claimed completed here.

Still requires configuration or device verification: real camera/microphone and guest-to-host media on separate devices/networks; TURN for restrictive networks; external RTMP relay; YouTube/Meta OAuth developer credentials and platform authorization; optional email/payment services. Radio remains on hold. Legal pages retain clearly marked draft placeholders for business/contact and legal terms; those details have not been invented or certified.

The older upload-only audit below is historical and is superseded by this update where it conflicts.

---

# Audit and fixes — 19 October 2026

Scope: uploaded Zoom Studio package; login, account administration, role boundaries, account lifecycle and relevant interface code. No live deployment was accessed or changed. This report supersedes conflicting older audit statements for these areas.

## Changes

- Added database-backed owner/admin/user roles, upgrade migration, and private initial account provisioning.
- Added username aliases, password visibility control, account creation, administrative password reset and own-password change.
- Prevented public registration of configured privileged email identities or reserved username identities. Previously a public signup matching ADMIN_EMAILS immediately gained admin access.
- Restricted administrator appointment/management to the owner; protected owner from suspension, deletion and admin resets.
- Invalidated previous sessions after password resets, password changes, suspension/restoration and role changes. OAuth callbacks now verify the account is present, not suspended and still has the session version that began connection.
- Owner/admin no longer need a paid plan for staff use; account mode obtains its relay credential automatically.
- Removed request-global password pepper state; hashing now uses each request's environment explicitly.
- Replaced destructive INSERT OR REPLACE user writes with an upsert; public signup and admin account creation use insert-only semantics so simultaneous creation cannot overwrite an existing credential.
- Added strict login signature length validation, account-management rate limits, safe error feedback and role-aware interface controls.
- Protected inactive staff from the idle-account cleanup path. Initial account setup is repeatable without resetting existing passwords.
- Corrected stale KV binding comment and refreshed the installed-app cache version.
- Marked 24/7 radio on hold; retained source for later activation.

## Validation

`node --test tests/worker.test.mjs`: all 115 checks passed (79 original regression checks plus 36 new checks).

New checks cover initial owner/admin passwords using real PBKDF2, username login, staff relay access, privileged signup prevention, user/admin creation, duplicate creation, role boundaries, owner protection, resets and old-session invalidation, self-password changes, no password hash exposure, staff cleanup protection, repeatable provisioning and migration from the original schema.

Inline browser JavaScript, relay, playout, setup script and service-worker syntax checks passed. HTML has unique IDs and all literal JavaScript element references resolve.

A Chromium UI smoke test is included at `tests/browser.test.cjs`; it was attempted but could not run because this environment has no browser binary. Do not treat camera, mobile layout or UI runtime behavior as browser-tested. To run elsewhere: install Node.js 22+, Playwright and its Chromium browser, then run that script.

## Still requires deployment/integration testing

- Apply migration/provisioning and test the real Cloudflare deployment, including free-plan CPU limits. SQLite test results do not establish Cloudflare resource usage.
- Test physical cameras/microphones, guest WebRTC, relay reconnection and destination streams on real devices/networks.
- YouTube/Meta authorization, Paystack, Resend and Workers AI remain dependent on external credentials and services; none was live-tested here.
- Control Room single sign-on needs both applications' integration; it is not implemented in this ZIP.
- Login tokens still use local storage and some media components load external scripts; those existing architecture limitations remain. Browser-side password length checks are usability checks; the backend accepts pre-derived credentials and cannot infer the original password length.
- 24/7 radio remains on hold. Separate relay/signalling infrastructure is still required for active streaming and guest rooms.
