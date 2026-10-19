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
