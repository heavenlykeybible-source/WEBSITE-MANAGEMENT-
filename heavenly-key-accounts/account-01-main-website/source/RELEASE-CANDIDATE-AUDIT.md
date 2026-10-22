# RELEASE CANDIDATE AUDIT — v1.1.0
**Heavenly Key Evangelistic Movement — Public Website**
**Auditor stance:** Independent QA review. Every finding below was produced
by actually reading or programmatically checking the real files in this
repository — grep, static analysis, XML/JSON parsing, and manual WCAG
contrast math against the real hex values in `css/tokens.css`. Nothing
requiring a live browser, screen reader, deployed backend, or running
server was tested — those are marked **BLOCKED – NOT TESTABLE YET**, never
"Passed." Fixes are **not** applied in this document, per instruction.

---

## EXECUTIVE SUMMARY

| Metric | Score |
|---|---|
| Overall quality score | **78/100** |
| Production readiness | **65%** |
| Accessibility score | **80/100** |
| SEO score | **92/100** |
| Performance readiness | **70/100** (Core Web Vitals themselves: BLOCKED) |
| Security readiness | **55/100** |
| Maintainability | **85/100** |
| Scalability (architectural) | **80/100** |
| Cloudflare readiness | **60%** |
| API readiness | **70%** |
| Documentation quality | **85/100** |
| UI consistency | **75/100** |
| UX quality | **75/100** (provisional — real-browser journey: BLOCKED) |
| Ministry suitability | **90/100** |
| Professionalism | **85/100** |

**This is a genuinely solid static-site foundation with real, fixable
defects — not a fundamentally broken project.** The codebase has zero
broken internal links, zero duplicate IDs, 100% image alt-text coverage,
complete and valid SEO/structured-data markup, and no hardcoded secrets.
It also has one real attribute-injection XSS pattern, one confirmed WCAG
AA contrast failure, no CSP/security headers configuration, inconsistent
heading hierarchy, and documentation that slightly overstates how much
of the component library is actually wired into pages. None of these
require a rewrite; all are concrete, listed below with file/line
evidence.

---

## CRITICAL FINDINGS
**None found that block integration outright.** No broken builds, no
missing core files, no data loss risk, no exposed secrets.

---

## HIGH PRIORITY FINDINGS

### H1. Attribute-context XSS risk in `escapeHTML()`
**File:** `js/homepage-components.js`, lines 16–19 (function), used at
lines 122–123 and 147.
```js
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}
```
This is safe for **text-node** interpolation (`<p>${escapeHTML(x)}</p>`)
because HTML text-node serialization escapes `&`, `<`, `>`. It is **not**
safe for **attribute-value** interpolation, because the browser's
text-node serializer does not escape `"` or `'`. It is used in attribute
position at:
```js
<a href="${escapeHTML(s.video_url)}" ...>
<img src="${escapeHTML(s.thumbnail_url)}" ...>
<a href="${escapeHTML(a.url || "#")}">
```
If AI 1's API ever returns a `video_url`, `thumbnail_url`, or blog `url`
field containing a double quote (e.g. `x" onerror="alert(1)` or a
`javascript:` URI), this breaks out of the attribute and can inject an
event handler or a script URI, once `API_BASE` is set and this code path
goes live. **Verified by direct source inspection — not currently
exploitable because `API_BASE` is null and no live data flows through
it, but this is a real defect that will be exploitable the moment AI 1's
API is connected**, unless fixed first. Fix is small (a proper
attribute-escaping helper or build these nodes via `element.href =` /
`element.src =` DOM properties instead of string concatenation) but is
not applied here per audit instructions.

### H2. WCAG AA contrast failure: default `.badge-live`
**File:** `css/components.css` `.badge-live` (white text, `#FFFFFF`, on
`var(--color-warm-orange)` = `#E8590C`), used unstyled at
`pages/radio.html` (generated from `build_pages.py` line ~481, the
"Live" badge next to the radio player).
**Computed contrast ratio: 3.58:1** (verified via the WCAG relative-
luminance formula against the actual token hex values). WCAG AA requires
4.5:1 for normal text; `.badge-live` renders at `font-size: var(--text-xs)`
(12px) `font-weight: 700`, which does **not** qualify for the 3:1
"large text" exception (that requires ≥18.66px bold). **This fails WCAG
AA as currently styled.** Every other use of `.badge-live` in the
codebase overrides the background to `var(--color-royal-blue)` (11.27:1,
passes comfortably) — only the one default, unstyled instance on the
Radio page fails.

