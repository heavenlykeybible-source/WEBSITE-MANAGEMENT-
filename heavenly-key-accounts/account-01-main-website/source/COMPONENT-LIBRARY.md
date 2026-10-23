# COMPONENT-LIBRARY.md
**Project Nehemiah — Heavenly Key Evangelistic Movement Official Website**

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

This is the single source of truth for reusable UI components. Every page must
use these classes rather than inventing new one-off styles, so the site stays
consistent and easy to extend when new pages are added or the Global Christian
Platform integration begins.

Stylesheet load order (every page, in this order):
`tokens.css` → `base.css` → `components.css` → `ui-components.css` →
`inner.css` (inner pages only) / `home.css` (homepage only) →
`media-components.css` (where used)

## 0. Status Legend (extended for Component Ownership, freeze pass)
The audit (`RELEASE-CANDIDATE-AUDIT.md`, finding M2) found that prior
documentation implied every built component was in active use. It
wasn't. Every component below now carries a maturity label so future
contributors know exactly what they're building on:

- **Stable** — in active use on a real page, verified by grep, code-reviewed this freeze pass
- **Experimental** — built and functional, but not placed on any page and never verified in a real browser
- **Planned** — built ahead of a concrete future need (Media Centre, ecosystem showcase) with no page/backend to attach to yet
- **Mock only** — UI complete, deliberately not connected to any real or guessed backend endpoint
- **Awaiting backend** — UI complete and code-reviewed, blocked purely on AI 1 publishing/connecting a real endpoint
- **Awaiting ministry content** — UI complete, blocked purely on the ministry supplying real text/media (see `CONTENT-PLACEHOLDER-REGISTRY.md`)
- **Deprecated** — superseded, kept only for reference — **none currently exist in this codebase**

| Component | Maturity | Notes |
|---|---|---|
| Buttons, cards, nav, header, footer, hero, scripture card | Stable | Core system, in use everywhere |
| Modal | Stable | Event RSVP, volunteer sign-up — `pages/events.html` / `pages/partner.html` |
| Video player (`.video-player`, `.play-button`) | Stable | Homepage Featured Sermon + `pages/ministries.html` sermon cards |
| Sermon Card, Broadcast Status Badge, Broadcast Schedule | Stable | `pages/ministries.html`, `pages/radio.html` |
| Homepage live components (testimonies, devotional, events, blog, scripture, memory verse, sermon, verse-of-day) | Awaiting backend | UI stable, blocked on `API_BASE` being set — see `FRONTEND-CONTRACT.md` |
| Volunteer sign-up, Event Registration forms | Mock only | See `API-PLACEHOLDER-REGISTRY.md` |
| Counselling | *(withheld — not a maturity level)* | Policy/safeguarding decision required before any UI is built at all, see `KNOWN-ISSUES.md` §1 |
| Accordion, Tabs | Experimental | Built, styled, documented — no page uses them yet |
| Toast (`HKUI.toast()`), Pagination, standalone Skeleton, `.prayer-card`, `.event-card` classes | Experimental | Same — functional, unplaced |
| Showcase Carousel (`.showcase-carousel`) | Planned | Prepared for future ecosystem/media previews, deliberately not populated with fabricated content — see §13 |
| Media Centre set: Media Library, Campaign Card, Podcast Card, Media Metadata Card, Broadcast History List, Audio Player extras | Planned | No Media Centre page exists yet — see §12 |
| Blog / teaching archive (94 articles) | Awaiting ministry content | Full migration not attempted this pass, see `CONTENT-PLACEHOLDER-REGISTRY.md` |
| Statement of Faith, Prayer of Salvation, founder bio | Stable + content-complete | Sourced verbatim, not a placeholder — listed here only to confirm it's *not* "Awaiting ministry content" |

## 1. Design Tokens (`css/tokens.css`)
All colour, type, spacing, radius, shadow, and motion values are CSS custom
properties on `:root`. Never hard-code a hex value or px spacing in a page —
reference the token (e.g. `var(--color-wine)`, `var(--space-3)`).

## 2. Buttons (`.btn`)
| Class | Use |
|---|---|
| `.btn.btn-primary` | Primary action (wine red) — e.g. "I Said Yes to Jesus" |
| `.btn.btn-outline` | Secondary action on dark/coloured backgrounds |
| `.btn.btn-gold` | Tertiary/accent action — e.g. "Pray", "Read Chapter" |

```html
<a class="btn btn-primary" href="...">Label</a>
```

## 3. Navigation
- `.site-header` / `.header-inner` / `.brand` / `.main-nav` / `.nav-toggle` — identical markup on every page, generated from the shared `header()` function in `build_pages.py`. Never hand-edit nav markup on an individual page; edit the template and regenerate.
- `.nav-login` — single sign-on shortcut, always routes to the Global Christian Platform auth page. There is no second login system.
- `[aria-current="page"]` — automatically underlines the active nav item.
- `.top-strip` / `.ticker` / `.ticker-track` / `.flags` — the black ministry strip, identical on every page.

## 4. Cards (`.card`)
Generic bordered surface for updates, ministries, testimonies, events.
```html
<article class="card">
  <span class="eyebrow">Category</span>
  <h3>Title</h3>
  <p>Body copy.</p>
</article>
```

## 5. Scripture Card (`.scripture-card`)
Used in the hero and anywhere a verse needs emphasis (e.g. I Said Yes to Jesus page).
```html
<div class="scripture-card">
  <p class="verse-text">"Verse text..."</p>
  <span class="verse-ref">Book Chapter:Verse (KJV)</span>
</div>
```

