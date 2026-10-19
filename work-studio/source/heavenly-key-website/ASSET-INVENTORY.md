# ASSET-INVENTORY.md
**Every file in `/assets/`.** Verified against the actual filesystem
this session — file sizes are real, "used on" is grep-verified, not
assumed.

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

## Logos
| File | Purpose | Used On | Type | Optimized? |
|---|---|---|---|---|
| `assets/ministry/logo.png` | Real ministry logo, header brand mark | Every page (header) | Production | Yes — resized to 200x200, 104K to 52K this pass |

## Hero / Illustration
| File | Purpose | Used On | Type | Optimized? |
|---|---|---|---|---|
| `assets/family-illustration-placeholder.svg` | Approved hero illustration (family + missionary around laptop) | Homepage hero | Placeholder — approved for design purposes pending official ministry artwork, see `COMPARISON-REPORT.md` decision #1 | N/A (hand-authored SVG, inherently small — 4K) |

## Ministry Photos (real content, sourced from offline export)
| File | Purpose | Used On | Type | Optimized? |
|---|---|---|---|---|
| `assets/ministry/outreach-1.jpg` through `outreach-5.jpg` | Homepage hero slideshow | Homepage | Production | Yes — resized to max 900px, stripped metadata, this pass (136K to 116K etc.) |
| `assets/ministry/outreach-6.png` | Not currently placed | none | Production, unused | No — not touched this pass since it isn't rendered anywhere yet |
| `assets/ministry/pastor-emmanuel-adiohwo.jpg` | Founder photo, Leadership section | `pages/about.html` | Production | Yes — converted PNG to JPEG, resized 834x1250 to 534x800, 596K to 40K (93% reduction) this pass. Was previously unoptimized despite being in active use |
| `assets/ministry/ministries-header.jpg` | Not currently placed | none | Production, unused | No |
| `assets/ministry/partnership-header.jpeg` | Not currently placed | none | Production, unused | No |
| `assets/ministry/sermons-header.jpg` | Not currently placed | none | Production, unused | No |
| `assets/ministry/where-will-you-spend-eternity.png` | Not currently placed | none | Production, unused | No |
| `assets/ministry/all-have-sinned.png` | Not currently placed | none | Production, unused | No |

**5 of 13 ministry photos are currently unused** — kept for a future
gallery per `KNOWN-ISSUES.md` §11, not deleted since they're real
sourced content, not dead code. They were not optimized this pass since
optimizing an asset nothing renders yet is low priority versus the ones
actually shipping to visitors — flagged here so whoever places them
later knows to optimize on the way in, not after.

## PWA Icons
| File | Purpose | Used On | Type | Optimized? |
|---|---|---|---|---|
| `assets/icons/icon-{72,96,128,144,152,192,384,512}.png` (8 files) | PWA manifest icon set | `manifest.json`, referenced from every page's `<head>` | Placeholder — PIL-generated text-on-circle, not official ministry brand assets, see `KNOWN-ISSUES.md` §7 | Yes — generated at exact target sizes, ~1-8K each, no re-compression needed |
| `assets/icons/icon-maskable-{192,512}.png` | Android adaptive icon (maskable safe-zone padding) | `manifest.json` | Placeholder, same as above | Yes |
| `assets/favicon.svg` | Browser tab icon | Every page's `<head>` | Placeholder — matches the icon set's placeholder status | N/A (hand-authored SVG) |

## Fonts
| Source | Purpose | Used On | Type | Optimized? |
|---|---|---|---|---|
| Google Fonts (Fraunces, Source Sans 3, IBM Plex Mono) | Display/body/utility typefaces | Every page, loaded via `<link>` with `display=swap` | Production, third-party hosted | N/A — not a local asset; `font-display: swap` set to avoid render-blocking, actual load performance is BLOCKED (needs a real network trace, see `TESTING-CHECKLIST.md`) |

## Videos / Audio
**None exist as local assets.** All video is embedded via external
YouTube links (youtube.com, i.ytimg.com for thumbnails) — no video
files are hosted by this site. No audio files exist; `pages/radio.html`'s
audio player links out to YouTube/Facebook live broadcasts rather than
hosting a stream.

## SVG Assets (inline, not files)
The top ministry ticker's globe icon, nav hamburger icon, country flag
icons, and the Africa-outline illustration on the homepage banner are
all inline `<svg>` markup in `index.html`/`build_pages.py`, not
separate files — intentional, since they're small enough that a
separate HTTP request per icon would cost more than it saves.

## Duplicate-Asset Check (this pass)
Cross-referenced every filename against every page's markup — no
duplicate assets found (each file serves exactly one purpose, no two
files contain the same image at different names).
