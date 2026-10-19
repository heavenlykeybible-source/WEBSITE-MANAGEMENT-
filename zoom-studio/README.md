# Heavenly Key Live & Meeting Studio

The audited Zoom Studio upload lives here as an independent project. It does not replace the existing Control Room or the separate `studio/` work on other branches.

The responsive blue, white and gold template includes the supplied ministry banner, feature guidance, main-website return link, meetings, groups and owner/admin user management. 24/7 Radio is on hold.

Run `npm test` in this directory (Node 22+). The existing repository also requires `node tests/run.mjs` from its root. Browser/device/network testing is separate; see AUDIT-UPDATE.md.

## Cloudflare deployment

Use a dedicated Worker named `heavenly-key-zoom-studio` and a dedicated D1 database named `heavenly-key-zoom-studio-db`, separate from existing production resources. This meeting app targets Account 7 (`6401a8f41a41f5325ba5bd4d006b4ff5`) only. The generated configuration pins that account and rejects conflicting account environment variables. Account 2 belongs to the separate Studio and must not be changed. Account 8 is not this deployment target. The repository's root Worker configuration and bindings are preserved.

1. In the intended Cloudflare account, create the dedicated D1 database and retain its ID. If the studio already has a database, preserve it and inspect its schema before migration; do not replace it or seed over its accounts.
2. Set `STUDIO_D1_DATABASE_ID` locally to that ID. Run `npm run deploy` with Cloudflare authentication. This applies tracked additive migrations and uploads the Worker/assets. Configure `AUTH_SECRET` as a private Worker secret before activating accounts. Existing deployments must retain that secret.
3. Initial owner/admin provisioning is a separate private operation described in ACCOUNT-SETUP.md. Supply the user's chosen password privately; it is never committed. No build or deployment job seeds production accounts.
4. Add `RELAY_URL` and a matching private `RELAY_SECRET` only when a running relay is available. This activates streaming and guest rooms; website deployment alone does not supply that server. Add OAuth credentials and optional email/payment settings for their respective integrations.
5. Open `/api/health` to check binding configuration, then test real owner/admin login, user creation, camera, guests and platform streaming.

The manual GitHub Actions workflow provides the same deployment after checks. It requires deployment credentials in the `zoom-studio` environment: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STUDIO_D1_DATABASE_ID`. No deployment credentials were supplied with the ZIP. Commits run checks only; selecting the explicit Deploy option initiates a production deployment.

Only site/ is public. Server utilities, test fixtures and password hashes must never be served as assets. The existing Pages site.zip method remains supported; the generated Wrangler configuration instead deploys this as a Worker with static assets.

## Deployment through the Control Room

Run `npm run bundle:control-room` to generate `build/meeting-worker.mjs`. The bundle embeds all 19 public files as compressed assets; backend source and private setup scripts are excluded from public routes. The dedicated database schema is additive and idempotent, initialized on first API use. Existing records and identities are never overwritten. The generated package is approximately 1.24 MB and fits the Control Room's bounded 1.4 MB code limit.

For Account 7, the owner selected database `heavenlykey-db` (`9549fc74-f6a8-4cf8-a066-7cb965c59b91`) and bucket `heavenlymedia`. Submit the bundle as Worker `heavenly-key-zoom-studio`, with bindings `d1/TEAMDB` to that database ID, `r2_bucket/FILES` to `heavenlymedia`, `ai/AI`, and `generated_secret/AUTH_SECRET`.

The deployment creates a missing AUTH_SECRET privately and stores an encrypted copy in the Control Room. Subsequent deployments inherit the existing secret. Preserve the Control Room vault and database. The new Worker receives its workers.dev address; existing Workers keep their public-access settings.

After deployment, use **Cloudflare → Account 7 → Workers → Open meeting app as owner**. The Control Room owner receives a signed, single-use, 60-second launch ticket through a POST, never in the URL. The app initializes its reserved owner identity only when absent and refuses to override a conflicting account. This owner entry does not configure a password login or reset any existing password. Password-based owner/admin provisioning remains a separate private operation in ACCOUNT-SETUP.md.

This bundle supplies the website, database initialization and owner entry. Guest rooms and RTMP streaming still require the separate running relay and its matching configuration; Cloudflare website deployment does not provide FFmpeg or the Node relay.