## 6. Banners
| Class | Use |
|---|---|
| `.page-banner` | Top-of-page hero banner on every inner page (generated by `page_banner()`) |
| `.africa-banner` | The dedicated "Africa Must Be Saved!" homepage banner — signature identity element, do not reuse for other content |
| `.mission-focus` | Wine-red "Mission Focus Today" band |

## 7. Alerts / Status
| Class | Use |
|---|---|
| `.badge-live` | LIVE indicator, prayer alerts, emergency notices, revival highlights — the **only** approved use of warm orange |
| `.legacy-note` | Flags placeholder/legacy content awaiting Project Lead approval — gold-bordered callout |

## 8. Counters (`[data-count-to]`)
Any element with `data-count-to="1234"` animates from 0 to that number when it
scrolls into view (see `js/main.js` → `initCounters`). Respects
`prefers-reduced-motion` by jumping straight to the final value.
```html
<span class="stat-value" data-count-to="128560">0</span>
```

## 9. Forms (`.form-grid`)
Consistent label/input/textarea/select styling for every form on the site
(prayer requests, contact, newsletter, decision form). All forms are currently
placeholder — none are wired to a backend yet; see each page's
`[PLACEHOLDER — connect to backend]` note.

## 10. Section Layouts
| Class | Use |
|---|---|
| `.container` | Max-width content wrapper, use inside every `<section>` |
| `.section-head` | Heading + "View All" link row |
| `.grid-2` / `.grid-3` | Auto-responsive content grids |
| `.content-section` | Standard vertical rhythm for inner-page body sections |
| `.breadcrumb` | Home / Current Page trail, top of every inner page |

## 11. Maintenance Rule
`index.html` and the 10 files under `/pages/` intentionally share identical
header/footer/nav markup. Because this is a dependency-free static site (per
spec: no frameworks, no build step), that markup is duplicated across files
rather than templated at runtime. **`build_pages.py` is the source of truth**
for all inner pages — it regenerates every page from the same header/footer/
banner/breadcrumb functions, so header/nav/footer edits should be made once in
`build_pages.py` and then re-run, never hand-edited per-page. `index.html` is
the one file maintained by hand (its header/nav markup must be kept identical
to the template's output) since the homepage layout diverges structurally
from the inner-page template.

## 12. Media Centre Components (prepared ahead of a future page)
Per Project Lead instruction after the Release Candidate audit: these
are frontend-only components, prepared for a future Media Centre page
that does not exist yet. **No backend endpoint is invented for any of
these** — each one either reuses an already-published AI 1 endpoint
pattern or is explicitly unwired pending a published endpoint. Defined
in `css/media-components.css`.

| Component | Status | Notes |
|---|---|---|
| Sermon Card (`.sermon-card`) | **In use** | `pages/ministries.html` — all 3 sermon cards |
| Broadcast Status Badge (`.broadcast-status`) | **In use** (`.is-live` only) | `pages/radio.html`. `.is-upcoming`/`.is-replay`/`.is-offline` variants are styled and ready but have no current instance — no upcoming/replay data exists to show yet |
| Broadcast Schedule (`.broadcast-schedule`) | **In use** | `pages/radio.html`, wraps the existing `.schedule-table` |
| Video Player (`.video-player`, `.play-button`) | **In use** | Homepage Featured Sermon (via `js/homepage-components.js`) and `pages/ministries.html` sermon cards |
| Audio Player extras (`.audio-progress`, `.audio-time`) | Prepared | Extends the existing `.audio-player` on `pages/radio.html`; not yet populated since there's no live stream to show progress for |
| Media Library grid (`.media-library-grid`, `.media-library-item`) | Prepared | No Media Centre page exists yet |
| Campaign Card (`.campaign-card`) | Prepared | No prayer/fundraising campaign endpoint published by AI 1 yet |
| Media Metadata Card (`.media-metadata-card`) | Prepared | Generic `<dl>`-based key/value display, ready for any media type |
| Podcast Card (`.podcast-card`) | Prepared | No podcast endpoint published by AI 1 yet |
| Broadcast History List (`.broadcast-history-list`) | Prepared | No broadcast-history endpoint published by AI 1 yet |

When AI 1 publishes the corresponding endpoints, these wire into
`HKEcosystem.renderComponent()` exactly like the 8 homepage components
already do — see `API-INTEGRATION.md`. Any field that becomes an
`href`/`src` must follow the safe-rendering standard in
`API-INTEGRATION.md` §8 (DOM property assignment + `sanitizeURL()`,
never string-concatenated into HTML).

## 13. Showcase Carousel (prepared, homepage hero polish pass)
`.showcase-carousel` in `css/home.css` generalizes the proven hero
slideshow pattern (same transition/easing tokens, same reduced-motion
handling) into a reusable rotating-preview component for later use —
e.g. featured ministry highlights, media previews, or an actual
ecosystem screenshot once Project A has a public-facing surface to
show. **Status: Prepared, not placed on any page.** Deliberately not
populated with placeholder "Community Platform" / "Ministry Suite"
preview cards, since Project A has no live UI yet and fabricating a
preview of it would violate this project's sourced-content standard
(see `CONTENT-INTEGRATION-REPORT.md`). Ready to receive real slides
via the same `data-count-to`-style JS wiring pattern already used for
the hero slideshow in `js/main.js` `initSlideshow()`.
