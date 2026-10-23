# Heavenly Key: Community and Discipleship integration draft

## Source audit — 12 October 2026, Nigeria time

Account verified through GitHub connector: `aoemeta247-cell` / `aoemeta247@gmail.com`. App repository: `heavenly-key-mobile-app`; audited main commit: `dba9dcb1c1a99dd5e26837d266728aad1cd5dc68`. Community source: `aoemeta247-cell/All-Nations-For-Christ-Outreach/global-community`.

The existing app is a mobile web/PWA starter, not a finished native Android/iOS application. It contains public static views, three KJV passages, service links, an offline shell and a health endpoint. That baseline did not implement native biometrics, account sign-in, private messaging, full Bible/audio, or synced discipleship progress. The draft now contains a disabled member gateway and learning interface; neither has been verified against live services.

The Community already defines public `/api/feed` and `/api/discipleship/tracks` routes. Its sign-in uses `gc_session`, an HttpOnly, Secure, SameSite=Lax cookie, and its writes reject cross-origin actions. Adding cross-origin browser login without an approved identity design would not deliver a safe unified account. Source configuration uses `https://global.heavenlykey.org`, but this review does not verify production DNS, deployment, migrations or API availability. Existing app links to the ministry Worker were preserved as navigation fallbacks; those hostnames do not change which GitHub account was used.

## Implemented in this draft

- Primary navigation: Home, Community, Grow, Profile. Existing `#bible` and `#live` links remain supported.
- Dedicated Prayer, Messages and Groups & Spaces screens, with honest availability labels and existing website fallbacks.
- Community and Grow receive equal primary navigation placement. Three Scripture readings remain offline-capable.
- Optional public text connections: `/api/community/feed` and `/api/community/tracks`. No background polling, autoplay or media downloads.
- Both integration switches remain off: `COMMUNITY_PUBLIC_READS_ENABLED = "false"` and `COMMUNITY_MEMBER_ACCESS_ENABLED = "false"`. Enable only after canonical Account 3 endpoints, trust boundaries, rate limiting and approved Community safety changes pass staging verification.
- Public gateway: fixed origin and read-only route allowlist; no incoming credentials or cookies forwarded. Bounded text summaries only, 256 KiB upstream response limit, 7-second timeout, 20 entries maximum.
- Member gateway: fixed origin and strict route/method allowlist. App requests use a host-only `__Host-hk_session` cookie (HttpOnly, Secure, SameSite=Strict). The opaque Account 3 session is translated to `gc_session` only on reviewed upstream member operations. Account 3 issues and validates sessions and saves progress. Cookie values never enter browser JavaScript or storage. Login credentials are forwarded transiently over HTTPS and are not logged or persisted.
- Member writes require the app Origin and reject cross-site/same-site subdomain requests. Request bodies are capped at 8 KiB; upstream responses at 1 MiB (session verification at 256 KiB); request timeout 8 seconds. Arbitrary client headers, redirects, role/user ID input and upstream cookie attributes are not forwarded. Profile responses expose only display name and account status.
- The UI checks connection availability on user action before showing a password form. Lessons load on demand, render as text, and save only confirmed completion. Private lesson/reflection content is memory-only and cleared on logout, expired/restricted sessions and cached-page restoration. Delayed requests cannot restore data after sign-out. No API responses enter the service-worker cache.
- Video entries and embedded video links are omitted; there is no app video upload/posting action. Account 3 remains responsible for enforcing posting policy server-side.
- No Account 3 database, session store, passwords or service secrets are duplicated in Account 5. The app cookie references the existing Account 3 session; it is not a second identity system. Website cookies and app cookies are on different origins, so automatic browser single sign-on is not claimed.

## Remaining integration and release work

1. Verify Account 3 production origin, health, public routes, privacy behavior and video restriction against the approved Community changes. Keep other draft Community PRs independent; this draft does not merge them.
2. Review and stage-test the implemented same-origin member gateway against Account 3 login/logout, revoked sessions and restricted accounts. Confirm trusted proxy behavior, credential abuse protection, cookie handling and Account 3 authorization. Social sign-in and passkeys are outside this stage. No production activation before this review.
3. Integrate authenticated feed actions, membership, messaging and prayer submissions. Profile and lesson progress have gated draft implementations; messages, prayer and membership continue to use website fallbacks. Enforce role/ownership checks and retry safety upstream.
4. Connect approved live/audio resources and the full Bible. Public tracks remain summaries; the gated member endpoint includes lesson reading and completion using existing Account 3 content. Verify active/published lesson access and completion authorization against production data.
5. Test Android and iPhone installation, navigation, slow networks, offline transitions, battery/data usage, accessibility, private/public content separation and session expiry. Assess native packaging separately if Play Store/App Store distribution is required.
6. Implement and test passkeys/biometrics only where supported by the approved identity design. Do not claim Face ID/fingerprint readiness from this shell.
7. Resolve remote build/check failures and complete staging and real-device audits before the owner approves production release. This work remains draft and unmerged. No manual deployment has been initiated.

## Validation

Baseline: 11 existing checks passed before editing. Current build and all 34 Node tests pass locally. They cover the existing shell, navigation, public isolation, member availability gates, credential/cookie isolation, Origin checks, expiry/restriction, confirmed completion, safe text rendering, logout and delayed-response privacy. These use simulated Account 3 responses and DOM objects; they do not establish live integration or device readiness.

Remote GitHub Actions run `38183420663` failed before any recorded job step. Job logs are unavailable and the failure annotation is not exposed by the connector, so the cause remains unconfirmed. Cloudflare automatic build `ec3f163b-679d-4b89-8766-23673e09948a` also failed. No successful release has been verified. Keep these checks distinct from local test success.

Browser automation was attempted but could not run because Chromium is not installed in this workspace. Visual layout, Cloudflare deployment, live upstream APIs, real-device performance, native capabilities and biometrics are therefore unverified. There are no new database migrations or dependencies.

## Gateway rate-limit verification required

Account 3 currently limits login attempts per email and by a hash of `CF-Connecting-IP`. Cloudflare documents that cross-zone Worker subrequests can carry a shared Worker client IP (see https://developers.cloudflare.com/fundamentals/reference/http-headers/). Inference: if Account 5 requests follow that path, unrelated app members could share the same upstream source limiter. Confirm the actual zone/subrequest topology in staging. If needed, add a cryptographically authenticated gateway source identity plus per-client abuse controls; never trust a raw client-supplied forwarding header or remove Account 3 limits. No shared secret is introduced by this draft.

## Member route mapping

| App route | Method | Authoritative Account 3 route |
|---|---|---|
| `/api/member/config` | GET | Local availability flag only |
| `/api/member/login` | POST | `/api/auth/login` |
| `/api/member/logout` | POST | `/api/auth/logout` |
| `/api/member/session` | GET | `/api/me` |
| `/api/member/tracks` | GET | `/api/me` validation, then `/api/discipleship/tracks` |
| `/api/member/lessons/:id/complete` | POST | `/api/discipleship/lessons/:id/complete` |

No registration, social-auth callback, administrator, media upload or arbitrary proxy route is exposed by the member gateway.
