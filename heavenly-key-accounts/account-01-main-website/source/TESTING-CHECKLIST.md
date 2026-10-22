# TESTING-CHECKLIST.md
**What's already validated automatically (every rebuild) vs. what still
needs a real browser, device, or live API.**

## 1. Already Validated (automated, this build environment — re-run and expanded during the Frontend Design Freeze pass)
- [x] HTML tag balance across all 11 pages
- [x] No duplicate `class=` attributes on any element
- [x] No duplicate `id=` values within any single page
- [x] Every generated page includes the identical shared header/nav/footer structure (enforced by `build_pages.py` being the single source of truth)
- [x] All 8 forms carry either a `data-api-endpoint` matching AI 1's published `/api/...` paths, or an explicit `data-mock` marker (never both, never a guessed endpoint treated as real)
- [x] Broken internal link check — every `href`/`src` across all 12 HTML files resolves to a real file
- [x] JSON-LD validity — all blocks parse as valid JSON
- [x] `manifest.json` validity and icon-file existence (all 10 declared icons present on disk)
- [x] `sitemap.xml`/`rss.xml` well-formedness, and sitemap completeness (every real page listed, nothing phantom)
- [x] JS syntax validated with `node --check` on all 5 JS files (real parser, not a heuristic)
- [x] CSS brace-balance check on all 7 stylesheets
- [x] Color-token contrast computed via the real WCAG formula for every pairing actually used — 2 real failures found and fixed at the token source (see CHANGELOG 1.2.0)
- [x] Attribute-injection sweep — zero unsafe `href="${`/`src="${` concatenation patterns remain

## 2. Needs a Real Browser (cannot be done in this sandbox)
- [ ] Visual QA at mobile (375px), tablet (768px), desktop (1280px+) breakpoints
- [ ] Lighthouse score (target: 95+ per Priority 6) — mobile, throttled connection, LCP < 2s, CLS < 0.1
- [ ] Actual LCP measurement on the homepage hero image (currently the only non-lazy image, loaded with `fetchpriority="high"` — needs to be confirmed against a real network trace)
- [ ] Font loading behavior (`font-display: swap` is set, but FOUT/FOIT behavior should be eyeballed on a slow connection)
- [ ] Mobile nav toggle: open/close, focus behavior, Escape-to-close, tap targets ≥ 44px
- [ ] Slideshow cycling timing and readability on small screens

## 3. Needs a Screen Reader (VoiceOver / NVDA / TalkBack)
- [ ] Skip-to-content link is announced and functional as the very first tab stop
- [ ] All form fields announce their label, and the new `aria-invalid` + status-region validation errors (see `js/main.js`) are actually announced, not just visually flagged
- [ ] Modal focus trap (Tab/Shift+Tab cycling, Escape to close, focus returns to trigger) — implemented in `js/ui-components.js`, never tested with a real AT
- [ ] Accordion and tabs keyboard behavior (Arrow keys on tabs, Enter/Space on accordion triggers)
- [ ] `aria-current="page"` on the active nav link is announced meaningfully

## 4. Needs AI 1's Live API
- [ ] Every component in `API-INTEGRATION.md` §3, once `API_BASE` is set: confirm the *assumed* response shapes documented in §4 match AI 1's *actual* shapes — expect some `render()` functions in `js/homepage-components.js` to need small adjustments
- [ ] Confirm a `POST` to `/api/prayer`, `/api/contact`, `/api/decisions`, `/api/newsletter` actually lands as `status: pending` in AI 1's system
- [ ] Confirm CORS is configured on AI 1's side for `www.heavenlykey.org`
- [ ] Confirm the offline-fallback behavior in `HKEcosystem.renderComponent()` triggers correctly on a real network failure (currently only tested by *not setting* `API_BASE`, not by simulating a live-but-failing request)

## 5. Needs a Real Device
- [ ] PWA install prompt (`beforeinstallprompt`) fires and the custom "Install App" button in the footer works — Chrome/Android only; Safari/iOS has no equivalent API and will never show this button (expected, not a bug)
- [ ] Service worker offline behavior: load the site once online, disable network, reload — should serve cached pages/assets and fall back to `offline.html` for anything not cached
- [ ] Icon rendering at all generated sizes (72–512px, plus maskable variants) on both Android's adaptive icon system and iOS home screen

## 6. Content Review (human judgment, not automatable)
- [ ] Statement of Faith and Prayer of Salvation — sourced verbatim, but a final doctrinal read-through by the Project Lead before go-live
- [ ] The two open content conflicts in `CONTENT-INTEGRATION-REPORT.md` §2 (hero wording, HQ address) — need an explicit decision, not a test
- [ ] Every `[PLACEHOLDER]` marker — see `KNOWN-ISSUES.md` for the current count and locations
