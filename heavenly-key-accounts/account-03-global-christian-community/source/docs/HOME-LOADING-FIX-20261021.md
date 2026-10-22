# Homepage loading fix — 21 October 2026

Problem: mountHome awaited the feed, daily reading and discovery before the application emitted hk-community-view-ready. A failed daily reading rejected the mount; a pending service delayed the premium dashboard and authenticated ACTIVE initialization.

Fix: construct the complete homepage shell first and start feed/discovery requests independently. The daily reading now owns its loading, failure and retry controls. Missing or malformed reading data produces an honest recoverable state. Detached cards ignore late responses. No fallback readings or activity are invented.

Changed public/app.js, public/index.html (cache version), package.json (regression command), test/approved-home-layout.checks.mjs (asset version), and added test/home-loading.checks.mjs.

Verification: TypeScript and frontend syntax checks passed. All 42 relevant tests passed, including four new regressions exercising the actual mountHome/renderPage functions with stalled services, rejected reading requests, retry recovery, malformed payloads and navigation. Both guest and authenticated session events reach layout/ACTIVE initialization while service requests remain pending.

This fixes the identified homepage initialization defect. It does not resolve the separate Community Care missing-module failure or the local API-audit runtime limitation. No browser screenshot comparison or deployment was performed.
