# Heavenly Key Studio refinement — 19 October 2026

## Prepared project

`studio/` is an independently deployable copy of the complete Account 2 `media-engine/` source from `heavenlykeybible-source/onlinebible`, main tree `146ecd64321976344b08596beaf605e17e525ee0`. Its production Studio, effects and format modules and Studio styles were copied from `heavenly-key-website/` in that same snapshot. Account 1 remains untouched. Web management is now the home of this candidate; the source repository is not deleted or rewritten.

This is a tested source candidate, not a report of a live Cloudflare deployment. It still targets the existing `heavenlykey-media` Worker, D1, R2 and KV IDs. The control room remains `website-management` with its existing bindings. No production data or secrets were changed during preparation.

## Corrections

- Account 2 root previously redirected to `heavenlykey.org/pages/admin#studio`, a separately hosted website with its own login. Account 2 now serves its own Studio entry and owner session.
- Control room includes an owner-only Studio button. A Studio-created browser state and a 60-second opaque code connect the two services. Code redemption uses an authenticated server request and an atomic D1 DELETE RETURNING. Passwords and media/provider secrets never enter redirect links or browser storage.
- An intermediate control room page performs a same-origin authenticated request, accommodating its existing SameSite=Strict session cookie after cross-site navigation. The existing login and recovery mechanisms remain available.
- Studio uses an HttpOnly, Secure, host-only cookie backed by KV. Sessions expire after 12 hours. Studio logout deletes its session and clears capture through the existing client event. Control room logout does not revoke a Studio session already issued; it remains valid until Studio logout or expiry. Password/status changes invalidate unredeemed grants. Issued Studio sessions are independent for their bounded lifetime; KV revocation propagation is eventual.
- Direct Studio media preview, upload, start, heartbeat, return-live and stop calls now target Account 2's actual routes. Existing 60-second Account 1 API capabilities still work. Malformed signatures, missing/noninteger issue times, extra token segments, expired tokens and capabilities longer than five minutes are rejected.
- Browser mutations require a matching Origin. Sign-in and private API responses are not cached; referrers do not disclose callback codes. Unexpected server errors return a generic setup/retry message.
- Added private multipart media uploads with progress, pause and resume for the same file in the same tab, media previews, publish/unpublish and 24/7 playlist switches, plus LiveKit and encrypted RTMP destination setup. Upload resume references store media IDs, never credentials.
- Standalone social controls use Account 2's saved RTMP destinations. Prepare the platform event yourself and verify it there. Account 1's automatic social-provider authorization remains in Account 1; this standalone Studio does not copy OAuth credentials or falsely report provider-confirmed broadcasts.
- Added a simple locally drawn Heavenly Key placeholder badge. Replace `studio/public/assets/ministry/logo.svg` with an approved ministry asset when available; it is not claimed as the ministry's original logo.

## Included production controls

Original Studio controls include local camera/screen/media preview, programme scene transitions, landscape/portrait/square formats, microphone/media/screen/music mixing, noise controls, backgrounds, branding, scripture/ticker, local recordings, saved presets, interrupted-session recovery, standby media and social RTMP egress. Existing engine APIs, five historical migrations, scheduled cleanup and transport helpers are preserved. This does not certify every provider or device feature.

## Activation on the existing Workers

1. Confirm the live Account 2 DB schema already includes migrations 0001–0005. Do not replay these historical migrations or seed/reset anything. The copied historical migration 0003 includes an ALTER TABLE and is not safely repeatable outside Cloudflare's migration ledger.
2. Back up the control room database and apply ONLY `migrations/0003_studio_signin.sql` to its existing database. This new migration is additive and repeatable:
   `npx wrangler d1 execute website-management-db --remote --file migrations/0003_studio_signin.sql`
3. Set `STUDIO_URL` on the control room to the exact Studio HTTPS origin, initially the existing Account 2 Worker origin. Set `CONTROL_ROOM_URL` on the Studio Worker to the actual `website-management` HTTPS origin. Both values must be origins with no path, query or fragment.
4. Create a new random 32-byte-or-longer `STUDIO_SSO_SECRET` and set the identical value as a Worker secret on BOTH existing Workers. Use the dashboard secret fields or `wrangler secret put`; never commit the value. Keep SESSION_SECRET, VAULT_KEY, MEDIA_ENGINE_SHARED_SECRET and all existing LiveKit/provider keys unchanged. `keep_vars = true` preserves dashboard variables on both deployments.
5. Run `node tests/run.mjs` at repository root. In `studio/`, run `npm ci`, `npm test`, `npm run check`, `npm run preflight` and `npx wrangler deploy --dry-run`.
6. Deploy control room code to its existing Worker and Studio code from `studio/` to its existing Account 2 Worker. Use the correct Cloudflare account for each. Do not create replacement workers or resources.
7. Sign in to control room, press Studio, confirm the signed-in identity and preview a camera/microphone. Test Go live, heartbeat, reconnect, stop, private upload and public playlist playback against the ministry website. Confirm social delivery separately on each platform.

For `studio.heavenlykey.org`, attach that custom domain to the SAME existing Account 2 Worker, then change STUDIO_URL to `https://studio.heavenlykey.org`. Both routes continue using that Worker's current data; changing origins requires a fresh Studio login. Domain routing is not configured by this code.

## Validation and limits

- Existing control room regression suite passes.
- 13 new checks pass using real in-memory SQLite plus mock KV, object storage and transport calls. Coverage includes browser-bound handoff, replay, expiry, changed password version, owner/member separation, foreign origins, logout and the existing API capability's multipart-upload/publish/settings workflow.
- TypeScript compile and Account 2 preflight pass; frontend JavaScript parses.
- Browser executable download was unavailable in this environment, so no browser-rendering or camera/microphone acceptance test is claimed. External CDN dependencies (LiveKit and optional MediaPipe effects), platform policy, network quality, quota and LiveKit egress availability remain live dependencies.
- Live Worker bindings, actual secret values, DNS and end-to-end broadcast delivery have not been inspected or changed through a Cloudflare session in this task. Activation requires the configuration and deployment steps above.
