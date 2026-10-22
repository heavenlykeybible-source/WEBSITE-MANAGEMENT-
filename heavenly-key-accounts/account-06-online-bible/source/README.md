# HEAVENLY KEY BIBLE

A project of Heavenly Key Evangelistic Movement.

READ THE WORD. HEAR THE WORD. LIVE THE WORD. SHARE THE WORD.

TAKING CHRIST TO THE NATIONS OF THE WORLD.

## Source and deployment

This project lives inside the main Heavenly Key repository. Website assets: `heavenly-key-website/bible/`. Dedicated Bible Worker: `bible/worker.js`, configured by `bible/wrangler.toml`, Worker name `heavenly-key-bible`. Deploy only to the owner's verified Bible account, not another ministry account. The latest account map assigns the Bible to Account 6 (heavenlykeybible@gmail.com), with Account 4 coordinating administration. Verify that Cloudflare account identity and the existing Worker before deployment.

The reader ships its own validated KJV text. Its public media proxy reuses approved hymns, Bible audio and gospel-music APIs from the existing ministry service. It forwards no cookies, authorization headers or administrator routes and does not bind or change ministry databases.

## Implemented website features

- KJV (King James Authorized Version) only: 66 books, 1,189 chapters, 31,102 verses. The dedicated chapter API serves this same bundle.
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

Run `node --check heavenly-key-website/bible/app.js`, `node --check heavenly-key-website/bible/sw.js`, `node --check bible/worker.js`, and each test in `bible/tests/`. These checks passed locally. Wrangler 4.145.0 deploy --dry-run also passed and recognized all 79 static assets and the ASSETS binding. The Actions workflow `bible-quality.yml` runs the same checks without package installation or secrets.

See `SOURCE.md` for scripture provenance and reproducible import instructions. Notes are stored in this browser and do not sync across devices. Browser storage must remain available for saved notes and offline assets.

## Release blockers and pending capabilities

Deployment is deferred at the owner's request while development continues. No successful live Bible deployment is verified. Cloudflare sign-in is required before publication. The existing ministry hymn and gospel APIs returned empty collections during the check; approved recordings must be published before a populated media launch. Three historical public-domain hymn texts are bundled. Live browser/device testing, native Android/iPhone builds, cross-device notes, church group studies and hosted AI integrations are not yet complete. Do not represent these as globally ready.

## KJV and offline maintenance

Follow KJV-POLICY.md. The owner does not authorize alternative Bible translations. Unknown Bible audio edition metadata is excluded. Before updating deployed shell assets, increment the shell-cache version in sw.js so an active offline installation retains a consistent set of files until its update activates.

## Validation on 13 October 2026

All six local test suites passed again, including all KJV file checksums. Worker requests now reject writes consistently, health HEAD returns no body, and MINISTRY_PUBLIC_API_ORIGIN accepts only an HTTPS origin without credentials, paths or queries. The default public media service is unchanged; the setting supports future central-account migration. No Cloudflare credentials or verified live Bible URL were available in this session, so live deployment, media availability, device checks and global launch readiness remain unverified.

Offline recovery fixes: full-Bible downloads now time out stalled network reads, reject duplicate book manifests and permit retry after failure. Offline initialization has a bounded wait. Saved chapter numbers are normalized to whole numbers. Individual verses can be copied with their KJV reference. All six local suites pass, including failure/retry and verse-copy checks. The offline shell cache was incremented for this release.
