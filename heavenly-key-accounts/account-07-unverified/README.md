# Account 7 — Heavenly Key Radio

Intended listener domain: `https://radio.heavenlykey.org/`.
Dedicated Worker name: `heavenlykeyradio`.
Broadcast source of truth: Account 2 — Heavenly Key Media & Broadcast Engine.

## Implemented on this fresh-mainline hardening branch

- Added a dedicated Account 7 Cloudflare Worker edge proxy for the verified Account 2 public API route contract:
  - `GET /api/broadcast/programme?channel=radio`
  - `GET /api/broadcast/live`
  - `GET|HEAD /api/broadcast/media/:id/object`
  - `POST /api/media-engine/livekit/viewer-token`
- Proxy route and method allowlists; strict query validation; HTTPS-only upstream origin validation; redirect rejection; 20-second timeout; media range forwarding only; cookie/CORS response-header stripping; defensive API response headers.
- Added static security headers and CSP with a SHA-256 hash for the existing inline bootstrap.
- Added a dedicated Wrangler configuration for Worker `heavenlykeyradio`; no Account 2 database/storage bindings or credentials.
- Added static preflight and fail-closed live verification scripts. They have not yet been executed.

## Important known gaps

- The two approved radio artwork files referenced by the earlier recovery branch are still absent from current `main`; they have not been copied into this fresh branch. Restore them from the approved source before release.
- The listener does not implement browser LiveKit playback. The live verification script deliberately fails when the programme uses LiveKit.
- Account 2's exact deployed HTTPS origin and the existing Cloudflare Worker/domain configuration are not verified. Do not guess either value.

## Required release gates

1. Confirm the exact Account 2 HTTPS origin and configure `MEDIA_PUBLIC_ORIGIN` in the existing Account 7 Worker.
2. Confirm the Cloudflare account, Worker identity, saved bindings/secrets, custom domain and production asset configuration.
3. Restore and verify the original approved artwork.
4. Run `node scripts/preflight.mjs` and fix every failure; confirm `.assetsignore` excludes private deployment files.
5. Deploy only through the approved non-GitHub-Actions process; then run `node scripts/verify-live.mjs https://radio.heavenlykey.org`.
6. Implement and verify real browser LiveKit playback if Account 2 publishes LiveKit transport.
7. Test iPhone Safari, Android Chrome, desktop browsers, Bluetooth, background audio, reconnects and low-bandwidth behavior.
8. Complete accessibility, performance, monitoring, recovery and production security checks.

## Safeguards

- Do not use GitHub Actions for deployment.
- Do not deploy until the upstream origin and existing Cloudflare configuration are confirmed.
- Do not modify Account 2 production databases, storage, secrets or source.
- Do not merge the old divergent Account 7 branch wholesale.
- Static checks are not proof of live availability or successful playback.
- Global launch approval remains **blocked** until every release gate passes.
