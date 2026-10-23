# Heavenly Key Bible · Account 6

This is the current complete Bible application, including the approved homepage and original ministry logo. Historical recovered Bible folders remain unchanged for reference.

## One-push deployment

A push to `main` that changes this folder runs `.github/workflows/deploy-bible.yml`: install the locked dependencies, verify the Worker bundle, run all Bible tests, inspect the existing Bible Worker, and deploy once. Other account release workflows are not triggered by these paths.

Set the following GitHub secrets in the `account-6` environment or repository (values are never committed):

- `BIBLE_CLOUDFLARE_API_TOKEN` (or `ACCOUNT6_CLOUDFLARE_API_TOKEN`): dedicated Bible-account token with Workers Scripts Edit and read access to existing Worker settings and schedules. Wrangler asset deployment may require account settings read.
- `BIBLE_CLOUDFLARE_ACCOUNT_ID` (or `ACCOUNT6_CLOUDFLARE_ACCOUNT_ID`): the verified Bible Cloudflare account ID.
- Optional environment variable `BIBLE_LIVE_URL`: the existing public Bible Worker HTTPS URL; enables post-deploy verification of all scripture checksums and public endpoints.

Worker name: `heavenly-key-bible`. The deployment refuses to proceed if that existing Worker cannot be inspected. It reuses current D1, R2, KV, AI and service binding IDs, keeps variables/secrets and cron schedules, and does not execute database migrations or seed scripts. An unsupported binding type stops deployment rather than dropping it.

Local commands (Node 22+):

```
npm ci --ignore-scripts
npm test
npm run build
npm run deploy
```

The production deploy command uses the dedicated `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment values. The build command is a local dry run, not a publication.

For a Cloudflare Workers Git build instead of GitHub Actions, set root directory to `apps/heavenly-key-bible`, build command `npm run build`, and deploy command `npm run deploy`. Use one deployment channel to avoid duplicate releases.

See `AUDIT.md` for verified functionality and current limitations.
