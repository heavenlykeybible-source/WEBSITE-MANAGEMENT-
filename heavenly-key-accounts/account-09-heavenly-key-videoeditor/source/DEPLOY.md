# Account 9 — Cloudflare Pages deployment checklist

## Account 9 canonical production domain — 26 October 2026

**Only public hostname:** `mediaguru.heavenlykey.org`.

Remove `editor.heavenlykey.org` and `videoeditor.heavenlykey.org` from the Account 9 Worker custom domains and Cloudflare DNS after confirming they are not used by another application. Bind `mediaguru.heavenlykey.org` to the existing `heavenlykey-studio` Worker and preserve its `DB`, `MEDIA`, and `AI` bindings. Do not delete the Worker, D1 database or R2 bucket. GitHub live-launch smoke checks accept only `https://mediaguru.heavenlykey.org/`. DNS/route changes require authorized Cloudflare zone configuration and have not been executed by this source commit.

Target: `heavenlykey-studio` (Cloudflare Pages), using direct GitHub integration. No Account 4 dependency.

## Prerequisites
- Review `OWNER-ADMIN-SETUP.md` and `AUDIT.md`.
- Cloudflare account must contain D1 `heavenlykey-studio` and R2 `heavenlykey-media`; confirm binding IDs and account ownership.
- Run `schema.sql` for a NEW D1 database, or run `migrations/0001_user_roles.sql` and then `migrations/0002_storage_usage.sql` once for an EXISTING database after backup.
- Confirm the Cloudflare Pages project's production branch, custom domain, D1, R2 and Workers AI bindings.

## GitHub direct deployment
1. Commit the complete **contents** of this `heavenlykey-studio/` directory to the deployment repository (or configure the correct root directory).
2. In Cloudflare Pages, connect the repository via Git integration.
3. Framework preset: None. Build command: leave blank. Build output directory: `public`. Root directory: the folder containing `index.html`, `functions/`, and `wrangler.toml`.
4. Deploy to a **preview** environment first, confirm bindings and test registration/login, projects, upload, audio and video export, voice processing and transcription.
5. Provision Owner and Admin separately through secure maintenance; never commit their password or session tokens.
6. Confirm access controls, storage limits, error handling, mobile Safari and Chrome before publishing production.

**Release gate:** no production claim until real Cloudflare tests pass.

## Corrected deployment root and D1 registration fix
For the packaged folder, the **repository root directory** is `heavenlykey-studio` only when the ZIP contents are committed under that exact directory. For a repository folder at `heavenly-key-accounts/account-09-heavenly-key-videoeditor/source`, use that exact root instead. Pages build command: none; output directory: `public`. Do not configure a Worker deploy action for a Pages Functions project.

A fresh database must apply `schema.sql`, which includes the user `role` column. Existing database users require the one-time migrations `migrations/0001_user_roles.sql` and then `migrations/0002_storage_usage.sql`. Do not run the migration on a fresh database already created from the current schema.

No live deployment was made while creating this ZIP. Real credentials and bindings must be configured in the correct Cloudflare account before enabling production.

## Existing database audit-index migration

Before staging, back up the existing Account 9 D1 database and apply `migrations/0003_audit_event_index.sql` once. It adds an idempotent composite audit index to accelerate login-throttling and AI-usage lookups. New databases created using the current `schema.sql` already include it. The migration is committed only; it has not been executed on live D1.

## Preflight
Run `npm run check` from the Account 9 source directory before dispatching GitHub Actions. The owner/admin SQL provisioning script is documented in `OWNER-ADMIN-SETUP.md`. Do not deploy before bindings and database migrations are verified.

## Static deployment security (23 October 2026)
Deploy ONLY the `public/` directory as static assets, with `functions/` in the project root. Do not publish `.` because it exposes `schema.sql`, tests, migrations, and private setup documentation. Set Cloudflare Pages output directory to `public` and Pages project root to this source folder. Preserve the Pages Functions directory at the project root.

## Account 9 deployment release gate
The repository's manual workflow `.github/workflows/deploy-account-09-videoeditor.yml` uses the `account9-staging` GitHub environment and two environment secrets named `ACCOUNT9_CF_API_TOKEN` and `ACCOUNT9_CF_ACCOUNT_ID`. **Do not use a production branch as the first deployment.**

The workflow must fail before deploying if source files, the `public/` assets, `wrangler.toml`, preflight checks, or backend tests are missing. Source must be committed under `heavenly-key-accounts/account-09-heavenly-key-videoeditor/source/`. Deploy only the `public/` directory while retaining Pages Functions at `functions/`.

Before release, confirm the selected Cloudflare account has the expected Pages project, correct D1/R2/Workers AI bindings, live schema and role setup. A successful workflow does not itself prove video export, real AI captioning, login, or compatibility on iOS Safari.


## Current release route and resource verification — 25 October 2026

**Canonical release route:** `scripts/build-account9-worker.mjs` packages the complete Account 9 frontend and API into the existing `heavenlykey-studio` Worker release used by Control Room. The legacy `.github/workflows/deploy-account-09-videoeditor.yml` is intentionally retired; do not use its Pages deployment steps as an active deployment procedure. GitHub Actions `quality-account9-videoeditor.yml` runs source checks and packaged Worker smoke tests but **does not deploy**.

The connected Cloudflare Account 9 resource listing confirms:
- D1: `heavenly-key-videoeditor-db`, ID `37d1fd6a-4424-4cca-a757-ea347098a758`
- R2: `heavenly-key-videoeditor-media`

These listing checks do **not** establish that a Worker has valid bindings, migrations, live permissions, a matching secret configuration, or functioning public DNS. An authorized deployment operator must confirm the deployed Worker identity, D1 schema/migrations, R2 `MEDIA` and `DB` bindings, and Workers AI `AI` binding. Owner/admin provisioning and preview production release require independent permissioned actions. Do not store owner passwords, tokens, or private AI connection credentials in Git.

Release requirements: current successful quality gate, real Cloudflare authentication/storage/transcription smoke tests, verified browser audio and WebM exports, Safari/iOS/Android tests, error monitoring, custom-domain confirmation, and explicit production sign-off. No live launch is asserted by this documentation.
