# Development verification — 21 October 2026

Scope: first integration and build-repair pass on build/global-christian-community-active-layout-20261021. No production or Cloudflare resources were changed.

## Verified and changed

index.html already references approved-home-layout.css and approved-home-layout.js; no entry-point change was needed. The original banner was downloaded and Git blob SHA verified: 446,193 bytes.

- public/approved-home-layout.js: synchronize guest/member classes on hk-care-session, clear state on navigation away, add an idempotent welcome heading, and place explanatory text before account actions. Existing account destinations and ACTIVE ownership remain unchanged.
- public/approved-home-layout.css: style the guest welcome heading.
- package.json: syntax-check the layout script and run the new homepage regression suite in buildcheck.
- test/approved-home-layout.checks.mjs: three tests for guest reading order, repeated renders, session transitions, ACTIVE preservation and entry-point links.
- test/frontend-feed.checks.mjs: correct the copied shared-test import to ../../../scripts and load app/media-dock fixtures from this implementation rather than a sibling legacy application. Existing assertions were preserved.

## Actual local checks

Node v24.19.0; npm ci --ignore-scripts --no-audit --no-fund succeeded.

PASS: npm run check.
PASS: npm run frontend, including the approved layout script.
PASS: 3 home integration tests, 12 Design Card tests, 9 feed/shared ecosystem tests, and 6 database-backed suites covering ACTIVE, registration, Groups/messaging, Spaces, social auth/adverts and stewardship.
PASS: development preflight; it explicitly does not certify release readiness.

The feed suite's corrected tests were run successfully after the initial buildcheck stopped at its broken copied import.

FAIL: Community Care imports src/content-screening.ts, which does not exist in this implementation. Later test assertions also require screening_jobs/community_strikes and enforcement behavior. Do not delete these assertions or stub out the screening pipeline to make tests green. Recover and compare the complete associated backend, schema, authorization and tests before merging this feature.

BLOCKED: API audit successfully applied disposable local migrations, but Wrangler's local server failed before health checks with uv_interface_addresses returned Unknown system error 1. No HTTP audit assertions passed in that run. Re-run in a compatible local or staging runtime.

Full buildcheck is not passing: the runtime API audit and Community Care remain unresolved.

## Preview and release

wrangler.staging.toml contains REPLACE_ACCOUNT3_STAGING_D1_ID and REPLACE_ACCOUNT3_STAGING_KV_ID. A functional isolated staging deployment has not been provisioned or verified. No Account 4 approval or Account 3 deployment occurred.

The three new homepage tests exercise DOM integration with a small VM fixture, not a real browser. Screenshot fidelity, browser guest/member flows, mobile usability and accessibility still require browser testing against a running application.

Passing social-auth contract tests do not verify configured Google/Facebook credentials or live provider flows. Passing registration tests do not establish email ownership verification, password recovery, administrator MFA or device/session management.

## Remaining work

1. Compare preserved versions and recover the missing moderation pipeline with its migrations and permissions.
2. Resolve Community Care and rerun the complete build plus HTTP audit.
3. Audit email verification, recovery, MFA, sessions, abuse controls, deletion/export, internationalization and operations.
4. Run desktop/mobile browser verification against the approved screenshots and real authenticated backend.
5. Configure isolated staging resources and obtain explicit owner deployment approval through the requested review process.

This pass is reviewable source work, not a completed premium UI, finished security audit, or launch-ready release.


## Visitor welcome follow-up — 21 October 2026

The owner requested an inviting guest homepage that disappears after authentication.

Implemented in public/app.js: the approved banner remains unchanged, followed by encouraging copy, three original feature cards about fellowship, encouragement and purpose, and real Join the Community / Sign In destinations. Guest content is constructed only when no authenticated userId exists. Other public views retain their compact invitation.

approved-home-layout.js now handles placement and session visibility without duplicating or moving the content owned by app.js. Responsive welcome styles and keyboard focus treatment were added to approved-home-layout.css. index.html cache versions were advanced for the three changed frontend assets.

The homepage suite now has six passing tests, including fresh guest visits, exact CTA destinations, member exclusion, repeated renders, login/logout state, compact invitations on other pages and asset references. The existing feed test now checks the new CTA structure and uses the actual userId session field.

Validation: npm run check and npm run frontend passed. The relevant test run passed 28 tests, followed by one additional passing compact-view regression test (29 passing tests across the selected suites in total). These include feed, registration, ACTIVE and all 12 Design Card tests.

Browser visual QA was unavailable in this managed environment; no browser screenshot, pixel matching, mobile rendering or live login flow is claimed. No Cloudflare deployment occurred. Previously recorded full-build and staging blockers remain unresolved.
