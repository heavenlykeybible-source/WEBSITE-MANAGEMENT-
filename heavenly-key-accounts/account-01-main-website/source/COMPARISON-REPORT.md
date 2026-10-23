# Comparison Report — Current Homepage vs. Approved Specification
**Project Nehemiah — Heavenly Key Evangelistic Movement Official Website**
**Prepared by:** AI 2 (Lead Frontend Engineer/UI-UX)
**Status:** For Project Lead review

---

## 1. Method
The current homepage screenshot was reviewed section-by-section against the Master Prompt (Version 1.0). No ministry wording, doctrine, or statistics from the screenshot have been altered in this report — they are only catalogued for comparison purposes.

---

## 2. Elements That MATCH the Specification

| Spec Requirement | Status |
|---|---|
| Black top strip with rotating world icon + scrolling text ("Taking Christ to the Nations of the World", "Africa Must Be Saved") | ✅ Present |
| Small SVG country flags scrolling in top strip | ✅ Present |
| Sticky navigation with core menu items | ✅ Present (though menu items differ — see below) |
| Hero headline + tagline + CTA buttons | ✅ Present, close to spec wording |
| Today's Scripture-style card concept | ⚠️ Present as icon row, not the described dedicated card — see gaps |
| Laptop illustration with 6-slide ministry slideshow | ✅ Present, matches slide list almost exactly (spec: Crusade, Revival Meeting, Open-Air Evangelism, Prayer Gathering, Children's Outreach, Mission Field → screenshot: Crusade, Revival Meeting, Open-Air Evangelism, Bible Training, Prayer Gathering, Missions & Outreach) |
| Events, Testimonies, Prayer Focus sections present on homepage | ✅ Present |
| Footer with contact, social links, location | ✅ Present |
| Colour usage: royal blue, wine red, gold accents, warm orange for alerts | ✅ Broadly consistent |

---

## 3. Gaps, Mismatches & Omissions

### 3.1 Hero Section
- **Illustration mismatch:** Spec calls for a **custom vector illustration** of a modestly dressed Christian family (father, mother with head covering, boy, girl with modest head covering, missionary) looking at the laptop — described explicitly as a placeholder until official artwork arrives, and explicitly **"Do NOT use stock photos."** The current screenshot uses **real photographs** of women and a man, not a vector illustration, and dress/head-covering details do not match the modesty specification (no head coverings visible). **This is a direct conflict with an explicit spec instruction and is flagged for Project Lead decision** — not to be resolved unilaterally.
- **Today's Scripture card:** Spec calls for a distinct card showing Verse, Reference, and a "Read Chapter" button linking to a future KJV Bible module. This is not present in its specified form; the homepage instead shows a generic icon-based feature row.

### 3.2 Navigation
- Spec menu: Home, About, Ministries, Missions, Events, Radio, Resources, Community, Partner With Us, Contact, plus a prominent **"I Said Yes to Jesus"** button.
- Screenshot menu: Home, About Us, Ministries, Nations of the World, Media, Events, Training & Discipleship, Resources, Give — plus top-bar links (Prayer Request, Testimonies, Give/Support, Member Login) and a **"JOIN THE RESCUE MISSION"** button instead of "I Said Yes to Jesus."
- This is a substantive structural difference (extra items: Nations of the World, Training & Discipleship, Member Login; missing: Radio as top-level, Community, Partner With Us, Contact, "I Said Yes to Jesus" CTA specifically). **Flagged for Project Lead:** confirm which navigation structure is authoritative, since the existing site appears to have evolved beyond the original spec.

### 3.3 Missing Homepage Sections (called for in spec, not visible in screenshot)
- Latest Ministry Updates (distinct from Events/Testimonies)
- Featured Sermon
- Mission Focus Today (as a named, dedicated section — "Pray for Uganda" style with Prayer Focus / Scripture / Pray / Learn More / Mission Report buttons)
- Daily Devotional
- Bible Verse of the Day (as distinct from Today's Scripture in hero)
- Lives Transformed Counter (screenshot has a general stats bar — souls reached, nations reached, Bibles distributed, etc. — which partially fulfills this, but not a dedicated "Lives Transformed" counter as named)
- Partner With Us (as a homepage section, not just nav item)
- Join Global Christian Platform (homepage section)
- Newsletter signup
- Weekly Memory Verse in the footer (footer currently shows contact/social only)

### 3.4 Radio
- Spec calls for a **dedicated Live Radio page** (Listen Live, Schedule, Archive, Bible Reading, Hymns, Messages). Screenshot shows "Revival Radio" only as a homepage quick-link tile, not confirmed as a full dedicated page — needs verification once site pages beyond the homepage are reviewed.

### 3.5 Additional Elements in Current Site Not in Spec
The following appear in the screenshot but are not mentioned in the master spec. These are not necessarily wrong — the spec allows for approved ministry content to be preserved — but are flagged for confirmation they should carry forward:
- "Nations of the World" as a top-level nav item with dropdown
- "Digital Revival Room," "Evangelism School," "Membership Portal" quick-link tiles
- Statistics bar (Souls Reached, Nations Reached, Bibles Distributed, Outreach Programs, Partners, Years of Faithfulness)
- "AFRICA MUST BE SAVED!" call-out box in the quick-links row
- Member Login in top bar

### 3.6 Design System
- Logo, wine-red/royal-blue/gold palette, and black header strip are consistent with spec.
- Cannot yet confirm exact hex values match "match exactly the ministry logo" instruction — will extract programmatically from the official logo file once provided, rather than estimating from the screenshot.

---

## 4. Items Flagged for Project Lead Decision (not to be resolved by AI 2)
1. **Hero visual:** real photography (current site) vs. custom modest-family vector illustration (spec). This is a doctrine/presentation-adjacent decision, not a technical one.
2. **Navigation structure:** which menu (spec's 10-item menu vs. the site's current expanded menu) is authoritative going forward.
3. **CTA wording:** "I Said Yes to Jesus" (spec) vs. "JOIN THE RESCUE MISSION" (current site) — confirm intended primary CTA.
4. Whether sections present on the current site but absent from spec (Nations of the World, Membership Portal, Digital Revival Room, Evangelism School) should be retained, since they may represent already-approved ministry content.

---

## 5. Recommendation
Proceed to build the site using the approved specification as the base architecture and design system, while:
- Preserving all current approved ministry wording, statistics, and testimonies verbatim once the existing site/content is provided.
- Building the spec's missing sections (Mission Focus Today, Daily Devotional, Lives Transformed Counter, Partner With Us, Join Global Christian Platform, Newsletter, Weekly Memory Verse) as new, clearly-marked placeholder sections.
- Holding the 4 flagged items above for explicit Project Lead sign-off before finalizing hero artwork, navigation, and CTA wording.

Development begins now on this basis. Placeholder content is marked `[PLACEHOLDER]` throughout the code so it is easy to find and replace once official content arrives.
