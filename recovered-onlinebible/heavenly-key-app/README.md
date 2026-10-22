# Heavenly Key Mobile App

Official mobile web-app project for Heavenly Key Evangelistic Movement.

This is an isolated Cloudflare Account 5 app. Accounts 1–4 remain the authoritative systems for the ministry site, live media, community identity and recovery. Never copy production database IDs, passwords or API tokens into this repository.

The initial goal is an installable, mobile-friendly app shell. Existing live service integrations must be verified before they are enabled.


## Unified app draft
Home, Community, Grow and Profile form the main navigation. Bible reading and Live deep links are preserved. Community and Grow are equal pillars. Public text content loads only on demand. Existing-account sign-in, lesson reading and progress now have draft implementations, disabled by default until staging verification. Account 3 remains authoritative; no new user database is created. See `docs/UNIFIED-APP-INTEGRATION.md` for verified findings and the remaining release work.

Run `npm run build` and `npm test`. All changes remain a draft until integrated service and device testing is complete.

The original full KJV reader, 365-day reading programme, reviewed hymns and recorded-audio players are now included under Grow. Audio files are still pending; the catalogue has zero approved narrated chapters. See `docs/APP-PLATFORM-AND-AUDIO-AUDIT.md` for source verification and the Android/Apple/tablet/laptop release matrix.
