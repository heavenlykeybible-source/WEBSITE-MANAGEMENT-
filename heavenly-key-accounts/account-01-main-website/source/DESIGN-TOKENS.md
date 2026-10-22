# DESIGN-TOKENS.md
**Every official design token, defined once in `css/tokens.css`.**
Usage counts below are real (`grep -rc "var(--token)" css/*.css`), not
estimated. This is the single source of truth for future UI work — no
new color, spacing, radius, shadow, or animation value should be
hand-written when an existing token already covers it.

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

## Color Tokens
| Token | Value | Purpose | Real usage count |
|---|---|---|---|
| `--color-royal-blue` | `#1B3A6B` | Primary brand blue — header gradients, nav accents | 10 |
| `--color-royal-blue-dark` | `#12274A` | Darker gradient stop, dark section backgrounds | multiple |
| `--color-wine` | `#7A1B2B` | Primary brand wine red — buttons, links, eyebrows | 16 |
| `--color-wine-dark` | `#5A1420` | Hover state for wine elements | multiple |
| `--color-gold` | `#C9A227` | Accent — button text, highlights | 14 |
| `--color-gold-light` | `#E4C766` | Lighter accent — text on dark backgrounds, footer links | multiple |
| `--color-white` | `#FFFFFF` | Base white | multiple |
| `--color-charcoal` | `#1A1A1A` | Dark backgrounds (footer, top strip) | 16 |
| `--color-charcoal-soft` | `#262626` | Slightly lighter dark surface (memory-verse box) | multiple |
| `--color-text` | `#333333` | Body text default | multiple |
| `--color-text-muted` | `#5C5C5C` | Secondary/muted text | multiple |
| `--color-warm-orange` | `#B94709` (changed from `#E8590C` this freeze pass — see below) | Reserved: LIVE badges, prayer alerts, emergency notices, revival highlights only | 6 |
| `--surface-alt` | `#F6F5F2` | Alternating section background | multiple |
| `--surface-dark` | `var(--color-charcoal)` | Alias | n/a |
| `--surface-page` | `var(--color-white)` | Alias | n/a |
| `--border-subtle` | `#E3E1DC` | Card/input borders | multiple |

### Warm-orange value history (flag, not a footnote)
Original brand value `#E8590C` failed WCAG AA (3.58:1) in its two real
uses (`.badge-live` background-with-white-text, `.prayer-count`
text-on-white). Replaced with `#B94709` (5.29:1/4.85:1, both pass) —
same hue family, not a rebrand. This is a placeholder-safe fix, not a
final brand decision — if the ministry's actual brand guidelines
specify an exact orange, that value should be re-validated for contrast
before replacing this one. See `RELEASE-CANDIDATE-AUDIT.md` H2.

## Typography Tokens
| Token | Value | Purpose |
|---|---|---|
| `--font-display` | `"Fraunces", Georgia, serif` | Headings, scripture quotes |
| `--font-body` | `"Source Sans 3", "Segoe UI", Arial, sans-serif` | Body text |
| `--font-utility` | `"IBM Plex Mono", monospace` | Eyebrows, small labels |
| `--text-xs` through `--text-4xl` | `0.75rem` to `3rem` (8-step scale) | Full type scale — every font-size in the codebase uses one of these (1 hardcoded exception found and fixed this pass, see CHANGELOG 1.2.1) |
| `--leading-tight` / `--leading-normal` / `--leading-relaxed` | `1.15` / `1.5` / `1.7` | Line-height scale |

## Spacing Tokens
| Token | Value |
|---|---|
| `--space-1` through `--space-7` | `0.5rem` to `6rem`, roughly doubling on an 8px base |

## Radius Tokens
| Token | Value | Purpose |
|---|---|---|
| `--radius-sm` | `4px` | Buttons, inputs |
| `--radius-md` | `8px` | Cards, images |
| `--radius-lg` | `16px` | Large containers |
| `--radius-pill` | `999px` | Badges, pills — added this freeze pass, consolidating 5 previously-hardcoded `999px` declarations |

## Shadow Tokens
| Token | Value | Purpose |
|---|---|---|
| `--shadow-card` | `0 2px 12px rgba(26,26,26,0.08)` | Default card elevation |
| `--shadow-raised` | `0 8px 28px rgba(26,26,26,0.14)` | Modal, header, elevated hero elements |

## Animation Tokens
| Token | Value | Purpose |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | All transitions |
| `--duration-fast` | `150ms` | Hover/focus micro-interactions |
| `--duration-base` | `300ms` | Standard transitions (nav, modal) |
| `--duration-slow` | `600ms` | Slideshow crossfade |
| (all three) | forced to `0ms` inside `@media (prefers-reduced-motion: reduce)` | Global reduced-motion override |

## Z-Index Layers
Did not exist as tokens before this freeze pass — 4 hardcoded values
(`1000`, `100`, `1000`, `900`) were found scattered across 3 files with
no documented layering rationale. Consolidated:
| Token | Value | Purpose |
|---|---|---|
| `--z-header` | `100` | Sticky site header |
| `--z-modal` | `900` | Modal windows |
| `--z-toast` | `1000` | Toast notification region |
| `--z-skip-link` | `1000` | Skip-to-content link (only visible on focus) |

Toast and skip-link intentionally share the top layer — they never
appear simultaneously in practice (skip-link only shows on initial
keyboard focus at page load; toasts fire later in the session), so no
real stacking conflict exists despite the equal value.

## Layout Tokens
| Token | Value | Purpose |
|---|---|---|
| `--max-width` | `1280px` | `.container` max width |
| `--header-strip-height` | `40px` | Top ministry ticker height |

## Dark Mode
No dark theme exists. Not attempted this pass — out of scope for the
current design brief, and not requested by the Project Lead at any
point. If added later, the token structure here (especially
`--surface-*` and `--color-charcoal*`) is already organized to support
a `prefers-color-scheme: dark` override without restructuring, but none
exists today. Documented here so no one assumes dark mode is "ready"
just because tokens are centralized.
