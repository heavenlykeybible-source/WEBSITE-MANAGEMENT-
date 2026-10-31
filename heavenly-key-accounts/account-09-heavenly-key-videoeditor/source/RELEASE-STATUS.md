# Account 9 verification — 29 October 2026

Launch readiness remains unconfirmed. Do not advertise this as a verified global release.

Verified against Website Management main source:
- Account 9 preflight and 49/49 backend integration checks passed (local SQLite and mocked media/AI services).
- Frontend wiring/security checks and offline lifecycle/cache-refresh behavior passed.
- Canonical Worker build, source/asset matching, packaged health/authentication boundaries and release replacement policy passed.
- Repository `node tests/run.mjs` passed.

Fixed the obsolete frontend assertion that required the previous background-refresh implementation. The current service worker waits for fresh online assets and falls back to the saved working asset on temporary failure; the behavior suite verifies this. Subsequent runtime fixes: timeline exports now time out if the encoder fails to stop, reject encoder errors and premature stops, unlock controls on failure, and warn when the browser captures no audio. Four executable timeline regression cases cover success, timeout, error and premature stop. Offline cache version advanced for the changed asset.

Unverified and blocked:
- The live request to https://mediaeditor.heavenlykey.org/ returned an Envoy 503 with an upstream connection failure from this execution environment. This is not proof that the origin itself is unavailable.
- Account 9 is saved connection ID 8. Worker deployment metadata could not be read: Control Room returned “No active maintenance permission for this agent and account”. No permission-request tool is exposed in this connection.
- Real browser audio/video export and mobile compatibility could not run: Chromium is absent and its download returned invalid/truncated archives.
- Real Cloudflare authentication, media storage, AI transcription/provider configuration and owner/admin sign-in remain unverified.

No deployment was attempted and no production database, bucket, binding, credential or owner record was changed. The existing Worker remains `heavenlykey-studio`. The historical staging notes below describe earlier checks and may not describe the latest implementation.

---

# Account 9 release status — 23 October 2026

**Engineering disposition: staging candidate, NOT production release.**

## Independently verified in this package
- 53/53 backend local integration checks, using Node's SQLite and mocked R2/AI; includes registration, sessions, role restrictions, projects, protected media, quota reservation and rollback, and API transcription contract.
- API/preflight JS syntax and expected Cloudflare binding labels.
- Chromium static-page rendering (navigation/editor controls) and no JavaScript page errors in that static check; this does not test actual browser-to-Cloudflare API calls.
- ZIP package integrity.

## Security and operations changes
- Cross-origin write rejection and request header guard.
- PBKDF2-SHA256 salted hash login; random secure sessions in HttpOnly cookie.
- Separate Owner and Admin roles with no self-service promotion.
- Private SQL-generation provisioning script that requires separate emails and distinct strong passwords, with no stored passwords in source.
- Atomic D1 quota reservation and release on failed upload, plus one-time storage usage migration.
- Improved WebM export error cleanup and safe reset of controls.

## Before a real Cloudflare staging deployment
1. Verify intended Account 9 D1 database ID and R2 bucket name; DO NOT assume the bundled identifiers belong to the desired Cloudflare account.
2. Apply `schema.sql` only to a new empty database; on an existing database apply the ONE-TIME migrations `0001_user_roles.sql` then `0002_storage_usage.sql` after a backup. The migrations are NOT idempotent.
3. Configure Pages project `heavenlykey-studio`, binding `DB` to its D1 database, `MEDIA` to private R2, `AI` to Workers AI. Confirm all resources are in the correct account.
4. Run `npm run check` from the account9 source root, then GitHub Actions manual Account 9 staging workflow.
5. Provision Owner/Admin separately using `scripts/provision-roles.mjs` with transient environment variables and different 12+-character credentials; DO NOT reuse the previously shared password. Keep the generated SQL private, execute only with authorized D1 credentials, then delete securely.
6. Test in staging: login for both roles, creation and deletion of projects/media, 50 MB upload ceiling, concurrent uploads, AI captions with *real* Workers AI, recording and export in Chrome/Edge/Firefox, mobile Safari behavior, accessibility, security and privacy.
7. Add MFA, account recovery and monitoring before public launch.

## Known limitations
- Video output currently WebM only. MP4 encoding and full nonlinear multitrack video compositing are not implemented.
- Natural-language AI video editing, text-to-video and voice cloning are not implemented; the editing assistant uses local keyword commands.
- Automated captions use Workers AI Whisper; this has NOT been verified with a live Cloudflare binding.
- No actual Cloudflare deployment, production Account 9 Owner/Admin logins or real media export tests have been verified in this release.


---

# Verification update — 31 October 2026

Latest source-level work:
- Fixed a duplicate top-level declaration in `tests/be.mjs` that prevented the backend test module from compiling.
- Changed the external AI gateway daily attempt reservation to an atomic 30-call limit and aligned its regression fixture.
- Expanded `scripts/preflight.mjs` to syntax-check the backend and all test modules.
- Previous source commits also moved inline JavaScript/CSS to same-origin files, enforced strict no-inline CSP, and added those assets to offline caching.

Verification boundary:
- GitHub source files and commit history were inspected.
- Static source consistency and syntax-oriented checks were inspected at source level.
- **The complete `npm run check` was not executed for this latest state.**
- No current CI status was available for the latest commit.
- No Cloudflare deployment, real D1/R2/AI smoke test, or live mobile/browser test was performed in this review.
- Malware scanning remains absent and is a release blocker.

**Release decision: NOT launch-certified.** Do not publish a global launch claim until the blockers in `AUDIT.md` have been completed and recorded with evidence. No deployment was made.


## Password storage security update — 31 October 2026

- New user registration and Owner/Admin provisioning now use PBKDF2-HMAC-SHA-256 with 600,000 iterations.
- Existing databases receive `migrations/0005_password_hash_iterations.sql` after backup. Existing hashes are tagged with their legacy 100,000 iteration count and are transparently re-hashed with a fresh salt and 600,000 iterations after the next successful login.
- Account deletion and logout-all password confirmation verify using the account's recorded iteration count, preserving legacy account access until migration by login.
- Backend regression coverage was added for new-account hash strength and legacy-login upgrade. Preflight checks enforce schema, migration and provisioning consistency.
- These source-level changes have not yet been executed through the complete test suite or against live Cloudflare D1. Apply migration 0005 only to an existing pre-update database; do not apply it to a fresh database created from the updated `schema.sql`.


## Session lifetime hardening — 31 October 2026

- Added a 30-minute inactivity timeout and a fixed 30-day absolute maximum session lifetime.
- Session activity refreshes `last_seen_at` no more than once every five minutes, limiting D1 writes while retaining a sliding idle window. Idle and absolutely expired sessions are purged on the next successful login; a per-user last-seen index supports cleanup.
- New sessions store `last_seen_at`; `user()` rejects expired or idle sessions before returning an authenticated user.
- Added migration `0006_session_inactivity_timeout.sql` for existing databases and regression coverage for active, refreshed, idle-expired and legacy timestamp backfill behavior.
- This is committed source-level work only; the full suite and live D1 migration have not yet been executed. Back up existing D1 before applying migrations.
