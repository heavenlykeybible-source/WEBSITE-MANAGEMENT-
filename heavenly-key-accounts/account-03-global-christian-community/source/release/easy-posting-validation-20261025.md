# Account 3 — simplified posting validation

Date: 25 October 2026
Branch: feature/account3-social-network-easy-posting-20261025
Canonical source: heavenly-key-accounts/account-03-global-christian-community/source/
Review: https://github.com/heavenlykeybible-source/WEBSITE-MANAGEMENT-/pull/17

## Implemented

- Write directly on a coloured Design Card, tap a colour, publish. No title or category is required.
- Stable editor nodes preserve typing, cursor selection, multiline text and colour choices. Autosaved drafts restore after reload; discarding removes the saved copy. Publication failure preserves writing.
- Existing titles, Scripture and exact designs load when editing. Optional titles and post-type selection remain accessible in collapsed More options. Articles, video links, Premium Text and advanced designs remain available.
- Category changes do not reset colour. Inactive video fields cannot prevent publishing another format. Draft tools are collapsed; the primary Publish action stays visible in the scrolling dialog and retains its colour despite older stylesheet overrides.
- Corrected the runtime header's split-text old brand to Global Christian Social Network. On phones it wraps cleanly, and the duplicate side navigation is hidden on secondary views; all destinations remain in the bottom navigation and More menu.
- Fixed the missing POST /api/auth/logout route. It uses the existing durable session revocation and cookie-clearing helpers. Cross-origin logout is rejected, old cookies lose access, and sign-out failures leave a retryable button rather than an unhandled exception.
- Public advertising remains disabled at both the public route and service layers. Historic advert records and protected administration remain intact.

## Executed checks

- npm run build: passed, including 70 automated tests, TypeScript, frontend syntax, preflight and actual Worker compilation.
- npm run test:care: passed.
- Root node tests/run.mjs: passed.
- npm run test:browser: passed 12 end-to-end checks plus the uncaught-error check against the actual application, disposable local D1/KV/R2 and headless Chromium 138. No backend responses were mocked. External media/provider requests were blocked, so external playback/provider functionality is not certified by this run.
- Browser coverage: registration; direct input/focus/selection; colour changes; dialog/editor sizing and visible primary Publish at 320, 390, 768 and 1440 px; draft reload/restore/discard; title-free/category-free POST; saved-theme PATCH; Groups, Spaces, inbox and profile views; actual sign-out followed by email sign-in and return to Messages. No uncaught browser exceptions occurred.
- Desktop and narrow-screen composer screenshots, plus secondary-view screenshots, were inspected. This is desktop Chromium with resized viewports, not a real iPhone/Safari certification.
- Earlier disposable local Worker API audit passed. The added Worker/SQLite regression test now also verifies the logout route, cross-origin rejection, cookie clearing and rejection of old session cookies.

Browser QA is opt-in: npm ci, npx playwright install chromium, npm run test:browser. QA_OUTPUT can preserve screenshots and results outside the disposable database directory. CHROMIUM_EXECUTABLE_PATH and CHROMIUM_ARGS support an existing local browser. This container required a temporary, uncommitted loopback fallback for its denied os.networkInterfaces call; no such workaround is shipped in application code.

## Copies and preservation

apps/global-christian-community lacks design-cards.js and has older frontend code. alternate-global-community differs in frontend, design validation, services and Wrangler settings. Neither copy was transferred over the canonical application. The existing Account 3 deployment workflow targets the canonical source.

Concurrent work from 6072743 and 366ec07 was preserved, including member journeys, stable preview, autosave, privacy and navigation repairs. No production resource, binding, secret, database schema or owner identity was changed. No production accounts or posts were created during testing.

## Release status and remaining acceptance

Prepared in GitHub for review. No production deployment or staging publication has been performed. The existing workflow deploys on main updates or manual dispatch; this feature branch does not publish production.

After release approval, use the existing GitHub/Cloudflare workflow and verify authenticated live posting/editing, sign-out/sign-in, messages, Groups and Spaces against the real configured services. Verify actual radio stream playback separately. Real iOS/Safari and Android device acceptance remains outstanding. Preserve the previous healthy Worker release for rollback and all existing D1/R2/KV bindings and secrets. No migration is needed for this change.
