# INTEGRATION-READY.md
**The handshake document between Project A (backend/Community Platform/
Ministry Management Suite) and Project B (this public website).**

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

This file is the single place to check "what version of the frontend am
I integrating against" — every number below is verifiable against the
actual files in this repository, not asserted.

## Version Table
| Item | Version / Identifier | Source of Truth |
|---|---|---|
| API contract version | Consuming AI 1's **published** endpoint list as of this session (see AI 1's Master Instruction, Section 5) | `API-INTEGRATION.md` |
| Component library version | 1.2.1 | `COMPONENT-LIBRARY.md` |
| Design token version | 1.2.1 (radius/color consolidation this pass) | `css/tokens.css` |
| Icon library version | 1.0 (PIL-generated placeholder set — see `KNOWN-ISSUES.md` §7) | `assets/icons/`, `manifest.json` |
| CSS asset version | `?v=1.2.1` | `css/*.css` links in every page |
| JavaScript asset version | `?v=1.2.1` | `js/*.js` links in every page |
| Accessibility status | 2 real WCAG AA contrast failures found and fixed at the token source; everything else verified in source only — screen reader / keyboard-only / real browser testing still BLOCKED (no browser in this build environment) | `RELEASE-CANDIDATE-AUDIT.md`, `TESTING-CHECKLIST.md` |
| Performance status | Lazy-loading, LCP-aware hero image, asset versioning, and service-worker runtime caching all implemented; Lighthouse/Core Web Vitals numbers themselves BLOCKED (no browser) | `TESTING-CHECKLIST.md` §2 |
| Security status | Attribute-injection pattern (H1) fixed at the utility level (`HKEcosystem.sanitizeURL`); no CSP/security headers configured yet (`_headers` file does not exist — see `RELEASE-CANDIDATE-AUDIT.md` H3, still open) | `RELEASE-CANDIDATE-AUDIT.md` |
| Last full validation run | This session — tag balance, duplicate attributes/IDs, broken links, alt text, JSON-LD, manifest, sitemap/RSS, `node --check` on all JS, CSS brace-balance — 0 failures | `PROJECT-CHECKLIST.md` Section 11 |

## Note: Asset Versioning
The `?v=` cache-busting query string on every CSS/JS link and
`ASSET_VERSION` in `service-worker.js` are kept in manual sync (no
build tooling automates this — see `KNOWN-ISSUES.md` §7). Both were
bumped to `1.2.1` during this documentation pass, having been caught
one version behind (still `1.1.0`) while compiling this handshake
document — corrected immediately rather than left as a known gap,
since it was a one-line fix in three places.

## What "Integration Ready" Means Here
Project A can begin wiring real data to any endpoint marked
**Connected** in `API-PLACEHOLDER-REGISTRY.md` at any time — the
frontend code path already exists and is tested against the documented
assumed shape in `API-INTEGRATION.md` §4. For endpoints marked
**Waiting**, Project A publishing the real contract is the only thing
blocking connection — no frontend rework is anticipated beyond
adjusting `render()` callbacks in `js/homepage-components.js` if the
actual response shape differs from the documented assumption.

## What Is NOT Ready
- Live deployment (`DEPLOYMENT.md` — documented, not executed)
- Server-side validation of any submitted form (client-side only today — see `KNOWN-ISSUES.md` §10)
- CSP/security headers (`_headers` file does not exist yet)
- Counselling — intentionally withheld pending a safeguarding workflow decision, not a version/integration gap
