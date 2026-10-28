# Account 5 — My Walk With God approved structure

Approved 2026-10-28. This is the implementation source of truth for the Account 5 app cleanup. This document does not assert that UI code has already been changed or deployed.

## Identity
- Official app name: **My Walk With God** (formerly My Walk With God Calculator).
- Description: Heavenly Key All-in-One Christian App, centered on discipleship and spiritual growth.
- Do not call the app Social Community or Calculator in its main identity; retain Spiritual Growth Calculator as an internal feature.

## Required home features
1. **Strength for Today** — devotional. Replace all labels of Daily Manna with the full exact name. Never abbreviate it.
2. **Bible Study Portal** — includes Christian Living Topics, with KJV Bible references, explanations, practical applications, reflection questions and prayer points. Christian Living Topics must not appear as a separate home app.
3. **My Daily Routine** — dedicated correctly routed feature.
4. **Spiritual Growth Calculator** — internal personal growth feature.
5. **Life Bible (Full Bible App)** — the only Bible app integration; remove Mini Bible entries entirely.
6. **Global Christian Social Network** — integrated entry to Account 3.
7. **Heavenly Key Website & Blog** — integrated entry.
8. **Heavenly Key Radio** — integrated entry.
9. **Meeting Space** — integrated entry to Account 8.
10. **Approved Gospel Hymns and Songs** — inside My Walk With God, with rights-cleared hymns and approved media. Do not show church-name labels or church links as categorization; retain legally required attribution, rights notices, and source credits when applicable.
11. **Prayer and Journal / Discipleship** — retain existing relevant capabilities, verify implementation before claiming active.

## Audio Bible exclusion — owner directive
- Remove Audio Bible from Account 5 app navigation, app catalogue, My Walk With God, Life Bible integrations, install pages and promotional UI. Do not publish or advertise an Audio Bible in Account 5.
- This restriction concerns Audio Bible; approved gospel hymns and songs remain within My Walk With God.
- Verify that removed Audio Bible routes and links cannot be reached through menus, search, app switchers or cached installation pages. Preserve unrelated Bible text-reading features.

## Account 5 app catalogue
- Life Bible
- My Walk With God
- Global Christian Social Network
- Meeting Space
- Media Guru and Social Plus are private tools and must not appear within My Walk With God.
- Website Management Control Room and studio/admin tools are private and must not appear within My Walk With God.
- Include all other verified public Heavenly Key apps and services; public catalog must be verified against actual source.
- Bible Study is a module of My Walk With God, not a standalone downloadable app.

## Quality and release rules
- Every icon must route to its own correct module, not Bible Dictionary by default.
- Verify app pages, download links, Android/iOS/Desktop install paths and real install packages before marking available.
- Do not claim App Store/Play Store availability without verified listings.
- No production deployment without owner approval. Preserve the latest source and avoid old homepage regressions.

## Development order approved
1. Remove all Audio Bible entries and functionality exposed by Account 5, and verify the exclusion across its public app surfaces.
2. Audit and repair the full Life Bible app first: every menu, route, dictionary, daily routine, reading and share function, and platform-specific UI. Test against current source and live behavior.
3. Audit and repair each remaining public Heavenly Key app independently.
4. Only after the underlying public apps are working, integrate them into the final My Walk With God all-in-one app and test the complete experience.
5. Keep hymns and gospel songs in My Walk With God, not as a separate public app. Respect copyright, licenses and any required attribution even where church branding is removed.
