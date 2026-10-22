# FRONTEND-CONTRACT.md
**The frontend's promise to Project A.** Every row below describes
behavior that actually exists in the code today, verified against
`js/main.js`, `js/api-client.js`, and `js/homepage-components.js` this
session — not aspirational.

> **Project B — Frontend Design Freeze**
> **Version 1.2.2 · Status: Architecture Frozen · Implementation Ready**

## Write Endpoints (form submissions)

| Field | Prayer | Contact | Newsletter | Decisions | Testimony | Partner |
|---|---|---|---|---|---|---|
| Endpoint | `/api/prayer` | `/api/contact` | `/api/newsletter` | `/api/decisions` | `/api/testimonies` | `/api/partner` |
| Method | POST | POST | POST | POST | POST | POST |
| Request format | `application/json`, `Object.fromEntries(FormData)` — field names match each form's `name=` attributes exactly | same | same | same | same | same |
| Response format expected | Any 2xx = success (body not parsed) | same | same | same | same | same |
| Loading state | Submit button disabled + text changes to "Sending..." for the duration of the request | same | same | same | same | same |
| Empty state | N/A (write-only) | N/A | N/A | N/A | N/A | N/A |
| Error state | Generic message in the form's `.form-status` live region: "Something went wrong sending this. Please try again or contact us directly." Does not surface the actual HTTP status/body to the user | same | same | same | same | same |
| Retry behavior | None automatic. Single attempt per click; user must manually resubmit. No backoff, no queueing, no offline-then-retry | same | same | same | same | same |
| Client-side validation | HTML5 `checkValidity()` on `[required]` fields before any request is made; first invalid field gets `aria-invalid="true"` + focus + an announced message | same | same | same | same | same |
| Authentication required | None — anonymous public submission | same | same | same | same | same |
| Mock available | No — real endpoint | No | No | No | No | No |

## Write Endpoints — Mock Adapters (no published endpoint)

| Field | Volunteer Sign-up | Event Registration |
|---|---|---|
| Endpoint | none — `/api/volunteers` assumed, unpublished | none — assumed sub-path of `/api/events`, unpublished |
| Method | N/A | N/A |
| Request/response format | N/A | N/A |
| Loading state | N/A — no request is ever sent | N/A |
| Empty/Error state | N/A | N/A |
| Retry behavior | N/A | N/A |
| Authentication required | N/A | N/A |
| Mock available | Yes — form is fully built (modal, validation) and on submit shows a fixed message identifying it as not connected. See `data-mock-message` on each `<form>` in `pages/partner.html` / `pages/events.html` | Yes, same pattern |

## Read Endpoints (homepage live components)

| Field | Testimonies | Devotional | Events | Blog | Scripture/Memory Verse* | Sermon* |
|---|---|---|---|---|---|---|
| Endpoint | `GET /api/testimonies` | `GET /api/devotionals` | `GET /api/events` | `GET /api/blog` | `GET /api/bible/verse-of-day`, `/memory-verse` | `GET /api/sermons` |
| Query params | `status=approved&limit=3` | `limit=1&sort=recent` | `status=published&when=upcoming&limit=3` | `status=published&limit=3` | none | `limit=1&sort=recent` |
| Response format expected | `{ items: [{name, location, content}] }` (assumed unwrap logic accepts `.items`, `.results`, or a bare array) | `{ items: [{title, excerpt, body}] }` | `{ items: [{title, description, location, start_time}] }` | `{ items: [{title, excerpt, category, url}] }` | `{text, reference}` or `{item: {text, reference}}` | `{ items: [{title, description, video_url, thumbnail_url}] }` |
| Loading state | `.is-loading` class (CSS shimmer animation) applied to the container while the request is in flight | same | same | same | same | same |
| Empty state | `<p class="empty-state">Nothing here yet — check back soon.</p>` if the response has zero items | same | same | same | same (single-item endpoints treat a missing item as empty) | same |
| Error state | Falls back to the page's original static, curated content (not a generic error message) — see "graceful degradation" below | same | same | same | same | same |
| Retry behavior | None automatic. Runs once on `DOMContentLoaded`; a failed request is not retried without a full page reload | same | same | same | same | same |
| Authentication required | None — public read | same | same | same | same | same |
| Mock available | No — falls back to real, already-sourced static content instead of a mock (see `CONTENT-INTEGRATION-REPORT.md`) | same | same | same | same | same |

\* Marked **Waiting (assumed shape)** in `API-PLACEHOLDER-REGISTRY.md` — endpoint path is a documented guess, not confirmed by AI 1.

## Graceful Degradation (applies to every read component above)
This is the core promise: **`API_BASE` is `null` today, and every read
component's behavior when `API_BASE` is unset is identical to its
behavior on a network failure** — the page's original static, sourced
content stays exactly as shipped. There is no code path where a read
component shows a blank section, a spinner that never resolves, or a
raw error message to a visitor. See `js/api-client.js`
`renderComponent()` for the implementation, and `API-INTEGRATION.md`
§8 for the security rule governing how any attribute-bearing field
(`href`/`src`) from these responses must be rendered.

## Security Note (repeated here deliberately)
Every field in every response above is treated as untrusted. Text
fields are escaped via `HKEcosystem.escapeHTML()` before insertion.
Any field used as `href`/`src` (sermon `video_url`/`thumbnail_url`,
blog `url`) is validated via `HKEcosystem.sanitizeURL()` and assigned
as a DOM property, never string-concatenated into HTML. See
`RELEASE-CANDIDATE-AUDIT.md` H1 for why this matters.
