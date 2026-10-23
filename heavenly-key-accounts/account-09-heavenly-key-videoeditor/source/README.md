# Heavenly Key Studio

Browser video, audio and voice studio with optional accounts on free Cloudflare. NOT ready for public launch: read AUDIT.md first.

## Contents
- index.html: the whole web app (editor, audio studio, voice studio, account page)
- assets/: Heavenly Key logo files and favicon
- functions/api/[[path]].js: API (accounts, projects, media, auto-captions, account deletion)
- schema.sql: D1 database tables
- wrangler.toml: Cloudflare bindings (paste your D1 database_id)
- _headers: security headers
- DEPLOY.md: deploy steps (needs your Cloudflare login and approval)
- ARCHITECTURE.md, AUDIT.md: design and audit/launch readiness
- tests/: the automated test scripts (sandbox paths, see tests/README.md)

## Release status
Current locally verified build: 53/53 backend integration checks passed with simulated D1/R2/AI; static Chromium page loaded without page errors. Live Cloudflare, mobile, and export testing remain necessary. See RELEASE-STATUS.md.

## Try it without deploying
Serve this folder over http (for example `python3 -m http.server`) and open index.html. The editor, audio and voice tools work. Accounts, media library and auto-captions need the Cloudflare deploy.

## Static deployment security (23 October 2026)

Deploy ONLY the `public/` directory as static assets, with `functions/` in the project root. Do not publish `.` because it exposes `schema.sql`, tests, migrations, and private setup documentation. Set Cloudflare Pages output directory to `public` and Pages project root to this source folder. Preserve the Pages Functions directory at the project root.
