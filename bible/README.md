# HEAVENLY KEY BIBLE

A project of Heavenly Key Evangelistic Movement.

READ THE WORD. HEAR THE WORD. LIVE THE WORD. SHARE THE WORD.

TAKING CHRIST TO THE NATIONS OF THE WORLD.

## Source and deployment

This project lives inside the main Heavenly Key repository. Website assets: `heavenly-key-website/bible/`. Dedicated Bible Worker: `bible/worker.js`, configured by `bible/wrangler.toml`, Worker name `heavenly-key-bible`.

The reader ships its own validated KJV text. Its public media proxy reuses approved hymns, Bible audio and gospel-music APIs from the existing ministry service. It forwards no cookies, authorization data or member credentials.

## Implemented website features
- KJV only: 66 books, 1,189 chapters, 31,102 verses. The dedicated chapter API serves this same bundle.
- Chapter navigation, adjustable text size and chapter sharing.
- Search the selected book or whole Bible; first 100 results with total count.
- Device narration and approved ministry chapter-recording integration.
- Device-local saved verses, notes and hide/reveal memorization.
- Two seven-day reading plans and a 365-day whole-Bible plan, with saved progress.
- Downloadable study backups and canonical KJV restoration; existing notes are preserved on duplicate imports.
- 1080 × 1920 scripture image downloads.
- Searchable Hymn & Gospel Portal with three sourced classic hymn texts, existing approved media APIs, saved-title controls and saved-title filtering.
- Installable web app metadata and an explicit full-Bible offline download with SHA-256 checks.

## Verification

Run `node --check heavenly-key-website/bible/app.js`, `node --check heavenly-key-website/bible/sw.js`, `node --check bible/worker.js`, and each test in `bible/tests/`. These checks passed locally.

See `SOURCE.md` for scripture provenance and reproducible import instructions. Notes are stored in this browser and do not sync across devices. Browser storage must remain available for saved notes and offline backups.

## Release blockers and pending capabilities

Deployment is deferred at the owner's request while development continues. No successful live Bible deployment is verified. Cloudflare sign-in is required before publication. The existing ministry deployment remains the authoritative production path until a separate authorized deployment is approved.

## KJV and offline maintenance

Follow KJV-POLICY.md. The owner does not authorize alternative Bible translations. Unknown Bible audio edition metadata is excluded. Before updating deployed shell assets, increment the shell-cache version and validate before release.
