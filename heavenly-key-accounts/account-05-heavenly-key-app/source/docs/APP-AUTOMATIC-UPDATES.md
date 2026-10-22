# Heavenly Key App: safe automatic updates and published website sync

## What is included

App account: `aoemeta247-cell/heavenly-key-mobile-app`. The app reads public content from the existing Heavenly Key ministry website **without copying credentials or databases** into App Account 5.

- `GET /api/site-sync` is a **read-only app-owned gateway** to fixed, reviewed website routes:
  `https://heavenlykey.alldaywow247.workers.dev/api/site-content/homepage` and `/api/events`.
- App Home updates the published ministry mission, GRDPC labels/times and upcoming scheduled events after opening, reconnecting or returning to the app. It also has a manual refresh button, and a light periodic foreground refresh.
- The gateway sends **no browser cookies, Authorization headers or private input** upstream. It rejects unknown methods and query strings, limits upstream JSON to 96 KiB and 6.5 seconds per source, blocks redirects, and responds with only selected text fields. The client renders via `textContent`; it never inserts remote HTML.
- If the ministry endpoint is offline or one part fails, it displays an honest unavailable/partial state, not fabricated content.
- `SITE_PUBLIC_SYNC_ENABLED = "true"` only enables public site content. The separate Account 3 Community public/member switches remain disabled pending staging verification.
- No automatic actions on behalf of community members, no messages/prayer requests sync, no credentials, no background audio/media downloads.

## Updating the installed app

The deployment build invokes `scripts/stamp-release.mjs`, which stamps `public/sw.js` with its Git commit SHA. This makes new deployed app code detectable by the service-worker update algorithm. Production build should run `npm run build` before `wrangler deploy`. The `npm run deploy` command performs both operations.

When a user opens or returns to the app (or regains connectivity), the app checks for a new service worker, limiting explicit checks to once every 30 minutes while visible/online. When an update is installed and waiting, the app offers **Update app**; it does not silently reload an active session or interrupt playback. A user must choose the reload. The offline study pages no longer auto-activate new service workers behind the user's back.

Installed progressive web apps served by Cloudflare can receive these site and app asset updates without reinstalling. A distinct native App Store/Play Store binary update still follows the respective store's policies.

## Offline safety

A new, versioned app-shell cache is installed before replacing the prior shell. The service worker caches only reviewed public app assets; it does **not** intercept user API routes. Existing KJV, approved audio, notebook storage and offline study-progress keys retain their own storage and are not removed by app shell cleanup. Browser storage clearance, device loss and quota eviction can still remove locally saved information; encrypted notebook backup remains recommended.

## Deployment and verification

- `npm run build` — stamps release and performs existing app dependency/offline-preservation checks.
- `npm test` — runs all tests, including public content filtering, no cookies, offline preservation, blocked methods, source failures and update behaviour.
- `npx wrangler deploy --dry-run` — verifies the Worker bundle *without publishing*.
- Staging: update a website programme via its existing admin editor, then reopen the app; verify the changed text appears without an app deployment.
- Install on Android/iOS and test new app-code notification, opt-in reload, offline retained books/notes, network loss/recovery and active playback.
- Verify Cloudflare actual build/deployment; GitHub Actions and Cloudflare build failures observed on 12 October 2026 have not been independently resolved here.

**Not included:** automatic syncing of arbitrary page markup/website CSS, private member actions, push notifications, or native store binary changes. These require their own reviewed integrations.
