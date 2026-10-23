# PROJECT-CHECKLIST.md
**Project Nehemiah — Heavenly Key Evangelistic Movement Official Website**

> ## ✅ PROJECT B (FRONTEND) — CLOSED
> **Status: Approved — Implementation Ready.**
> Final verdict recorded in `FINAL-APPROVAL-PASS.md`: all 6 authorized
> Final Approval Pass findings resolved and independently re-verified;
> one non-blocking item (320px cumulative overflow, 3 pages) documented
> in `KNOWN-ISSUES.md` §12 for future maintenance, explicitly accepted
> as non-blocking by the Project Lead. No further frontend-only audit
> passes are expected. Next meaningful work is Stage 2 (Cloudflare/
> backend implementation with AI 1).

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**
>
> ## 🧊 FRONTEND ARCHITECTURE & COMPONENT LIBRARY FROZEN
> Project B's frontend architecture, design system, component library,
> and UI specifications are frozen. This is **not** a claim that the
> website is finished — official ministry content (Statement of Faith
> finalization, blog migration, two open content conflicts, two
> placeholder stats), Project A API integration, live deployment, and
> end-to-end testing all remain outstanding. Those are implementation
> tasks, not design work, and are tracked in `INTEGRATION-READY.md`,
> `API-PLACEHOLDER-REGISTRY.md`, and `CONTENT-PLACEHOLDER-REGISTRY.md`.
>
> Future work is limited to: bug fixes, accessibility improvements,
> security updates, performance optimisation, ministry content
> integration, and Project A API integration. **Any architectural or
> UX change requires an approved ACR.**
>
> See Section 12 for the full freeze justification and Section 11 for
> the validation suite results.

Status values: `Not Started` | `In Progress` | `Completed` | `Tested`

> **Governing rule (Project Lead):** Do not invent or modify backend API
> contracts. Use only the published API endpoints from AI 1. Unpublished
> endpoints get a clearly-labeled mock adapter, never a guess treated as
> real. See API-INTEGRATION.md.

