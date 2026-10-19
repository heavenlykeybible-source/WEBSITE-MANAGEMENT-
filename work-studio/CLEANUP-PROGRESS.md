# Audit cleanup progress

## Authentication and staging — 2026-10-19

- Extracted capability verification into a tested module.
- Reject missing/non-integer timestamps, empty identities, malformed nonce/signature, extra token segments, expired grants, unauthorized roles and grant lifetimes over 60 seconds.
- Preserved compatibility with Core's existing 60-second signed grants.
- Staging cron now runs once per minute, matching production monitoring. Placeholder staging resource IDs still require provisioning; nothing was deployed.
- Validation: valid grant and 15 negative cases; TypeScript; preflight; Wrangler dry run passed.

## Remaining work

Capabilities remain bearer tokens: this change does not add single-use nonce consumption or request binding. Universal owner approval, independent studio extraction, verified Account 4 SSO, provider broadcast tests, campaign execution and credential-rotation migration remain outstanding. Do not describe this branch as deployment-ready.

IMPORT-MANIFEST.json records the import baseline, not current cleanup hashes. The following intentional changes supersede its baseline entries: source/media-engine/src/index.ts and source/media-engine/wrangler.staging.toml. New files: source/media-engine/src/capability.ts and source/media-engine/test/capability.test.mjs. Git history preserves the exact baseline.

Run regression checks from source/media-engine: `node test/capability.test.mjs`, `npm run check`, `npm run preflight`, `npx wrangler deploy --dry-run`.