### H3. No Cloudflare Pages `_headers` file — zero security headers configured
No `_headers` file exists anywhere in the repository. `DEPLOYMENT.md`
mentions caching headers as a "recommended addition, not yet created"
but the document does not mention CSP, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` at
all. For a site that embeds third-party iframes/links (YouTube),
collects PII in forms, and will soon talk to a real API, deploying
without any of these is a real gap, not a stylistic nicety.

---

## MEDIUM FINDINGS

### M1. Heading hierarchy skips levels on every single page
Verified programmatically across all 11 pages:
- **Every page** (footer is shared, generated by `build_pages.py`): the
  footer's four `<h4>` elements ("Heavenly Key Evangelistic Movement",
  "Navigate", "Contact", "Weekly Memory Verse") follow directly after
  whatever the last body heading was (`h2` or `h3`), skipping a level.
  Single shared source, so a single fix in `build_pages.py`'s `FOOTER`
  template would resolve all 11 pages at once.
- **`pages/contact.html`, `pages/resources.html`, `pages/i-said-yes.html`:**
  the page-banner `<h1>` is followed directly by `<h3>` elements in the
  body with no intervening `<h2>` — inconsistent with `about.html`,
  `ministries.html`, `radio.html`, `partner.html`, which correctly use
  `h2` after `h1`.
This does not break WCAG 1.3.1 as a hard failure (sequential heading
levels are a best practice, not a strict success criterion), but it is
a real, verifiable inconsistency that affects screen-reader users
navigating by heading level, and it's inconsistent between pages built
from the supposedly-shared template.

### M2. Documentation overstates component-library integration
`CHANGELOG.md` (`[1.1.0]` entry) lists "toast notifications... pagination"
alongside modal/accordion/tabs as delivered UI components without
distinguishing integration status. Verified by grep: **`HKUI.toast()` is
never called anywhere in the codebase.** `.pagination`, `.skeleton`
(as a standalone class), `.video-player`, `.prayer-card`, and
`.event-card` are defined in `css/ui-components.css` but **never applied
to any element in any page.** `.accordion-item` / `role="tablist"` are
also never used anywhere. By contrast, `.modal` **is** genuinely wired
and used twice (event RSVP, volunteer sign-up) — that part of the claim
is accurate. The inaccuracy is specifically toast/pagination/skeleton/
video-player/prayer-card/event-card/accordion/tabs being implied as
integrated when they are library-only.

### M3. 18 CSS classes defined but referenced nowhere
Programmatic cross-check of every `.class` selector in `css/*.css`
against all HTML/JS/`build_pages.py` content found 18 unreferenced
classes, largely overlapping with M2: `brand-tagline`, `event-card`,
`event-date`, `map-placeholder`, `pagination`, `play-button`,
`prayer-card`, `skeleton`, `toast-error`, `toast-info`, `toast-success`,
`u-gold-eyebrow`, `u-max-prose`, `u-mb-2`, `u-mt-2`, `u-muted`,
`u-on-dark`, `video-player`. Notably, of the 10 utility classes added
in the "reduce inline-style duplication" pass, only 3 (`u-text-center`,
`u-max-content`, `u-mb-3`) were actually applied via the `sed` replace
at the time — the other 7 were spec'd and never used.

### M4. All form validation is client-side only (expected at this stage, but a real gap to track)
Every form (`js/main.js` `initApiForms()`) validates via HTML5
`checkValidity()` in the browser only. This is expected and reasonable
while there's no live backend, but it means **zero server-side
validation currently exists anywhere in this ecosystem for the website's
submissions** — a `POST` request built by hand (bypassing the DOM
entirely) would hit AI 1's API with no client-side gate at all. This is
AI 1's responsibility to enforce server-side, not a website defect per
se, but it should be an explicit, tracked assumption rather than an
implicit one — currently it is not mentioned in `KNOWN-ISSUES.md` or
`API-INTEGRATION.md`.

### M5. `pages/about.html` founder photo is lazy-loaded despite being a prominent, likely near-the-fold image
`loading="lazy"` is applied to the founder's photo in the Leadership
section. Depending on page length and viewport, this may sit close
enough to the fold to warrant eager loading the way the homepage hero
image was corrected to do. Lower severity than the homepage fix since
it's further down a longer page, but inconsistent with the LCP-awareness
already applied elsewhere.

---

## LOW FINDINGS

### L1. Orphaned/unused asset files
`assets/logo-placeholder.svg` is referenced nowhere (superseded by
`assets/ministry/logo.png`). Five curated ministry images copied into
`assets/ministry/` are never referenced by any page: `all-have-sinned.png`,
`ministries-header.jpg`, `partnership-header.jpeg`, `sermons-header.jpg`,
`where-will-you-spend-eternity.png`. Dead weight, no functional impact,
but flagged per the file-structure audit request.

### L2. Accordion and Tabs components are fully built, never used
Not a defect — built ahead of a concrete use case (e.g., a future FAQ
section) — but worth noting alongside M2/M3 as part of the same pattern:
component library completeness outpaced page-level adoption.

### L3. Service worker's root-relative (`/css/...`) precache paths assume root deployment
`service-worker.js`'s `APP_SHELL` array uses absolute root paths, which
only resolve correctly if the site is deployed at the domain root (which
`DEPLOYMENT.md` does specify) — this is a reasonable assumption already
documented elsewhere, just not cross-referenced in `service-worker.js`
itself with a comment pointing to that assumption.

---

## CATEGORY-BY-CATEGORY RESULTS

### 1. File Structure — mostly clean
✅ No broken imports, no missing referenced files (verified: every
`href`/`src` in all 12 HTML files resolves to a real file — 143
external/mailto/tel refs and 18 anchor-only refs excluded from that
count, zero broken). ⚠️ See L1 (orphaned assets), M3 (unused CSS).

### 2. HTML Audit
✅ Zero duplicate `id=` values (automated check, re-verified this audit).
✅ Zero duplicate `class=` attributes. ✅ 100% alt-text coverage (24/24
`<img>` tags). ✅ `lang`, viewport, title, meta description, canonical,
OG, Twitter Card, JSON-LD, skip link, `<main>`, `aria-label="Primary"`
nav all present on all 11 pages. ⚠️ See M1 (heading hierarchy).
BLOCKED – NOT TESTABLE YET: real tab order / focus order in an actual
browser.

### 3. CSS Audit
✅ Zero `!important` anywhere across all 6 stylesheets. ⚠️ See M3 (18
unused classes). BLOCKED – NOT TESTABLE YET: real responsive rendering,
actual specificity conflicts only visible in a browser, dark-mode
readiness (no dark theme exists at all — out of scope, not attempted).

### 4. JavaScript Audit
✅ No `console.log`/`debugger` calls anywhere in `js/*.js`. ✅ No
hardcoded secrets/API keys. ✅ No positive `tabindex` misuse. ⚠️ See H1
(attribute XSS). BLOCKED – NOT TESTABLE YET: memory leaks, real event
listener lifecycle, actual Promise rejection behavior against a live API.

### 5. Component Library Audit
✅ Buttons, cards, forms, navigation, header, footer, hero, scripture
card, modal genuinely reusable and in active use across pages. ⚠️ See
M2/M3/L2 (toast, pagination, skeleton, video-player, prayer-card,
event-card, accordion, tabs built but not applied anywhere).

### 6. Responsive Audit
BLOCKED – NOT TESTABLE YET in full. Breakpoints exist in CSS
(`@media (max-width: 900px)`, `640px`) and were authored with mobile-
first intent, but actual rendering at each breakpoint requires a real
browser, which this environment does not have.

### 7. Accessibility Audit
✅ Skip link, ARIA landmarks, form labels, `aria-invalid` + live-region
error announcements, `prefers-reduced-motion` handling, focus-visible
styles all present in source. ⚠️ H2 (contrast failure), M1 (heading
hierarchy). BLOCKED – NOT TESTABLE YET: actual screen reader behavior,
real keyboard-only navigation, real focus trap behavior in the modal.

### 8. SEO Audit — strongest category
✅ Unique title/description per page, canonical URLs, sitemap.xml
(verified: every listed URL resolves to a real file, every real page is
listed — zero mismatch either direction), robots.txt, valid JSON-LD (21
blocks parsed, 0 invalid), RSS stub with alternate link, structured
BreadcrumbList on every inner page. BLOCKED – NOT TESTABLE YET: actual
Google Search Console indexing behavior, real Core Web Vitals as
measured by Googlebot.

### 9. Performance Audit
✅ Lazy loading applied broadly with one LCP-aware exception (homepage
hero). ✅ Asset versioning (`?v=1.1.0`) present and — after this audit's
verification — correctly mirrored in the service worker's precache
list. ⚠️ M5 (about.html photo lazy-load). BLOCKED – NOT TESTABLE YET:
actual Lighthouse score, real LCP/CLS/INP numbers, bundle transfer
size over a real network, font loading behavior on a throttled
connection.

### 10. Security Audit
⚠️ H1 (attribute XSS pattern), H3 (no security headers), M4 (client-
only validation, by necessity at this stage). ✅ No hardcoded secrets,
no obvious open-redirect patterns, no inline `onclick=` handlers (CSP-
friendly), forms use `POST` with JSON bodies. BLOCKED – NOT TESTABLE
YET: CSRF (no backend to test against), rate limiting (AI 1's
responsibility), actual clickjacking exposure (needs headers + live
site), any server-side injection testing.

### 11. API Integration Audit
6 of 8 forms wired to AI 1's actually-published `/api/...` paths
(prayer, contact, decisions, newsletter, testimonies, partner) — matches
`API-INTEGRATION.md`/`DATA-ARCHITECTURE.md` exactly, verified by grep.
2 are explicit, labeled mock adapters (volunteer, event registration) —
matches the "never guess and call it real" rule. Counselling
deliberately absent, documented as a safeguarding halt condition.
3 homepage components (`/api/bible/verse-of-day`, `/api/bible/memory-verse`,
`/api/sermons`) use documented **assumed**, unconfirmed endpoint shapes —
correctly flagged as such in `API-INTEGRATION.md`, not silently treated
as real. BLOCKED – NOT TESTABLE YET: any actual request/response
behavior, since `API_BASE` is null by design and AI 1's API isn't live.

### 12. PWA Audit
✅ `manifest.json` valid, all 10 declared icons exist on disk (verified).
✅ `service-worker.js` present with a reasoned cache strategy (shell
cache-first, API network-only, HTML network-first-then-cache-then-
offline). ✅ `offline.html` exists and is linked correctly. ⚠️ L3
(root-path assumption undocumented in the file itself). BLOCKED – NOT
TESTABLE YET: actual install prompt firing, actual offline behavior,
actual cache versioning/update flow in a real browser/device.

### 13. Content Audit
✅ No Lorem Ipsum found anywhere. ✅ No dummy images beyond clearly-
labeled `[PLACEHOLDER]` text markers and `placehold.co` slideshow
images already disclosed in `CONTENT-INTEGRATION-REPORT.md`. All
Bible references were sourced verbatim from the offline ministry export,
not generated. Two content conflicts remain genuinely open (hero
wording, HQ address) — already tracked in `KNOWN-ISSUES.md` §4, not
new findings.

### 14–16. UX / Admin / Hacker Persona Audits
BLOCKED – NOT TESTABLE YET as end-to-end journeys, since that requires
a live, running site. Static-analysis-derived findings relevant to these
personas are folded into H1–H3 and M1–M5 above rather than duplicated
here as separate narrative walkthroughs, which would not be grounded in
actual observed behavior.

### 17. Cloudflare Deployment Audit
`DEPLOYMENT.md` documents the intended Pages setup (no build step,
`/` as output directory, custom domain, HTTPS). ⚠️ H3 (no `_headers`
file exists despite being described). No `wrangler.toml` or Pages
project config file exists in this repo (expected — this is a static
site with no Workers of its own). BLOCKED – NOT TESTABLE YET: actual
deployment, actual Cloudflare cache behavior, actual routing.

### 18–19. Documentation & Cross-Check Audit
✅ Endpoint names in code match `API-INTEGRATION.md` and
`DATA-ARCHITECTURE.md` exactly (verified by grep across both). ✅
`README.md`'s file-structure description matches the actual repository
layout. ⚠️ M2 (CHANGELOG.md overstates component integration status —
the one real cross-document inconsistency found).

---

## RECOMMENDATIONS (priority order)
1. Fix H1 before `API_BASE` is ever set to a real value — this is the one finding with genuine security impact once AI 1's API goes live.
2. Fix H2 (`.badge-live` contrast) — small, isolated CSS fix, real WCAG AA failure.
3. Add a `_headers` file (H3) covering at minimum CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` before deployment.
4. Normalize heading hierarchy (M1) — single fix in the shared footer template resolves it site-wide; add an `h2` after the banner `h1` on the three pages missing one.
5. Correct `CHANGELOG.md`/`COMPONENT-LIBRARY.md` (M2) to distinguish "built" from "integrated" for toast/pagination/skeleton/video-player/prayer-card/event-card/accordion/tabs, or apply them to real page content so the claim becomes true.
6. Either use or remove the 18 unreferenced CSS classes (M3) and the 6 orphaned asset files (L1) for a clean release.
7. Explicitly document the client-side-only validation assumption (M4) in `KNOWN-ISSUES.md` so it isn't silently relied upon.

None of the above require rearchitecting anything; all are isolated, well-understood fixes.

---

## RELEASE DECISION

# 🟡 APPROVED WITH MINOR FIXES

**Justification:** Every category with verifiable, testable-today scope
(file structure, HTML validity, SEO markup, JSON/XML validity, asset
resolution, secret scanning, contrast math) came back either clean or
with concrete, isolated, low-to-moderate-effort defects — no systemic
architectural problem, no broken build, no missing core functionality,
no fabricated or hidden test results. The three High findings (H1–H3)
are real and should be fixed before this integrates with a live API and
goes to production, but each is a contained fix, not a redesign. The
large surface area that is legitimately **BLOCKED – NOT TESTABLE YET**
(Lighthouse, screen readers, real devices, live API behavior, actual
Cloudflare deployment) is exactly what it should be at this stage of the
project — a static frontend built ahead of its backend — and is
honestly disclosed as such rather than assumed to pass.
