# Account 7 — Heavenly Key Radio (recovery status)

Public listener domain intended: `https://radio.heavenlykey.org/`.

## Current verified repository state

The current `main` branch contains the approved radio page shell, player JavaScript, styling and ministry footer. The page references two approved radio artwork files that were missing from the current `main` branch; those exact approved assets have now been restored on the isolated branch `hardening/account7-mainline-security-20261031`.

A static-host `source/_headers` file has also been added on that branch with HSTS, MIME-sniffing protection, frame denial, referrer and permissions policies, and cross-origin isolation/resource headers.

## Not yet a deployable release

The current `main` branch does **not** contain a verified Account 7 Worker entry point or Wrangler configuration. The Account 7 manifest still records the application as unidentified/unverified. The historical Worker and deployment files are not copied automatically because they must first be reconciled with the current Account 2 broadcast engine and its authentication contract.

The current Account 2 source exposes public broadcast routes through the `X-Heavenly-Key-Internal: media-engine-public-v1` marker. The historical Account 7 proxy must be checked and aligned with this exact contract before restoring it. Do not assume that a successful static asset deployment means the broadcast connection works.

## Release blockers

1. Reconcile and restore the Account 7 Worker/proxy against the current Account 2 source; preserve Account 2 DB, R2, KV and secrets.
2. Add a current Wrangler Worker configuration and verify the existing `heavenlykeyradio` Worker bindings without deleting saved values.
3. Verify the real Account 2 HTTPS origin and required secrets in Cloudflare; do not put secrets in browser assets or Git.
4. Verify custom-domain routing and all static asset responses.
5. Run repository tests, radio proxy tests and Account 2 type checks; record actual results.
6. Test real audio, LiveKit, reconnection, background playback, Bluetooth and iOS/Android/desktop browsers.

## Security and deployment policy

- Keep all secrets and production databases outside source control.
- Do not deploy this recovery branch yet.
- Do not use GitHub Actions for deployment.
- Do not overwrite the latest Account 2 source or any production Cloudflare bindings.
- A passing source-level check is not proof of live broadcast availability.
- Global launch approval remains blocked until every release gate above is verified.
