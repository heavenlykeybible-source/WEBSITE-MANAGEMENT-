# FRONTEND-DEFINITION-OF-DONE.md
**Every new page or component in Project B must satisfy this checklist
before it's considered done.** Written from what this codebase actually
enforces today (see "How This Project Meets It" column) — not an
aspirational list disconnected from real practice.

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

| Requirement | What It Means | How This Project Meets It Today |
|---|---|---|
| Responsive | Works at mobile (375px), tablet (768px), desktop (1280px+) without overflow, hidden content, or broken layout | `@media (max-width: 900px)` / `640px` breakpoints, mobile-first `.grid-2`/`.grid-3` auto-fit patterns. Real-device verification is BLOCKED in this build environment — see `TESTING-CHECKLIST.md` §2 |
| Accessible (WCAG AA) | Color contrast, semantic HTML, ARIA where native semantics fall short | Computed via the real WCAG formula against actual token values (not eyeballed) — see `DESIGN-TOKENS.md`. Two real failures found and fixed at the token source this freeze pass |
| Keyboard accessible | Every interactive element reachable and operable via keyboard alone, visible focus indicator | Global `:focus-visible` outline, no positive `tabindex` anywhere (verified), modal focus trap with Tab/Shift+Tab cycling and Escape-to-close. Real keyboard-only walkthrough is BLOCKED — needs a browser |
| Screen-reader compatible | Landmarks, labels, live-region announcements for dynamic changes | Skip link, `<main>`/`aria-label="Primary"` nav, every form field labeled, `aria-invalid` + live-region validation errors. Real screen-reader testing is BLOCKED — needs NVDA/VoiceOver/TalkBack |
| Design-token compliant | No hand-written hex colors, px spacing, or one-off radius/shadow values where a token exists | Enforced by grep sweep before every freeze (see `PROJECT-CHECKLIST.md` §11) — this pass caught and fixed a duplicate hex, a one-off font-size, and 5 hardcoded pill-radius values |
| Dark-mode ready (if applicable) | N/A unless building toward a dark theme | No dark theme exists. Token structure doesn't block adding one later, but nothing here is "dark-mode ready" today — don't claim it is. See `DESIGN-TOKENS.md` "Dark Mode" section |
| API contract documented | Every endpoint a component reads/writes is recorded before or alongside the code | `FRONTEND-CONTRACT.md` is the required record — endpoint, method, request/response shape, loading/empty/error/retry behavior, auth, mock availability |
| Loading state implemented | Visible feedback while a request is in flight | `.is-loading` shimmer class (read components), disabled submit button + "Sending..." text (write forms) — added this freeze pass after finding forms had none |
| Error state implemented | Failure never produces a blank section or an unhandled exception | Read components fall back to original static content; write forms show a plain-language message in a `.form-status` live region |
| Empty state implemented | Zero-result API responses are handled explicitly, not left blank | `.empty-state` — "Nothing here yet — check back soon." |
| Performance checked | Lazy-loading, no unnecessary render-blocking, images sized appropriately | `loading="lazy"` site-wide except the one LCP-critical hero image (`fetchpriority="high"`); asset versioning for cache-busting; images optimized on the way in (see `ASSET-INVENTORY.md` — this pass caught and fixed a 596K unoptimized photo). Actual Lighthouse numbers are BLOCKED — no browser here |
| Security reviewed | No untrusted data reaches `href`/`src`/`action`/`innerHTML` without validation | `HKEcosystem.escapeHTML()` (text-safe) and `HKEcosystem.sanitizeURL()` (attribute-safe) are mandatory for any API-derived value — see `API-INTEGRATION.md` §8. This is the direct result of a real vulnerability the audit found and this checklist exists partly to prevent recurrence |
| Validation completed | Client-side `checkValidity()` before submission; server-side validation is Project A's responsibility, not assumed by the frontend | Implemented on every form; explicitly documented as client-side-only in `KNOWN-ISSUES.md` §10 rather than silently relied upon |
| Documentation updated | `CHANGELOG.md`, `COMPONENT-LIBRARY.md` status, and any registry this component touches | Every fix pass this session updated the relevant registry in the same turn it made the change — see `CHANGELOG.md` for the pattern to follow |

## What This Checklist Does NOT Cover
Business logic, permissions, workflow enforcement, and ministry-specific
rules are never a frontend concern — see the Final Freeze Statement in
`README.md`. A component can satisfy every line above and still be
"not done" if it tries to enforce a rule that belongs in Project A;
conversely, a component is not blocked from being "done" by the
absence of business logic it was never supposed to implement.

## Using This Checklist
Copy the table into a PR description or task ticket and mark each row.
A row marked "BLOCKED" in the reference column above is expected to
stay blocked until a browser/device/live backend is available — that's
not a failure of this checklist, it's this checklist doing its job by
refusing to claim a passed test that never ran.
