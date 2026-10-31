# Account 7 — Heavenly Key Radio

Independent listener site intended for `radio.heavenlykey.org`. Account 2 is the broadcast source. The production deployment branch remains `prepare/account-07-radio-20261023`; this hardening branch is isolated and is not deployed.

## Completed source hardening

- Original approved artwork included locally; original design preserved.
- Playlist playback, live audio using the existing LiveKit transport, track switching, stop/disconnect and reconnect handling.
- Same-origin server proxy authenticates to Account 2 without exposing the server key, cookies or private admin endpoints. Media byte-range responses are preserved.
- Account 2 filters live programmes by destination before choosing the latest programme, supports radio audio during reconnects, and accepts the radio server key for listener-only LiveKit tokens.
- Static assets include a restrictive Content Security Policy, HSTS, clickjacking protection, MIME sniffing protection, referrer policy and least-privilege Permissions Policy. The one inline shell bootstrap is authorized by its exact SHA-256 CSP hash; arbitrary inline scripts are not enabled.
- Radio API proxy applies no-store, nosniff, frame denial, no-referrer, HSTS and a non-executable CSP to API success/error responses, while stripping upstream cookies, CORS and server-disclosure headers.
- LiveKit pause disconnects the viewer room so a paused listener does not keep receiving an inaudible live stream; resume requests a fresh viewer connection.
- Regression coverage includes radio proxy restrictions, byte-range forwarding, pause/resume/stop, CSP hash, and security headers.

## Test evidence

A GitHub Actions verification run completed successfully on commit `c3578f1439f889ad494a4224be6e8bf71539a80c`, including dependency installation, repository regression suite, Account 7 player/proxy regressions, Account 2 integration regressions and CSP/security-header tests. Both the temporary verification workflow and the Account 7 production deployment workflow have been removed from this branch to respect the owner's preference not to use GitHub Actions for this project. The source code and tests remain in this branch. Re-run the commands below in the owner's chosen build/deployment environment before release.

```sh
node tests/run.mjs
node --experimental-vm-modules tests/account7-radio.mjs
node --experimental-strip-types tests/account2-radio.mjs
node tests/account7-security-headers.mjs
```

## Production blockers — not launch certified

- The public radio domain and Worker endpoints could not be verified from this audit; prior repository evidence records HTTP 522 for the custom domain and an unhealthy/unverified Account 2 media origin. Recheck from the live Cloudflare environment.
- Verify Cloudflare account identity and deployment ownership. The radio Worker namespace is documented as `heavenlykeyradio.workers.dev` and the preflight script labels its physical Cloudflare target "Account 8", while this project is named Account 7. Do not deploy until the owner confirms the exact Cloudflare account ID and namespace.
- Confirm existing Worker bindings `MEDIA_PUBLIC_ORIGIN` and `RADIO_PUBLIC_API_KEY` without printing secret values. The origin must be the verified HTTPS Account 2 media endpoint and the key must match the server-side Account 2 configuration.
- Verify custom-domain DNS/routing and HTTPS.
- Test a real broadcast, reconnection, and lock-screen/Bluetooth/background playback on iOS, Android and desktop browsers. Media Session controls are not uniformly supported by all browsers.
- Complete independent security and accessibility review, including WCAG 2.2 keyboard, focus, contrast and screen-reader checks.

## Protected production resources

Preserve the existing D1 database, R2 bucket, Worker secrets, `VAULT_KEY`, `SESSION_SECRET`, owner identity and all existing bindings. Do not reset or recreate production resources. Keep API credentials server-side only. No deployment has been made from this branch.

## Release commands

Run the four test commands above. Then use the owner's selected deployment process only after account identity, bindings, origin, DNS and real-device audio are verified. Do not use GitHub Actions for deployment or verification unless the owner explicitly changes this preference.
