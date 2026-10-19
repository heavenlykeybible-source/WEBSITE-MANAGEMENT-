# Website Management

Isolated Cloudflare Worker CMS with D1 and R2. Secrets are configured in Cloudflare and must never be committed.

Run checks: `node tests/run.mjs`. Deployment: `npx wrangler deploy`.

See the included audit, setup, login, release and maintenance guides for capabilities and limitations.



## Heavenly Key Studio

Account 2 source and its dedicated Studio are in `studio/`. See [STUDIO-REFINEMENT.md](STUDIO-REFINEMENT.md) for changes, tests and activation on the existing Workers.
