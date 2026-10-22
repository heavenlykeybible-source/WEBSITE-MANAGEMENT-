# DATA-ARCHITECTURE.md
**One Database, Three Applications — Heavenly Key Ecosystem**

**Status: Aligned to AI 1's frozen master spec (Community & Ministry
Management AI 1 — Master Instruction, v1.0, Approved).** AI 1 owns the
backend, API, and database design. This document records how the public
website (AI 2's scope) consumes that contract — it is not a competing
spec. Where an earlier draft of this file used different endpoint names
(`/v1/...`), those have been corrected to match AI 1's frozen `/api/...`
paths below.

## 1. Architecture (as frozen by AI 1)
```
Public Website (AI 2)
          │
Global Christian Platform
          │
Ministry Management Suite
          │
          ▼
 Cloudflare Workers API
          │
          ▼
 Cloudflare D1 Database
          │
          ▼
Cloudflare KV / R2 / Cache
```
One database. No duplicated data. Every application — including this
website — calls the same API.

## 2. The Website's Role
The website is a **read-mostly consumer**:
- **Reads** approved/published content (testimonies, prayer focus, devotionals, sermons, events, verse of the day, memory verse, blog, gallery) to render its existing sections.
- **Submits** new user-generated content, which always lands as pending and is never shown back to the visitor directly — moderation happens in the Ministry Management Suite (AI 1's scope), consistent with this site's existing Legacy Preservation and doctrine rules that AI 2 never makes moderation or doctrinal calls.
- **Never** calls moderation, admin, or role-management endpoints.

## 3. Endpoints the Website Currently Uses or Targets
Per AI 1's shared API list (Section 5 of the master spec), the website's
forms are wired to:

| Website Form | Endpoint | Method |
|---|---|---|
| Prayer Requests (`pages/community.html#prayer`) | `/api/prayer` | POST |
| Contact (`pages/contact.html`) | `/api/contact` | POST |
| Decision for Christ (`pages/i-said-yes.html`) | `/api/decisions` | POST |
| Newsletter (homepage) | `/api/newsletter` | POST |

Not yet wired, but planned once the corresponding homepage/page sections
move from static placeholder to live data:

| Website Section | Endpoint |
|---|---|
| Latest Testimonies (homepage + Community) | `/api/testimonies` |
| Daily Devotional | `/api/devotionals` |
| Kingdom Keys | `/api/kingdom-keys` |
| Events | `/api/events` |
| Radio Schedule | `/api/radio` |
| Gallery / slideshow | `/api/gallery` or `/api/media` |
| Partner / Give | `/api/partner` |
| Blog / Latest Ministry Updates | `/api/blog` |

## 4. Open Items for AI 1 (not resolved by AI 2)
The following website sections have no matching endpoint in AI 1's
published Section 5 list yet — flagged rather than guessed at:
- Sermons (Featured Sermon section, `pages/ministries.html#sermons`)
- Bible verse of the day / weekly memory verse (homepage + footer)
- Mission Focus Today / Nations of the World / mission reports (`pages/missions.html`)

The website has sections ready to go live for all of these the moment
endpoint names are confirmed.

## 5. Event-Driven Publishing (per AI 1 Section 6)
The website does not implement any of this logic itself — it simply
re-renders whatever `/api/testimonies?status=approved` (etc.) returns.
The actual fan-out (e.g. "Testimony Approved → publish to homepage +
Community + archive + counters") is entirely AI 1's responsibility. A
moderator approval on AI 1's side should be reflected on the website's
next page load with no separate publish step needed here.

## 6. Privacy Alignment
Per AI 1's Section 9 (Security), anonymous identities stay protected
unless revealed through the approved Super Administrator workflow. The
website's forms only ever collect name/email/country/message and submit
them; it never displays a submitter's contact details anywhere, matching
AI 1's anonymity guarantee.
