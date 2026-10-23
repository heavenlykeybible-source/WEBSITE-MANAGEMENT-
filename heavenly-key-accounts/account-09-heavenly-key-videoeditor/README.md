# Account 9 — Heavenly Key VideoEditor

Status: **STAGING CANDIDATE; NOT YET DEPLOYED** (23 October 2026).

The original Studio app has been repaired locally and packaged as `heavenlykey-videoeditor-account9-github-ready.zip`. Its archive SHA-256 is:

`791293c5eec56e8e1721ceedda1bf14bd4b87145832cc68d010fa9e20870df7f`

The package contains 34 files, including `index.html`, `functions/api/[[path]].js`, `schema.sql`, migrations, assets, tests and Cloudflare configuration. Local `npm run check` passed preflight and 53/53 mocked backend integration tests.

**Source upload status:** These 34 files are in the supplied release ZIP, NOT yet committed to this GitHub directory. Do not trigger the deployment workflow until the full package is committed under `heavenly-key-accounts/account-09-heavenly-key-videoeditor/source/`.

Direct staging deployment workflow: `.github/workflows/deploy-account-09-videoeditor.yml`. It uses GitHub environment `account9-staging` secrets `ACCOUNT9_CF_API_TOKEN` and `ACCOUNT9_CF_ACCOUNT_ID` and deliberately requires manual `workflow_dispatch`.

Deployment blockers:
1. Upload complete released source ZIP's extracted files to the directory above.
2. Verify actual Account 9 D1 `DB`, R2 `MEDIA` and Workers AI `AI` bindings; do not trust bundled IDs without verification.
3. Apply schema to a fresh database, or the one-time migrations to a backed-up existing database.
4. Provision distinct Owner/Admin login accounts securely in D1; never commit plaintext passwords or repeat credentials posted in chat.
5. Test all AI captions, video/audio editing and real browser exports on the live staging site.
6. Keep public production deployment blocked until staging acceptance passes.

Feature honesty: Video export is WebM; MP4 export, full nonlinear multitrack composition, AI text-to-video and natural-language AI editing are not implemented in this release.

Account 4 is not used for this path.


## Latest secured staging release (23 October 2026)

Latest complete ZIP: `heavenlykey-videoeditor-account9-final-deployment-ready.zip` (provided in chat). SHA-256: `b2f7af11f09ed130e001fc77eb1bfb900cdc779c9b129e6798e69cb77da3597e`, contains 39 files including separately staged static `public/` assets. 53/53 backend integration checks and preflight passed locally. The workflow was hardened in GitHub commit `fbc9ac40` to deploy ONLY `public/`, not source/test/migration files. The package has **not yet** been copied to the GitHub source directory and has **not** been live-deployed. Owner/Admin provisioning, D1/R2/AI live verification and real browser end-to-end tests are required before launch. Do not use the earlier ZIP hash above to verify this latest package.


## 23 October 2026 — latest staging package and workflow verification

New portable release package supplied in chat: `heavenlykey-videoeditor-account9-staging-final.zip`, SHA-256 `5aeed78144ad6cdce14811d724bca78cee0161024e6b8390fda101ea61cb3a5e`. The package includes the original browser editor, Cloudflare Pages Functions backend, account provisioning scripts, D1 schema/migrations, tests, `public/` assets, and corrected instructions to deploy ONLY `public/`. The source passed `npm run check` locally (preflight plus 53/53 simulated backend integration checks). The GitHub staging workflow was further hardened in commit `1d129150` with required asset/config/test checks. The complete ZIP has still NOT been imported into the GitHub source folder; therefore NO live deployment, D1 provisioning, Owner/Admin login or real browser export has been confirmed. Explicitly keep public launch blocked pending live checks.
