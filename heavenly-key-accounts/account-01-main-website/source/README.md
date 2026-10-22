# Heavenly Key Evangelistic Movement — Public Website
**Project Nehemiah · AI 2's scope in the three-application Heavenly Key ecosystem**

## What This Is
The public, unauthenticated ministry website — one of three applications
sharing a single Cloudflare D1 database (see the sibling Global Christian
Platform and Ministry Management Suite, built by AI 1). This repo covers
the website only: no backend, no database, no AI service layer live here.

## Stack
Vanilla HTML5, CSS3, and ES6+ JavaScript. No build step, no frameworks,
no npm dependencies. Static files, deployable as-is to Cloudflare Pages.

## Structure
```
/index.html              Homepage
/pages/*.html             10 inner pages (about, ministries, missions,
                          events, radio, resources, community, partner,
                          contact, i-said-yes)
/css/                     tokens → base → components → ui-components →
                          home.css / inner.css (load order matters)
/js/
  api-client.js           Generic fetch wrapper + graceful offline fallback
  homepage-components.js  Render functions for the 8 API-driven homepage sections
  ui-components.js        Toast, modal, accordion, tabs, site-wide memory verse
  main.js                 Nav, slideshow, forms, PWA registration
/assets/                  Logo, icons, curated ministry photos
/manifest.json            PWA manifest
/service-worker.js        Offline caching (app-shell cache-first, API network-only)
/offline.html             Shown when offline and nothing cached matches
/build_pages.py           Generates all 10 /pages/*.html from one shared
                          header/footer/banner template — this is the
                          source of truth for page structure; edit here,
                          not the generated HTML files directly, then
                          run `python3 build_pages.py`
```

## Key Documents
| File | What it's for |
|---|---|
| `PROJECT-CHECKLIST.md` | Live status of every page/feature, halt conditions, decision log |
| `COMPARISON-REPORT.md` | Original spec vs. first live-site screenshot |
| `CONTENT-INTEGRATION-REPORT.md` | What real ministry content was sourced from the offline export and where it landed |
| `DATA-ARCHITECTURE.md` | The shared data model, aligned to AI 1's frozen spec |
| `API-INTEGRATION.md` | Every endpoint the site calls, assumed schemas, and the exact steps to go live |
| `AI-PROVIDER-LAYER.md` | Why the website has no AI features of its own (AI 1 owns that layer) |
| `COMPONENT-LIBRARY.md` | Every reusable CSS/JS component and how to use it |
| `DEPLOYMENT.md` | Cloudflare Pages deployment steps (not yet executed — see status) |
| `TESTING-CHECKLIST.md` | What still needs a real browser/device to verify |
| `KNOWN-ISSUES.md` | Documented gaps and limitations, honestly listed |
| `CHANGELOG.md` | Version history |
| `INTEGRATION-READY.md` | Version handshake document for Project A — API contract, component library, token, icon, CSS, and JS versions, accessibility/performance status, last validation date |
| `API-PLACEHOLDER-REGISTRY.md` | Every frontend component waiting for backend data, one table, Connected vs. Waiting |
| `CONTENT-PLACEHOLDER-REGISTRY.md` | Every remaining ministry-supplied content item still needed |
| `FRONTEND-CONTRACT.md` | The frontend's formal promise to Project A — exact loading/empty/error/retry/auth behavior per endpoint |
| `ASSET-INVENTORY.md` | Every file in `/assets/` — purpose, pages used on, placeholder vs. production, optimization status |
| `DESIGN-TOKENS.md` | Every official color/type/spacing/radius/shadow/animation/z-index token and its real usage |
| `FRONTEND-DEFINITION-OF-DONE.md` | The quality checklist every new page or component must satisfy |

## Current Status
> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

Project B's frontend architecture, design system, component library,
and UI specifications are frozen — see `PROJECT-CHECKLIST.md` Section 12
for the full justification and Section 11 for validation results. This
is **not** a claim that the site is finished: official ministry content,
Project A API integration, and live deployment all remain outstanding —
see `INTEGRATION-READY.md`, `API-PLACEHOLDER-REGISTRY.md`, and
`CONTENT-PLACEHOLDER-REGISTRY.md`. Future work is limited to bug fixes,
accessibility improvements, security updates, performance optimisation,
ministry content integration, and Project A API integration. Any
architectural or UX change requires an approved ACR.

**Governing principle:** the frontend remains presentation-focused.
Business rules, security decisions, permissions, validation, workflow
enforcement, and ministry logic belong exclusively to Project A. The
frontend displays and submits data but is never the source of truth for
ministry operations.

**Project B is feature-complete at the design level.** Future work is
limited to implementation, backend integration, ministry content
integration, testing, optimisation, accessibility improvements, and
approved ACR-driven enhancements.

## Content Policy (non-negotiable, carried through every page)
No doctrine, scripture interpretation, or ministry history is invented.
Everything doctrinal is sourced verbatim from the ministry's own offline
export (see CONTENT-INTEGRATION-REPORT.md) or explicitly marked
`[PLACEHOLDER]` pending official text. See PROJECT-CHECKLIST.md Section 7
for the Legacy Preservation Rule this site operates under.
