# Homepage composition — 21 October 2026

This change continues the existing application and approved guest welcome. It does not deploy to Cloudflare.

## Layout and behavior

- Added `public/approved-dashboard.css` as the last homepage stylesheet. It targets the real brand, composer, ACTIVE, feed filters and navigation elements, resolving older styles that target obsolete component names.
- Added `public/approved-dashboard.js` after existing dashboard initialization. It preserves the original feed, composer, authenticated ACTIVE and notification handlers. The new Create post button opens the existing editor.
- Wide desktop uses a navy rail, central feed and two columns of supporting cards. Medium desktop uses one supporting column; tablet and phone layouts collapse the columns and retain the existing mobile navigation.
- The blue header contains the real brand, existing believer search, functional Bible/Prayer/Groups/Spaces/Messages shortcuts and existing account controls.
- Space suggestions come from `/api/spaces`, with validated identifiers, text-only rendering, existing slug routes, bounded requests and honest loading/empty/failure states. Requests are cancelled on session changes; obsolete responses cannot update the next view.
- Added ministry broadcast and community invitation treatment without inventing live badges, viewer counts, online presence, upcoming events or trending statistics. The existing approved banner and guest registration/sign-in links remain unchanged.

## Integration fixes

`public/official-community-feed.js` contained a second legacy ACTIVE rail, derived from feed posts with a localStorage-only automatic-add preference. Removed that duplicate while preserving official publication loading. `active-strip.js` and the existing `/api/active` backend now exclusively own ACTIVE and its preferences.

`public/community-app-promo.js` now reads the application's view-ready session event instead of making an independent session request that could apply stale guest/member classes. Its cleanup no longer removes the navigation mission card.

`public/index.html` loads both new files and advances cache versions for changed scripts. `package.json` includes the new script in syntax checks and the dashboard tests in `test:home`.

## Verification

- `npm run check`: passed.
- `npm run frontend`: passed, including the new dashboard script.
- Homepage tests: 11 passed across guest/member welcome and dashboard integration.
- Existing feed, Design Cards, ACTIVE, registration, Groups/messaging, Spaces, social-auth/adverts and stewardship checks: 27 passed.
- Total relevant tests: 38 passed. These use DOM fixtures and disposable database data; they are not browser screenshot tests.

The managed environment has no supported control-browser connection. Browser rendering, mobile screenshots and an authenticated live login flow were not verified. No claim of exact pixel equivalence to the reference is made. The prior Community Care/module and local API-audit runtime blockers remain unresolved. No staging or production deployment occurred.
