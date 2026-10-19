# Website Management

Isolated Cloudflare Worker CMS with D1 and R2. Secrets are configured in Cloudflare and must never be committed.

Run checks: `node tests/run.mjs`. Deployment: `npx wrangler deploy`.

See the included audit, setup, login, release and maintenance guides for capabilities and limitations.

## Live and meeting studio

The separate [Zoom Studio project](zoom-studio/README.md) contains the audited upload, owner/admin user management, a ministry banner and a responsive template. It deploys to its own Cloudflare Worker and database. The existing Control Room remains at the root. Radio is on hold.



## Account 2 Studio

The separately prepared Studio is in studio/. See STUDIO-REFINEMENT.md and studio/ACCOUNT4-INSTALLATION.md. Meeting-app deployments remain separate from Studio.
