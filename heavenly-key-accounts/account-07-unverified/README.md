# Account 7 — Heavenly Key Radio

Independent listener site at `radio.heavenlykey.org`. Account 2 is the broadcast source. Deploys directly through GitHub Actions to the existing Account 7 Worker `heavenlykeyradio`; Account 4 is not involved.

## Release fixes

- Original approved artwork included locally; original design preserved.
- Playlist playback, live audio using the existing LiveKit transport, track switching, stop/disconnect and reconnect handling.
- Same-origin server proxy authenticates to Account 2 without exposing the server key, cookies or private admin endpoints. Media byte-range responses are preserved.
- Account 2 filters live programmes by destination before choosing the latest programme, supports radio audio during reconnects, and accepts the radio server key for listener-only LiveKit tokens.
- GitHub Actions runs tests, checks existing Account 7 Worker access and preserves saved variables/secrets, deploys the radio, then verifies assets and authenticated programme/media responses.

## Required production configuration

GitHub Actions repository secrets:

- `CLOUDFLARE_RADIO_API_TOKEN`: valid token with Workers Scripts Edit on Account 7.
- `CLOUDFLARE_RADIO_ACCOUNT_ID`: Account 7 account ID.

Account 7 Worker bindings:

- `MEDIA_PUBLIC_ORIGIN`: actual, verified HTTPS origin of Account 2 Media Engine.
- `RADIO_PUBLIC_API_KEY`: secret shared with Account 2's `RADIO_PUBLIC_API_KEY`; never place it in HTML or JavaScript assets.

Account 2 must run the compatible code from `account-02-studio-radio-tv-media/source`, retaining its existing DB, R2, KV and all secrets. No migration or reset is required for these fixes. Live studio audio additionally requires the existing LiveKit configuration and an active radio/both programme. No external ads have been added.

## Verified limits, 23 October 2026

Local repository tests, dedicated Account 7 player/proxy tests, actual SQLite Account 2 selection/fallback tests, and Account 2 TypeScript check passed.

The previous production Actions run `39980857302` failed at the Cloudflare Pages API with authentication error 10000. The token is valid for Workers: a read-only API probe confirmed HTTP 200 for Workers and HTTP 403 for Pages. The correct existing deployment target is Worker `heavenlykeyradio`, initially serving Hello World with no bindings. The workflow now deploys to that Worker, not Pages. Its public URL is `https://heavenlykeyradio.heavenlykeyradio.workers.dev/`. The public radio domain returned HTTP 522. The documented Account 2 URL `https://heavenlykey-media.omegawealthcreator.workers.dev/` did not return a healthy Media Engine during this audit; it must not be assumed to be the current working origin.

Production audio, custom-domain routing and real phone listening are not verified. A passing local test is not a live broadcast confirmation.

## Commands

From the repository root:

```
node tests/run.mjs
node --experimental-vm-modules tests/account7-radio.mjs
node --experimental-strip-types tests/account2-radio.mjs
```

Run **Deploy Account 7 Heavenly Key Radio**. Deployment source is `prepare/account-07-radio-20261023`. Fix the credentials/origin if preflight stops; do not substitute Account 4 or another account's token.

The Worker initially has no broadcast bindings. If they remain missing, the deployment summary explicitly says AUDIO NOT ACTIVE; a green code deployment does not confirm live audio. `ACCOUNT_2_TOKEN` is absent from this repository, so source-side activation cannot be performed with that credential here.
