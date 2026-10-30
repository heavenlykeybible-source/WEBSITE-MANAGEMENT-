# Bible deployment audit · 23 October 2026

## Verified

- Complete KJV dataset: 66 books, 1,189 chapters and 31,102 verses; manifest checksums and verse ordering validated.
- 38 automated suites cover scripture, Worker routing, approved media access, search/concordance, notes/backups, reading plans, annotations/references, reminder safeguards, daily rollover, quiz data, offline certificates and deployment preservation.
- Chromium checks at widths 320, 360, 390, 768, 900, 1024 and 1440: no horizontal overflow. Book/chapter navigation, direct reference search, notes/bookmarks, theme, tools and text sizing exercised without JavaScript errors.
- Real browser offline test: download all 66 books, disconnect the browser, open dictionary/concordance/daily scripture, complete a 20-question quiz, and download its personalized certificate. All passed under the restrictive script policy.
- Worker dry-run build succeeds with locked Wrangler dependencies. All 131 static assets are present.
- Original supplied ministry logo is unchanged. No external advertising scripts or ad networks are integrated; the script policy allows same-origin scripts only.

## Corrected

- Removed obsolete cache-version expectations from historical tests, keeping their functional assertions.
- Unified the offline shell's precache and fetch allowlist. Daily lessons and the original-language guide now work offline, together with the logo/fonts and install instructions.
- Moved inline navigation/install scripts into local files and added security headers.
- Direct reference search now scrolls to the requested verse and rejects invalid chapter numbers.
- Added an isolated automatic Account 6 release workflow with a pinned dependency lock and fail-closed preservation of production bindings, secrets, variables and schedules.

## Limits

- Homepage follows the supplied reference but is not pixel-identical artwork.
- Published chapter summaries/character notes currently cover Genesis 1; the interface identifies missing material in other chapters. Dictionary and original-language content remain the supplied limited editorial dataset, not a complete scholarly lexicon.
- Online audio/gospel availability depends on the existing ministry media service. Device narration depends on installed browser voices. Modern map links need internet.
- Closed-app push reminders require the existing D1/dispatcher/VAPID setup. This release does not provision that infrastructure.
- Automated tests and local build are not proof of a live deployment. GitHub Actions must find the dedicated Bible credentials and existing Worker; live verification then requires `BIBLE_LIVE_URL`.

## Release scope

Canonical source is `apps/heavenly-key-bible`. Existing Account 4 control room and historical recovery trees are not replaced. No database content, production key, or other account deployment configuration is modified.

## Hymn catalogue correction — 30 October 2026

The current Account 6 hymn reader uses `heavenly-key-website/bible/data/hymns.json` as its canonical source: 201 entries, 200 with historical lyrics and one metadata-only title pending text-rights verification. Historical 3-, 5- and 6-hymn counts are obsolete and must not be used for this app. Hymn playback and hymn media APIs are excluded from the text-only hymn reader. This is a source-code audit; live deployment and browser verification remain outstanding.
