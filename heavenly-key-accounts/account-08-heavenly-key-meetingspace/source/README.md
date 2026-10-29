# Account 8 — Heavenly Key MeetingSpace

[Account 8 directory entry](../README.md) · [Official account registry](../../../HEAVENLY-KEY-ACCOUNT-REGISTRY.md)

This is the complete current Account 8 MeetingSpace source. The full source has moved into the Account 8 folder alongside the other account applications. The audited Zoom Studio upload lives here as an independent project. It does not replace the existing Control Room or the separate `studio/` work on other branches.

The responsive blue, white and gold template includes the supplied ministry banner, feature guidance, main-website return link, meetings, groups and owner/admin user management. 24/7 Radio is on hold.

Run `npm test` in this directory (Node 22+). The existing repository also requires `node tests/run.mjs` from its root. Browser/device/network testing is separate; see AUDIT-UPDATE.md.

## Cloudflare deployment — Account 8 only

**Account 7 is Heavenly Key Radio; Account 8 is Heavenly Key MeetingSpace; Account 9 is VideoEditor.** Historical references to an Account 7 Zoom Studio release are legacy information and MUST NOT be used to target a new MeetingSpace deployment.

MeetingSpace's dedicated Cloudflare Worker is `heavenly-key-meetingspace`; its D1 database name is `heavenly-key-meetingspace-db`. Account 8 can share the same Cloudflare tenant as Account 7 only when the operator explicitly enables MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT=1. The Worker name, D1 database and credentials must remain isolated. Do not reuse the existing Radio, Studio or Control Room database. Current hardening work lives on branch `feature/account8-meetingspace-hardening-20261025` until reviewed/merged.

1. Confirm the actual Account 8 Cloudflare account ID and dedicated existing or new D1 database ID. If reusing data, back it up and inspect schema/migrations before any write.
2. Set `MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID`, `STUDIO_D1_DATABASE_ID`, `MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED=1` and the **verified** `MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN` in the trusted deployment environment. If Account 8 shares Account 7's Cloudflare tenant, explicitly set `MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT=1` and verify the D1 ID refers only to MeetingSpace. The original Cloudflare credentials must agree with the dedicated Account 8 identity. Never commit credentials or owner passwords.
3. From `heavenly-key-accounts/account-08-heavenly-key-meetingspace/source/`, run `npm test` (Node 22+), then `npm run configure`. Generated Wrangler config rejects Account 7 as the project target, conflicting Cloudflare account identifiers and reuse of known shared production D1 databases. Examine D1 and Worker bindings and any required migrations before running `npm run deploy`.
4. Preserve account secrets, particularly `AUTH_SECRET`, and configure the actual room signalling service (Durable Object or verified relay and `RELAY_SECRET`) before promising live guest meetings. A Worker website alone does **not** supply a media relay or a global TURN service.
5. Verify `/api/health` at the exact Account 8 release origin, then perform mobile/desktop camera, microphone, screen sharing, guest access, group invitation, follow-up, reconnection and moderation tests. Browser compatibility and free-tier Cloudflare consumption need real measurement before public launch.

The read-only group invitation preview is implemented; membership requires explicit confirmation in the interface. Follow-up reminders and advanced automated meeting-to-group features remain future work; see `ACCOUNT8-FREE-TIER-DESIGN.md`.

CI: `.github/workflows/account8-meetingspace-tests.yml` runs the Node tests for changes to `heavenly-key-accounts/account-08-heavenly-key-meetingspace/source/`. It does not deploy. Any historical manual deploy workflow must be independently audited for Account 7 environment variables before use. Do **not** assume a green workflow means real devices or production infrastructure were tested.

Only `site/` is public. Never serve test fixtures, server scripts or secrets as static assets.

## Deployment through the Control Room

Run `npm run bundle:control-room` to generate `build/meeting-worker.mjs`. The bundle embeds all 19 public files as compressed assets; backend source and private setup scripts are excluded from public routes. The dedicated database schema is additive and idempotent, initialized on first API use. Existing records and identities are never overwritten. The generated package is approximately 1.24 MB and fits the Control Room's bounded 1.4 MB code limit.

Historical Account 7 deployment (NOT the Account 8 release target): the owner selected database `heavenlykey-db` (`9549fc74-f6a8-4cf8-a066-7cb965c59b91`) and bucket `heavenlymedia`. Submit the bundle as Worker `heavenly-key-zoom-studio`, with bindings `d1/TEAMDB` to that database ID, `r2_bucket/FILES` to `heavenlymedia`, `ai/AI`, `generated_secret/AUTH_SECRET`, and `durable_object_namespace/MEETING_ROOMS` with local class `MeetingRooms`. Declare `exports.MeetingRooms={type:'durable-object',storage:'sqlite'}` in upload metadata. The installer supplies these automatically.

The deployment creates a missing AUTH_SECRET privately and stores an encrypted copy in the Control Room. Subsequent deployments inherit the existing secret. Preserve the Control Room vault and database. The new Worker receives its workers.dev address; existing Workers keep their public-access settings.

For the historical Account 7 Worker only, the entry path was **Cloudflare → Account 7 → Workers → Open meeting app as owner**. Account 8's dedicated Worker requires its own verified owner-launch routing. The Control Room owner receives a signed, single-use, 60-second launch ticket through a POST, never in the URL. The app initializes its reserved owner identity only when absent and refuses to override a conflicting account. A fresh Control Room launch also offers a ten-minute, single-use password recovery ticket for this reserved owner only. Under Account, the owner may set a password privately; entering the app never changes a password automatically. The owner can create the reserved admin login with the Admin role in user management. Private command-line provisioning is also described in ACCOUNT-SETUP.md.

This bundle also supplies native guest rooms through a SQLite Durable Object with WebSocket hibernation. Each room has a separate instance, signed host access, guest admission and bounded audience/chat controls. Hibernation attachments retain state across idle wakeups; leaving ends the room. Media travels directly between browsers using WebRTC and Cloudflare STUN. Restrictive networks may need a separately configured TURN service. `/api/health` reports `meetingConfigured` separately from `relayConfigured`. RTMP streaming to platforms still requires the running Node/FFmpeg relay and matching `RELAY_URL`/`RELAY_SECRET`; this update does not claim to provide that service. Existing databases, buckets, secrets and Durable Object namespaces are inherited on future updates.

## Browser and feature audit

Run `npm ci`, then `npx playwright install chromium` and `npm run test:browser` from this source directory. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium binary.

The audit serves the actual bundled application, uses disposable SQLite data, and exercises its real meeting signalling class through a local WebSocket adapter. Browser cameras and microphones are synthetic. Screen-track replacement uses a test capture track; it does not verify an operating-system screen picker. No production users, payments or social accounts are involved.

The release workflow requires both backend checks and this browser audit before its deployment job. Browser screenshots are saved as workflow artifacts; no automatic production deployment is enabled.