## AI 2's Current Phase Structure (Project Lead, this session)
| Phase | Scope | Status |
|---|---|---|
| Phase 1 | Component library, responsive layouts, accessibility, SEO, PWA, performance | Ready for Testing — see Section 4 |
| Phase 2 | Connect every form to the shared API (Prayer, Contact, Newsletter, Testimony, Partner, Decisions, Event Registration, Counselling, Volunteer) | 6 of 9 wired to real published endpoints; 2 built as clearly-labeled mock adapters (Volunteer, Event Registration); Counselling deliberately withheld — see KNOWN-ISSUES.md §1–2 |
| Phase 3 | Connect homepage dynamic widgets | 8 of the requested widgets wired (Testimonies, Devotional, Events, Sermons, Memory Verse, Today's Scripture, Ministry Updates, Verse of Day); Statistics/Lives Transformed intentionally left as real static data — no AI 1 endpoint confirmed, not invented — see API-INTEGRATION.md §5 |
| Phase 4 | Testing, browser compatibility, Lighthouse, Cloudflare Pages deployment, Release Candidate | Docs complete (TESTING-CHECKLIST.md, DEPLOYMENT.md); execution blocked — needs a real browser/device and AI 1's live API; deployment on hold per Project Lead instruction |

AI 1 owns Community Platform, Ministry Management Suite, Workers API, D1,
Auth, AI Service, Notifications, Event Bus, Admin Dashboard — none of
this is or will be built by AI 2.

## 0. Governance
| Item | Status | Notes |
|---|---|---|
| Comparison report vs. approved spec | Completed | See COMPARISON-REPORT.md |
| 4 items flagged for Project Lead decision | Completed | Decisions received and applied — see Section 6 |
| Legacy Preservation Rule adopted | Completed | See Section 7 |
| Offline legacy site content integrated | Completed | See CONTENT-INTEGRATION-REPORT.md — 2 open conflicts still logged below |
| Shared ecosystem data architecture (one DB, three apps) | Completed | See DATA-ARCHITECTURE.md — now aligned to **AI 1's frozen master spec** (received this session); endpoint paths corrected from an earlier `/v1/...` draft to AI 1's actual `/api/...` paths |
| AI Provider Layer + Ministry Knowledge Base architecture | Completed | See AI-PROVIDER-LAYER.md — rewritten to defer entirely to AI 1's AI Service Layer (Sections 7–8); website builds no AI features itself |
| All public forms wired to shared API contract | Completed | Prayer requests → `/api/prayer`, Contact → `/api/contact`, Decisions → `/api/decisions`, Newsletter → `/api/newsletter` — matches AI 1's Section 5 exactly. Fails gracefully with a clear status message until AI 1's Workers API is deployed (`API_BASE` unset by design) |
| Endpoints awaiting confirmation from AI 1 | Open | Sermons, Verse of the Day / Memory Verse, Mission Focus/Nations — not yet in AI 1's published endpoint list; sections are built and ready, just not wired. See DATA-ARCHITECTURE.md §4 |
| Independent Release Candidate audit (v1.1.0) | Completed | See RELEASE-CANDIDATE-AUDIT.md — Decision: **🟡 APPROVED WITH MINOR FIXES**. 0 Critical, 3 High (H1 attribute-injection XSS pattern, H2 WCAG AA contrast failure on default `.badge-live`, H3 no `_headers`/CSP config), 5 Medium, 3 Low findings — all evidence-based, none applied yet per audit's own "report only, do not fix" instruction |

## 1. Foundation
| Item | Status | Notes |
|---|---|---|
| Design token system (colors, type scale) | Completed | css/tokens.css |
| Base/reset stylesheet | Completed | css/base.css |
| Component library (buttons, cards, nav) | Completed | css/components.css |
| Inner-page layout system (banners, breadcrumb, forms) | Completed | css/inner.css |
| Shared JS utilities (nav toggle, scroll text, counters) | Completed | js/main.js |
| Folder/deployment structure for Cloudflare Pages | Completed | /pages, /css, /js, /assets |

## 2. Pages
| Page | Status | Notes |
|---|---|---|
| Home | Completed | index.html — hero illustration + dual CTA applied |
| About | Completed | pages/about.html |
| Ministries | Completed | pages/ministries.html — includes Evangelism School (legacy) |
| Missions | Completed | pages/missions.html — Nations of the World integrated here |
| Events | Completed | pages/events.html |
| Radio | Completed | pages/radio.html — dedicated page per spec |
| Resources | Completed | pages/resources.html |
| Community | Completed | pages/community.html — Digital Revival Room integrated here |
| Partner With Us | Completed | pages/partner.html |
| Contact | Completed | pages/contact.html |
| I Said Yes to Jesus | Completed | pages/i-said-yes.html — salvation-prayer text intentionally left blank pending Project Lead doctrine approval |

**Testing status:** all pages above are `Completed` (built, structurally validated, tag-balance checked). None are yet marked `Tested` — see Section 5 for the definition of Tested and outstanding items before that bar is met.

## 3. Homepage Sections
| Section | Status | Notes |
|---|---|---|
| Top black ministry strip + rotating globe + scrolling text + flags | Completed | |
| Sticky navigation (approved 10-item structure + single CTA) | Completed | No duplicate menus |
| Hero (headline, tagline, dual CTAs, Today's Scripture card) | Completed | |
| Custom family/missionary illustration around laptop | Completed | Placeholder vector — swap for official artwork when supplied |
| Laptop slideshow (6 ministry images) | Completed | Placeholder images |
| Mission Focus Today | Completed | |
| Latest Ministry Updates | Completed | |
| Upcoming Events | Completed | |
| Featured Sermon | Completed | |
| Latest Testimonies | Completed | |
| Prayer Focus for the Nations | Completed | |
| Daily Devotional | Completed | |
| Bible Verse of the Day | Completed | |
| Lives Transformed Counter | Completed | Animated via IntersectionObserver |
| Partner With Us | Completed | |
| Join Global Christian Platform | Completed | |
| Newsletter | Completed | |
| Footer (incl. Weekly Memory Verse) | Completed | |

## 4. Cross-Cutting Requirements
| Item | Status | Notes |
|---|---|---|
| Mobile-first responsive layout | Ready for Testing | Breakpoints in components.css / home.css; needs real-device check |
| SEO (meta, OG, Twitter cards, schema, canonical, sitemap, robots.txt) | Ready for Testing | Per-page unique title/description/canonical + BreadcrumbList JSON-LD |
| Accessibility (ARIA, keyboard nav, contrast, skip link, reduced-motion, active-nav indicator) | Ready for Testing | Needs a real screen-reader pass (see Section 5) |
| Lazy loading images + LCP handling | Ready for Testing | `loading="lazy"` + fade-in everywhere except the first/LCP hero image, which loads eagerly with `fetchpriority="high"` |
| CSS-first animation | Ready for Testing | Ticker, spin, pulse, slideshow all CSS-driven; respects `prefers-reduced-motion` |
| Security (no inline JS, escaped placeholder output) | Ready for Testing | All JS external in js/main.js; forms use `fetch` + JSON, no inline handlers |
| Reusable component library | Ready for Testing | See COMPONENT-LIBRARY.md; utility classes (`u-text-center`, `u-mt-*`, etc.) added this pass to cut down on repeated inline styles |
| Duplicate-code / structural validation | Completed | Automated checks now run on every rebuild: tag balance, duplicate `class=` attributes, duplicate `id=` values — all passing across all 11 pages |
| Prepared for backend integration | Ready for Testing | All 4 live forms wired to AI 1's exact `/api/...` contract (see DATA-ARCHITECTURE.md); fails gracefully until AI 1's Workers API is deployed |
| Cloudflare Pages deployment docs | Not Started | Still on hold per your instruction — write only once the above is signed off |

## 5. Definition of "Tested" (not yet reached for any page)
A page moves from `Completed` to `Tested` only after:
- Real browser check (desktop + mobile viewport) once handed to a live preview environment
- Lighthouse/perf pass confirming homepage loads target (<2s) on throttled connection
- Screen-reader pass (nav, forms, skip link)
- All `[PLACEHOLDER]` content reviewed against official ministry text where supplied
This step requires either a live deployment or browser tooling not available in this build environment — flagged for the Project Lead / QA step before go-live.

## 6. Project Lead Decisions Applied
| # | Decision | Applied |
|---|---|---|
| 1 | Hero visual: custom vector illustration, no stock photos | ✅ assets/family-illustration-placeholder.svg in index.html |
| 2 | Navigation: approved 10-item structure + single CTA, no duplicate menus | ✅ All pages use identical nav via build_pages.py template |
| 3 | Dual CTA: primary "I Said Yes to Jesus", secondary "Join the Rescue Mission" | ✅ Applied in header + hero + page banners |
| 4 | Legacy sections mapped, not deleted | ✅ See Section 7 |

## 7. Legacy Preservation Rule
> Before removing, renaming, or merging any page, feature, or ministry program from the existing website, first map it to the new information architecture. If no suitable location exists, add it to the Legacy Review list below. Never delete ministry content or features without explicit Project Lead approval.

### Legacy Mapping Applied
| Legacy Item (existing site) | New Location | Status |
|---|---|---|
| Nations of the World (top-level nav item) | Integrated into Missions page + homepage Mission Focus Today | Mapped |
| Membership Portal | Replaced by Join Global Christian Platform (Community page) | Mapped |
| Digital Revival Room | Featured resource on Community page, pending full build-out | Mapped |
| Evangelism School | Included under Ministries and Resources pages | Mapped |

### Legacy Review List (no confirmed new home yet — awaiting Project Lead)
| Legacy Item | Notes |
|---|---|
| Member Login (top utility bar) | Resolved — see Section 6, item 1 |
| "AFRICA MUST BE SAVED!" call-out box | Resolved — see Section 6, item 2 |
| 94 blog posts in `/posts/` | Substantial teaching archive by the founder. 3 real titles surfaced on homepage as preview; full migration into the new design system is a separate effort, not yet scheduled. |
| ~70 unused images from the offline export | Curated subset (logo, founder photo, 6 outreach photos) is in use; remaining images available for a future gallery/testimonies build-out. |
| Hero headline/tagline wording | **Open conflict** — real site says "REVIVAL, HOLINESS, POWER!"; approved spec says "Taking Christ to the Nations of the World." Currently running the approved spec version. See CONTENT-INTEGRATION-REPORT.md §2. |
| Headquarters address | **Open conflict** — screenshot said "Warri, Delta State, Nigeria"; offline export only has "Nigeria, Africa." Currently showing "Nigeria, Africa" site-wide. See CONTENT-INTEGRATION-REPORT.md §2. |
| Bibles Distributed / Partners & Supporters stats | No real source numbers found — still `[PLACEHOLDER]`, not invented. |

## 8. Halt Conditions Log
| Date | Item | Reason | Resolution |
|---|---|---|---|
| — | Hero illustration vs. photography | Doctrine/presentation decision | Resolved — illustration approved |
| — | Navigation structure (spec vs. current site) | Structural decision | Resolved — spec structure approved |
| — | Primary CTA wording | Ministry-voice decision | Resolved — dual CTA approved |
| — | Legacy sections (Nations of World, Membership Portal, etc.) | Content ownership decision | Resolved — mapped, see Section 7 |
| — | Statement of Faith / salvation prayer wording | Doctrine — AI 2 does not compose doctrinal text | **Open** — About page and I Said Yes to Jesus page have marked blanks awaiting official text |
| — | Existing site content handoff | Needed to replace remaining `[PLACEHOLDER]` copy throughout | **Open** — awaiting Project Lead to supply current site content |

## 9. Phase 2 Form Wiring — Detail
| Form | Endpoint | Status |
|---|---|---|
| Prayer Requests | `POST /api/prayer` | Wired — real published endpoint |
| Contact | `POST /api/contact` | Wired — real published endpoint |
| Newsletter | `POST /api/newsletter` | Wired — real published endpoint |
| Decisions for Christ | `POST /api/decisions` | Wired — real published endpoint |
| Testimony submission | `POST /api/testimonies` | Wired — real published endpoint (new this pass, `pages/community.html`) |
| Partnership inquiry | `POST /api/partner` | Wired — real published endpoint (new this pass, `pages/partner.html`) |
| Volunteer sign-up | *(no published endpoint)* | Mock adapter — modal on `pages/partner.html`, clearly labeled not-connected |
| Event Registration/RSVP | *(no published endpoint)* | Mock adapter — modal on `pages/events.html`, clearly labeled not-connected |
| Counselling | *(none — deliberately not built)* | **Safeguarding halt condition** — see KNOWN-ISSUES.md §1. Needs explicit Project Lead + AI 1 sign-off on a safeguarding workflow before any intake form is built, not just an API endpoint |

## 10. Release Candidate Artifacts
| Document | Status |
|---|---|
| README.md | Completed |
| CHANGELOG.md | Completed |
| DEPLOYMENT.md | Completed (documented, not executed) |
| API-INTEGRATION.md | Completed |
| TESTING-CHECKLIST.md | Completed |
| KNOWN-ISSUES.md | Completed |
| COMPONENT-LIBRARY.md | Completed (pre-dates this pass; still accurate) |

## 11. Final Validation Suite (re-run after the Frontend Design Freeze pass)
All checks below were actually executed against the real files this
pass, not assumed — see chat history for the exact commands.

| Check | Result |
|---|---|
| HTML tag balance (11 pages) | ✅ 0 failures |
| Duplicate `class=` attributes | ✅ 0 found |
| Duplicate `id=` values | ✅ 0 found |
| Broken internal links (`href`/`src` resolution, all 12 HTML files incl. `offline.html`) | ✅ 0 broken |
| Missing image alt text | ✅ 0 of 24 `<img>` tags |
| JSON-LD validity | ✅ all blocks parse as valid JSON |
| `manifest.json` validity + icon file existence | ✅ valid, all 10 icons exist on disk |
| `sitemap.xml` / `rss.xml` well-formedness | ✅ both valid XML |
| `sitemap.xml` completeness (every real page listed, no phantom entries) | ✅ exact match |
| Meta/landmark presence (lang, viewport, title, description, canonical, OG, JSON-LD, skip-link, `<main>`) | ✅ all 11 pages |
| JS syntax (`node --check`, all 5 files) | ✅ all pass |
| CSS brace balance (all 7 files) | ✅ all balanced |
| Color-token contrast (all real usages, computed via WCAG formula) | ✅ all pass (2 fixed this pass — see CHANGELOG 1.2.0) |
| Security: attribute-injection sweep (`href="${`/`src="${` patterns) | ✅ 0 found in real code |

**Not run — genuinely requires a browser/device/live backend, honestly
marked BLOCKED rather than assumed:** Lighthouse/Core Web Vitals, real
responsive rendering, screen reader behavior, keyboard-only navigation,
PWA install/offline behavior on a real device, any live API integration
test. See `TESTING-CHECKLIST.md` for the complete list.

## 12. Frontend Design Freeze Justification
Walked all 11 pages against the Project Lead's requested personas,
grounded in what's actually in the source (not a live-browser
walkthrough, which remains BLOCKED):

- **First-time visitor / new believer:** Homepage → "I Said Yes to Jesus" is the primary CTA in the header, hero, and every page banner; `pages/i-said-yes.html` has real scripture, the real 5-step salvation process, and the real prayer text sourced verbatim — no invented doctrine anywhere in that path.
- **Returning member / ministry worker:** Login shortcut in every page's nav routes to the Global Christian Platform per the single-sign-on decision; Partner/Give, Events, and Contact are reachable from every page via the identical nav, footer, and breadcrumb structure (enforced by `build_pages.py` being the one template source).
- **Mobile user:** Sticky nav collapses to a toggled off-canvas menu below 900px; all touch targets use the `.btn` padding scale; forms stack via `.form-grid`'s single-column default.
- **Desktop user:** Grid layouts (`.grid-2`, `.grid-3`) and the hero's two-column layout only apply above the 900px breakpoint, verified in the CSS source.
- **Accessibility user:** Skip link, ARIA landmarks, labeled form fields with live-region error announcements, `prefers-reduced-motion` handled in every animation, focus-visible styling site-wide, and the two real contrast failures found by the audit are fixed at the token source — all verified in source, still pending a real screen-reader pass (BLOCKED, honestly listed in `TESTING-CHECKLIST.md`).
- **Does it communicate trust?** Every doctrinal and biographical claim on the site is sourced verbatim from the ministry's own offline export (`CONTENT-INTEGRATION-REPORT.md`), not generated — the two remaining `[PLACEHOLDER]` categories (blog migration, two stat numbers) are clearly marked rather than filled with invented content.

**Freeze criteria met:**
- [x] No duplicated design tokens remain (radius, color, shadow, transition — all consolidated or confirmed already-token-based this pass)
- [x] No unnecessary inline styling remains (the two redundant footer color overrides removed; remaining inline `style=` attributes are one-off layout tweaks, not duplicated values)
- [x] Shared components consistent (spacing/type/radius scale verified via grep; icon stroke-width variance confirmed intentional, not accidental)
- [x] Documentation matches implementation (CHANGELOG/COMPONENT-LIBRARY now carry explicit In-use/Available/Prepared status per the audit's M2 finding)
- [x] Validation passes cleanly (Section 11 above)
- [x] Accessibility issues resolved or honestly documented (2 real WCAG AA failures fixed; everything unverifiable without a browser is listed, not assumed)
- [x] Remaining blockers are external (AI 1's API schemas, ministry content for blog/stats/hero-wording/HQ-address decisions, live deployment) — not frontend quality issues

**Declared: Project B's frontend architecture, design system, component
library, and UI specifications are frozen (Frontend Design Freeze
Complete, v1.2.2).** The website itself is not "finished" — ministry
content, Project A API integration, and live deployment remain
outstanding, tracked separately in `INTEGRATION-READY.md`,
`API-PLACEHOLDER-REGISTRY.md`, and `CONTENT-PLACEHOLDER-REGISTRY.md`.
No further architectural or UX change without an approved ACR; bug
fixes, accessibility improvements, security updates, performance
optimisation, ministry content integration, and Project A API
integration remain in scope.

**Governing principle** (see `README.md` for the full statement): the
frontend remains presentation-focused. Business rules, security
decisions, permissions, validation, workflow enforcement, and ministry
logic belong exclusively to Project A.
