# Account 10 — Cloudflare infrastructure handover

Last reported: 2026-10-27. This is a handover record, **not** evidence that Cloudflare resources exist.

## Project
- Product: Heavenly Key Social Management (Account 10)
- GitHub repository: heavenlykeybible-source/WEBSITE-MANAGEMENT-
- Development branch: codex/heavenly-key-studio-refinement
- App directory: account10-social-management/
- Worker: heavenly-key-social-management
- Cloudflare account label reported by operator: Heavenlykeysocial@gmail.com's Account
- Plan reported by Cloudflare AI: Free, without additional capabilities

## Intended resources (NOT YET CONFIRMED CREATED)
- D1 database: heavenlykey-social-management-db; binding DB
- R2 bucket: heavenlykey-social-management-storage; binding MEDIA_BUCKET
- KV namespace: heavenlykey-social-management-kv; binding APP_KV
- Queue proposal: heavenlykey-social-management-queue; binding MESSAGE_QUEUE. Skip for now on Free plan; consider D1-backed jobs and Cron Triggers with plan limits.
- Secrets to configure securely when available: ADMIN_TOKEN and GEMINI_API_KEY. Never commit values.

## Cloudflare AI's reported blockers
1. D1 creation was denied at the confirmation step.
2. KV creation was denied at the confirmation step.
3. R2 bucket creation was not authorized with current token permissions.
4. Cloudflare AI could not access the GitHub repo or source in its workspace.
5. Cloudflare AI reported Queues require Workers Paid and are unavailable on this account's Free plan. Verify current product availability before upgrading.

## Authorized next steps
1. Retry D1, R2 and KV provisioning individually, obtaining explicit approval for each required confirmation and correct R2 token permissions.
2. Capture actual Cloudflare account/resource IDs after successful creation; do not invent them.
3. Inspect existing wrangler.toml, schema.sql and src/index.ts in this repository. Configure real bindings only after provisioning.
4. Apply schema.sql to Account 10 D1 after review, test migrations and backups, then test Worker APIs and static UI.
5. Keep Account 10 data isolated from Account 2. Migrate historical data securely only after authorization and verification; do not delete Account 2 features prematurely.
6. Do not claim live messaging, auto-posting, provider integrations, or global launch without end-to-end tests and official API authorization.

## Current source status
Account 10 contains a Worker API, D1 schema, a WhatsApp-style draft management interface, conversation/takeover scaffolding, social post drafts, welcome menu, and keyword reply drafts. Actual platform publishing, provider webhooks, Gemini integration, full migration, deployment, and live testing are not confirmed complete. The public HTML UI still needs verified static asset serving and security review.

## Cloudflare AI instruction
Create resources one at a time with confirmation; do not deploy a placeholder Worker over existing code. If GitHub is inaccessible, provision infrastructure only and hand back actual IDs for integration.
