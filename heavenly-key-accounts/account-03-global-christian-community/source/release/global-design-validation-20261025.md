# Global Christian Social Network — shared design and guest globe

Branch: feature/account3-social-network-easy-posting-20261025
Canonical application: heavenly-key-accounts/account-03-global-christian-community/source/

## Completed code

The TALKMONEY reference supplies the composition, adapted to the actual Christian social-network features. Bright royal blue (#1557e8), deep blue navigation and red accents (#d41146) now form a shared design across all 15 HTML pages, including the organization, reminder and error pages. The header, actual discovery search, navigation, member welcome, ACTIVE strip, composer, feed, side panels and footer use one visual language. Existing registration, login, sign-out, profiles, messages, Groups, Spaces, prayer, study, ministry links, moderation and posting methods retain their existing application owners and contracts.

Guests keep the people-and-globe welcome banner. Its title is now GLOBAL CHRISTIAN SOCIAL NETWORK. The original image remains available for compatibility; the current application uses assets/global-christian-social-network-approved-banner.jpeg (1983×793).

Only the centre globe moves. A blue-and-gold map surface turns inside a circular shaded layer positioned over the existing globe. The people, flags, title and ministry slogan stay still. One rotation takes 32 seconds and repeats continuously. Pause/resume is available; reduced-motion preferences disable motion, and hidden pages pause it. The texture is never displayed as a page or standalone banner. Motion preference handling uses one shared listener across navigation.

No fabricated online people, activity counts, paid features or advertising were added. Preview posts and ACTIVE entries are disposable QA records, never production seed data. No production resource, secret, binding or schema changes were made.

## Executed checks

- npm run build: passed, including 75 tests, TypeScript/frontend checks, preflight and Worker compilation.
- npm run test:care: passed.
- Root node tests/run.mjs: passed.
- npm run test:browser: passed 17 end-to-end checks, with zero uncaught browser errors. The actual Worker uses disposable local D1/KV/R2; backend responses are not mocked.
- Browser coverage: complete guest banner/account links; globe movement, pause/resume and reduced motion; registration; actual local posts and ACTIVE; member welcome/create-post actions; direct typing/selection/colour; drafts; POST/PATCH; all main secondary views; discovery search from another page; organization/reminder/error pages; sign-out and return-to-Messages sign-in.
- Composer sizes: 320, 390, 768 and 1440 px. Guest/member homepage screenshots and secondary-page screenshots were inspected in headless Chromium 138. This is not real iOS/Safari or Android certification.
- Side panels scroll independently without compressing card contents. All tested pages avoid horizontal overflow at phone width.

Normal browser QA: npm ci; npx playwright install chromium; npm run test:browser. This container used a temporary, uncommitted loopback fallback for its denied os.networkInterfaces call and an externally installed browser. No environment workaround ships in the app.

## Asset generation record

Built-in image editor prompt: replace the top headline with the exact text GLOBAL CHRISTIAN SOCIAL NETWORK, keeping the wide white banner, portraits, flags, connecting lines, globe and existing ministry slogan in the same composition. The selected output was encoded as assets/global-christian-social-network-approved-banner.jpeg.

Built-in image generator prompt: create a flat 2:1 horizontally repeating decorative gold-landmass/royal-blue-ocean texture, with subtle grid lights and no text, portraits or flags. The selected output is assets/blue-gold-world-map.jpeg, used only inside the animated circular globe. Original generated PNGs remain in the conversation workspace.

## Release status

Prepared for the existing GitHub review and Cloudflare workflow. No production deployment, staging publication, migration or live-account modification was performed. Review the approved SHA, then use the existing workflow while retaining the previous healthy Worker release and all D1/R2/KV bindings and secrets. Authenticated live acceptance, real-device acceptance and actual external radio playback verification remain separate release checks.
