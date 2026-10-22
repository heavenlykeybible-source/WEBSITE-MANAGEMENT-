# AI-PROVIDER-LAYER.md
**Heavenly Key Ecosystem — AI Service Layer**

**Status: Aligned to AI 1's frozen master spec, Sections 7–8.** AI 1 owns
the AI Service Layer entirely — the website (AI 2's scope) never calls
any AI provider directly, matching AI 1's explicit rule: *"Never call AI
providers directly from the frontend."* This document exists only to
record how the website's own content rules already match AI 1's AI
Rules, so the two projects stay philosophically consistent even though
AI 2 builds none of the AI infrastructure itself.

## 1. Ownership
- **AI 1** builds the one AI Service, the provider abstraction, and the Ministry Knowledge Base retrieval layer.
- **AI 2 (this website)** has no AI features of its own. If the website ever surfaces an AI-assisted feature (e.g. a Bible search box, a "find related sermons" widget), it will call AI 1's `/api/search` or equivalent — never a third-party AI API directly.

## 2. Provider Priority (per AI 1 Section 7)
Groq → Cloudflare AI → Hugging Face → Local Llama → Local Gemma → Local
Qwen → future providers, all interchangeable through configuration. Paid
providers (OpenAI, Anthropic, Google) are supported by the interface but
not enabled unless the ministry explicitly adds a key.

## 3. AI Rules (per AI 1 Section 8) — already consistent with this website's content rules
| AI 1's Rule | Already true of AI 2's website |
|---|---|
| AI may suggest Bible verses, categorize prayer requests, detect spam/duplicates, summarize discussions, recommend devotionals, improve search | N/A — website has no AI features; this is entirely AI 1's layer |
| AI must never create ministry doctrine | Matches this site's existing rule: AI 2 has never invented doctrine — see COMPARISON-REPORT.md and CONTENT-INTEGRATION-REPORT.md, where the Statement of Faith and Prayer of Salvation were sourced verbatim, never composed |
| AI must never decide theological disputes | No such feature exists on the website |
| AI must never reveal anonymous users | The website never displays a submitter's name/email/country back to any visitor — see DATA-ARCHITECTURE.md §6 |
| AI must never replace moderator decisions | The website has no moderation capability at all — every submission is a plain `POST` that lands as pending in AI 1's system |

## 4. Ministry Knowledge Base
Per AI 1's Section 3 (Spiritual Resources) and the Knowledge Base concept
this ecosystem is built around, doctrinal answers should be grounded in
the ministry's own Statement of Faith, sermons, articles, Bible studies,
and approved FAQs before falling back to plain scripture. The website
already embodies the same principle structurally: `pages/about.html`
carries the full 22-point Statement of Faith verbatim, and every
doctrinal section on the site cites its source rather than paraphrasing
or inventing — the same standard AI 1's Knowledge Base retrieval should
hold itself to when it exists.

## 5. What This Website Does NOT Need To Build
Per AI 1's ownership of Phase 8 (AI Integration) in full, AI 2 does not
need to: implement a provider router, stand up a vector index, write a
search assistant, or build any spam/duplicate detection. The website's
only obligation is to consume `/api/search` (or equivalent) once AI 1
publishes it, the same way it already consumes `/api/prayer`,
`/api/contact`, `/api/decisions`, and `/api/newsletter`.
