# Account 7 — Heavenly Key Radio

Intended listener domain: `https://radio.heavenlykey.org/`.
Dedicated Worker name: `heavenlykeyradio`.
Broadcast source of truth: Account 2 — Heavenly Key Media & Broadcast Engine.

## Implemented on the isolated mainline recovery branch

- Restored the two approved radio artwork files missing from current `main`.
- Added static response headers including HSTS, nosniff, frame denial, Referrer-Policy, Permissions-Policy, COOP and CORP.
- Added a Content Security Policy with a SHA-256 hash for the existing inline bootstrap script, explicit resource allowlists, `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`.
- Added a dedicated Account 7 Cloudflare Worker edge proxy for the current Account 2 public API contract:
  - `GET /api/broadcast/programme?channel=radio`
  - `GET /api/broadcast/live`
  - `GET|HEAD /api/broadcast/media/:id/object`
  - `POST /api/media-engine/livekit/viewer-token`
- The proxy sends the exact Account 2 public integration marker, rejects unknown paths/methods and unexpected query parameters, rejects redirects, applies request timeouts, forwards only media range headers, strips cookies and CORS permissions, and does not expose Account 2 credentials.
- Added a dedicated `wrangler.toml` for Worker `heavenlykeyradio`, retaining saved Worker variables and avoiding Account 2 D1/R2/KV bindings.
- Added a static source/security preflight and a fail-closed live verification script. They have been authored but have **not yet been executed**.

## Required Cloudflare configuration

Set `MEDIA_PUBLIC_ORIGIN` as a non-secret Worker variable to the **verified HTTPS origin of the deployed Account 2 Worker**. The origin was not discoverable from the current repository configuration and must not be guessed. Confirm that Account 2 is deployed with its public broadcast routes and that the route contract matches this branch.

Preserve the existing `heavenlykeyradio` Worker, its saved bindings and secrets. Confirm the exact Cloudflare account, custom-domain route `radio.heavenlykey.org`, and asset deployment settings before release. No credentials belong in this repository.

## Remaining release blockers

1. Confirm the exact Account 2 HTTPS origin and set `MEDIA_PUBLIC_ORIGIN` in the existing Account 7 Cloudflare Worker.
2. Confirm the Cloudflare account/Worker identity, existing bindings, custom-domain route and production deployment configuration.
3. Run `node scripts/preflight.mjs` and resolve every failure.
4. Deploy only through the approved non-GitHub-Actions process, then run `node scripts/verify-live.mjs https://radio.heavenlykey.org`.
5. The listener currently does not implement browser LiveKit playback. The live verification script deliberately fails if Account 2 returns a LiveKit transport rather than falsely reporting successful playback.
6. Test real audio and reconnection on iPhone Safari, Android Chrome, desktop browsers, Bluetooth devices, background playback and low-bandwidth networks.
7. Verify accessibility, performance, monitoring, incident recovery and production security headers.

## Release safeguards

- Do not use GitHub Actions for deployment.
- Do not deploy this branch until the Account 2 origin and existing Cloudflare configuration are confirmed.
- Do not modify Account 2 production databases, storage, secrets or source as part of Account 7 recovery.
- Do not merge the old divergent Account 7 branch wholesale.
- Passing static preflight is not proof of live service or playback.
- Global launch approval remains **blocked** until all release gates above pass.
