# API-PLACEHOLDER-REGISTRY.md
**Current public website integration status**

## Connected public forms
| Component | Endpoint | Status |
|---|---|---|
| Ministry prayer request | `POST /api/public/prayer` | Connected; encrypted private intake |
| Public testimony intake | `POST /api/public/testimony` | Connected; encrypted review intake |
| Contact | `POST /api/contact` | Connected |
| Newsletter | `POST /api/newsletter` | Connected |
| Decision for Christ | `POST /api/decisions` | Connected; encrypted follow-up data |
| Partnership inquiry | `POST /api/partner` | Connected |
| Volunteer sign-up | none | Mock adapter |
| Event RSVP | none | Mock adapter |
| Counselling | intentionally withheld | Safeguarding hold |

## Connected homepage reads
| Component | Endpoint | Status |
|---|---|---|
| Latest testimonies | `GET /api/testimonies` | Connected |
| Daily devotional | `GET /api/devotionals` | Connected |
| Upcoming events | `GET /api/events` | Connected |
| Today's Scripture | `GET /api/bible/verse-of-day` | Connected |
| Weekly memory verse | `GET /api/bible/memory-verse` | Connected |

Featured sermon and ministry-update/blog blocks currently use static curated content; production JavaScript does not call unsupported `/api/sermons` or `/api/blog` endpoints.

The automated `check:api-contract` gate is the source of truth for whether every production frontend endpoint has an exact Worker route.
