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
