# CHANGELOG.md
All notable changes to the Heavenly Key public website (AI 2's scope).

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

## [1.2.2] — Implementation Ready Pass
### Added
- `FRONTEND-CONTRACT.md` — formal per-endpoint promise to Project A (loading/empty/error/retry/auth/mock behavior), verified against real code
- `ASSET-INVENTORY.md` — every file in `/assets/`, real sizes, real usage, optimization status
- `DESIGN-TOKENS.md` — every token with real usage counts, including a new Z-Index Layers section
- `FRONTEND-DEFINITION-OF-DONE.md` — quality checklist for all future work
- Component Ownership metadata in `COMPONENT-LIBRARY.md` (Stable / Experimental / Planned / Mock only / Awaiting backend / Awaiting ministry content / Deprecated — none currently deprecated)
- Final freeze statement in `README.md`: "Project B is feature-complete at the design level..."

### Fixed
- **Z-index consolidation:** 4 hardcoded z-index values (`1000`, `100`, `1000`, `900`) scattered across 3 files with no documented rationale — found while building `DESIGN-TOKENS.md`. Added `--z-header`/`--z-modal`/`--z-toast`/`--z-skip-link` tokens and replaced all 4.
- **Form loading state (real UX gap, not previously caught):** submit buttons were never disabled during an in-flight request, allowing accidental double-submission. Added disabled state + "Sending..." text for the duration of every form's request, with proper restore on both success and failure paths.
- **Image optimization (real performance gap):** the founder photo (`pages/about.html`) was 596K, completely unoptimized despite being in active use — resized and converted PNG→JPEG to 40K (93% reduction). The 5 hero-slideshow photos and the header logo were also resized/stripped. Found and fixed while building `ASSET-INVENTORY.md`, not previously caught by any prior pass.
- Corrected `pastor-emmanuel-adiohwo.png` → `.jpg` reference, and fixed its `width`/`height` attributes which had declared a square 500×500 for an image that is actually portrait 834×1250 (now correctly 534×800) — a pre-existing CLS-accuracy bug caught in the same pass.

## [1.2.0] — Release Candidate Audit Remediation
### Fixed
- **Security (H1):** Attribute-context XSS risk in `escapeHTML()` usage — Featured Sermon and Latest Ministry Updates components now build their `<a>`/`<img>` elements via `document.createElement()` with `HKEcosystem.sanitizeURL()`-validated properties instead of string-concatenating API values into `href`/`src` attributes. `HKEcosystem.escapeHTML` and `HKEcosystem.sanitizeURL` are now the shared, documented standard for all future API-driven components — see `API-INTEGRATION.md` §8.
- **Accessibility (H2):** `--color-warm-orange` token changed from `#E8590C` to `#B94709` — the original failed WCAG AA both as `.badge-live` background-with-white-text (3.58:1) and as `.prayer-count` text-on-white (3.58:1/3.28:1). The new shade passes AA normal text (5.29:1 / 4.85:1) in both directions while remaining in the same hue family. Reviewed every other color-token pairing actually used in the codebase (12 pairs) — no other failures found.
- **Documentation (M2):** `CHANGELOG.md` and `COMPONENT-LIBRARY.md` now distinguish components genuinely used in shipped pages from those built and available but not yet placed anywhere.

### Added
- Media Centre component library (`css/media-components.css`): Media Library grid, Audio Player, Video Player, Broadcast Schedule, Live Indicator, Broadcast Status Badge, Campaign Card, Media Metadata Card, Podcast Card, Sermon Card, Broadcast History List — see `COMPONENT-LIBRARY.md` for per-component status (in-use vs. prepared).
- `RELEASE-CANDIDATE-AUDIT.md` — full independent audit, evidence-based, 0 Critical / 3 High / 5 Medium / 3 Low findings, decision: Approved With Minor Fixes.

## [1.2.1] — Final Consistency Sweep (Frontend Design Freeze pass)

### Governance (post-freeze refinement)
- Corrected the freeze statement: "Project B is frozen" was imprecise. The accurate scope is **"Project B's frontend architecture, design system, component library, and UI specifications are frozen"** — ministry content, Project A API integration, and live deployment remain open implementation tasks, not design work. Applied consistently across `README.md`, `PROJECT-CHECKLIST.md`, `CHANGELOG.md`.
- Added `INTEGRATION-READY.md` — the version handshake document for Project A.
- Added `API-PLACEHOLDER-REGISTRY.md` — single source of truth for which components are Connected vs. Waiting on a backend endpoint.
- Added `CONTENT-PLACEHOLDER-REGISTRY.md` — single source of truth for outstanding ministry-supplied content.
- Added the governing separation-of-concerns principle (README.md): the frontend is presentation-only — business rules, security decisions, permissions, validation, workflow enforcement, and ministry logic belong exclusively to Project A.
- Caught and fixed a real gap while compiling `INTEGRATION-READY.md`: asset cache-busting (`?v=` query strings + `service-worker.js`'s `ASSET_VERSION`) was still `1.1.0`, one version behind. Bumped to `1.2.1` in all three places and regenerated.

### Fixed (design-token consolidation)
- Added `--radius-pill` token; replaced 5 hardcoded `border-radius: 999px` declarations across `components.css`, `inner.css`, `ui-components.css`, `media-components.css`.
- Removed a hardcoded `#E4C766` duplicate of `--color-gold-light` in `.site-footer a`, and deleted two now-redundant inline `style="color:#E4C766"` overrides on the footer WhatsApp/email links (the parent rule already applied the identical color — dead weight, not a visual change).
- Consolidated a one-off `font-size: 2.5rem` on `.play-button` to `var(--text-3xl)`, and reworked the homepage's static Featured Sermon fallback markup to use the same `.video-player`/`.play-button` classes as the JS-rendered version, eliminating a duplicated inline-styled copy of the same component.
- Audited icon `stroke-width` variance (1.5 baseline, with two outliers at 2 and 3): both are intentional — the nav hamburger (interactive control) is deliberately bolder than decorative content icons, and the large Africa-outline illustration needs a heavier stroke at its scale. Documented rather than "fixed," since they weren't actually inconsistencies.
- Reviewed all `@media` breakpoint declarations, all `transition`/`box-shadow` usage (zero hardcoded values found outside the token system already), and all top-level CSS selectors for duplicates (zero found) — codebase was already disciplined here.

### Added
- Subtle depth to the homepage hero: a soft radial highlight + dot-grid texture (CSS-only, no new image assets), plus `box-shadow: var(--shadow-raised)` / `var(--shadow-card)` on the laptop frame and scripture card for elevation consistency with the rest of the site's card system.
- `.showcase-carousel` — a generic, reusable rotating-preview component in `css/home.css`, generalized from the proven hero-slideshow pattern. **Prepared, not placed on any page** — deliberately not populated with fabricated "Community Platform" / "Ministry Suite" preview content, since Project A has no public-facing UI yet. See `COMPONENT-LIBRARY.md` §13.

### Verified (full validation suite re-run after all edits)
Tag balance, duplicate `class=`/`id=` attributes, broken internal links, missing alt text, JSON-LD validity, `manifest.json` icon references, `sitemap.xml`/`rss.xml` well-formedness, sitemap completeness, meta/landmark presence — all 11 pages, zero failures. All 5 JS files re-validated with `node --check`. All 7 CSS files brace-balance-checked.

## [1.1.0] — Integration & PWA Pass
### Added
- Generic API client (`js/api-client.js`) with graceful offline fallback to existing static content
- 8 homepage sections wired as API-driven components (`js/homepage-components.js`): Today's Scripture, Bible Verse of the Day, Weekly Memory Verse, Latest Testimonies, Daily Devotional, Upcoming Events, Featured Sermon, Latest Ministry Updates
- Full UI component library (`js/ui-components.js`, `css/ui-components.css`). **In production use:** accessible modal (event RSVP, volunteer sign-up), form validation states. **Available but not yet placed on any page** (built, documented, ready to use — not "implemented" in the shipped frontend): accordion, tabs, toast notifications, pagination, standalone skeleton loader, video-player/prayer-card/event-card component classes. See `COMPONENT-LIBRARY.md` for the per-component status table.
- PWA support: `manifest.json`, `service-worker.js`, `offline.html`, generated icon set (8 sizes + 2 maskable), install-prompt handling
- RSS-ready architecture (`rss.xml` stub + alternate link)
- Asset versioning (`?v=1.1.0`) for cache-busting on all local CSS/JS
- Real testimony submission form (`pages/community.html`, wired to `/api/testimonies`)
- Real partnership inquiry form (`pages/partner.html`, wired to `/api/partner`)
- Volunteer sign-up modal (`pages/partner.html`) — mock adapter, no published AI 1 endpoint yet
- Event RSVP modal (`pages/events.html`) — mock adapter, no published AI 1 endpoint yet
- Accessible client-side form validation with `aria-invalid` + live-region error announcements
- Data architecture and AI provider layer documentation, aligned to AI 1's frozen master spec
- Automated structural validation on every rebuild: HTML tag balance, duplicate `class=` attributes, duplicate `id=` values

### Changed
- All 6 previously-generic `[PLACEHOLDER — connect to backend]` forms now target AI 1's actual published `/api/...` paths
- Corrected an earlier draft's invented `/v1/...` endpoint scheme to match AI 1's real `/api/...` list
- Homepage stats bar updated with real sourced figures (15 nations, 500 crusades, 10,000 souls, 87 blog posts) where available; two categories left `[PLACEHOLDER]` where no real number exists
- Hero visual replaced stock-photo placeholder with a custom vector illustration (Project Lead decision)
- Navigation restructured to the approved 10-item menu + single "I Said Yes to Jesus" CTA + "Join the Rescue Mission" secondary CTA
- Single sign-on: Member Login replaced with a Login shortcut routing to the Global Christian Platform's auth system

### Fixed
- LCP: hero's first slideshow image now loads eagerly with `fetchpriority="high"` instead of lazily
- A bulk inline-style-to-utility-class refactor briefly produced invalid duplicate `class=` attributes — caught by the new automated validation and fixed
- Service worker's precached asset list corrected to match the newly-versioned `?v=` URLs (would have silently broken offline caching otherwise)
- Missing `css/inner.css` added to the service worker's app-shell precache list

### Deliberately Not Done
- Counselling request form — withheld pending a safeguarding workflow decision (see `KNOWN-ISSUES.md` §1)
- Deployment — documented in `DEPLOYMENT.md` but not executed, per Project Lead instruction

## [1.0.0] — Content Integration Pass
### Added
- Real ministry content integrated from the offline site export: full 22-point Statement of Faith, 5-step salvation process + official prayer, founder bio, ministry history, real contact/bank/social details
- Curated real photography (logo, founder headshot, 6 outreach photos) replacing stock placeholders

### Flagged (not resolved by AI 2)
- Hero headline wording conflict (approved spec vs. real site copy)
- Headquarters address conflict (Warri, Delta State vs. Nigeria, Africa)

## [0.2.0] — Full Site Build
### Added
- All 10 inner pages (About, Ministries, Missions, Events, Radio, Resources, Community, Partner, Contact, I Said Yes to Jesus) generated from a shared template (`build_pages.py`)
- Legacy Preservation Rule adopted; 4 legacy items mapped into the new information architecture
- "Africa Must Be Saved!" dedicated homepage banner
- Design token system, base styles, component library, inner-page layout system

## [0.1.0] — Initial Homepage & Comparison Report
### Added
- Comparison report against the approved master specification
- Initial homepage build with all spec-required sections
- Project checklist established
