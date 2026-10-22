# Account 4 — Heavenly Key Central Control Room
Initial working CMS foundation. NOT production-ready until all placeholders and security checks are resolved.

## Features implemented
- Six-site content namespace with JSON page/menu/footer/image/section/settings entries.
- Version conflict detection, revision history and restoration.
- Cloudflare Access JWT signature verification (RS256/JWKS), audience and issuer checks.
- R2 image upload with content-type and size limits.
- Workers AI suggestion endpoint, never automatically publishes.
- No automated cross-account deployment: this requires independent Cloudflare credentials and a safe publish/rollback protocol.

## Provisioning (no existing production data may be deleted)
Create a NEW Account 4 D1 database and R2 bucket only after checking existing resources. Fill the placeholders in wrangler.toml. Configure Cloudflare Access with an administrator-only application for the control room, then set ACCESS_TEAM_DOMAIN and ACCESS_AUD to its verified values. Install dependencies, run typecheck, apply D1 migration, test access rejection and revision round-trips, and only then deploy. Never put API tokens in frontend assets or wrangler vars. Protect the entire hostname with Cloudflare Access, not just /api/.

## Important
Saved CMS data is not yet wired to Account 1–6 rendering. A production publish manager must be separately implemented and approved. GitHub remains a recovery source until verified otherwise.

## AI Control Engine deployment plan

The authenticated `/api/deploy/sites` and `/api/deploy/plan` routes now expose an account-scoped, non-executable deployment checklist. The dashboard has a planner, not a deployment executor. No cross-account credentials have been installed, and no deployment is initiated by the planner.

### Secure connection prerequisites

1. For each of Accounts 1–6, create a separately scoped Cloudflare API token with the minimum permissions required by that account's Worker deployment. Never reuse a global API key.
2. Store tokens only as encrypted Worker secrets in Account 4. Never commit them to GitHub, send them to the browser, or store them in D1.
3. Verify the token against its expected account ID before allowing any account-specific operation. Reject account mismatches.
4. Require Cloudflare Access administrator identity, an explicit approval for the exact account and Git revision, and a recorded audit entry before execution.
5. Run source checks and deployment preflight; deploy only a pinned, approved Git revision with an account-specific Wrangler configuration.
6. Test the deployed Worker and custom domain, preserve the previous version for rollback, and mark failed deployments as failed.
7. Keep production deployment disabled until these safeguards have been implemented and tested.

Account 6 Bible's requested hostname is `bible.heavenlykey.org`. DNS ownership and routing must be verified independently; a successful workers.dev response alone does not prove the custom domain works.
