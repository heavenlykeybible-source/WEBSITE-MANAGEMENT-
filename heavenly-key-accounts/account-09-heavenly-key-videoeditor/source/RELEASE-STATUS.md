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
