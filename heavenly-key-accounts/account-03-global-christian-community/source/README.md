# Global Christian Community — Cloudflare Workers Git import

This is the working application, with its TypeScript API, static frontend,
approved banner, Design Cards, ACTIVE, migrations and tests. Do not deploy the
repository root or one of the preserved snapshots instead of this directory.

## Import settings

| Cloudflare field | Value |
| --- | --- |
| GitHub repository | `heavenlykeybible-source/onlinebible` |
| Branch | `build/global-christian-community-active-layout-20261021` |
| Root directory | `Global Christian Community/implementation` |
| Worker name | `heavenly-key-global-community` |
| Build command | `npm run build` |
| Deploy command for an inactive version | `npm run upload:version` |
| Deploy command after production approval | `npm run deploy` |
| Build environment variable | `NODE_VERSION=24.19.0` |

Cloudflare installs dependencies from `package-lock.json`. The build checks the
actual backend/frontend, runs the focused executable regression suite, and
compiles the actual Worker dependency graph without deploying. Wrangler then
bundles `src/index.ts` and uploads `public/` as assets; no framework or static
HTML replacement is required. There is no separate output directory to enter.

`upload:version` saves a Worker version without promoting it to the active
deployment. It is not an isolated Account 4 functional preview: its resource
bindings are the Account 3 bindings below. Do not use a production-bound version
URL for disposable test writes.

## Destination and resources

`wrangler.toml` is pinned to Account 3 (`cd095c096c2d5a42501e7d77cecbb34c`).
Connect it to the existing matching Worker in that account. Do not connect this
configuration to Account 2 or Account 4's `website-management` Worker, rename it
to a Control Room Worker, or replace any other ministry application.

The existing bindings are retained:

- `DB`: `heavenly-key-global-community-db`, ID `94d70dc2-91fe-4c5d-afc2-ca9ccff04f28`.
- `SESSIONS`: KV namespace `daf1094e23c6494fb89a6e7bd232b52b`.
- `MEDIA`: `heavenly-key-global-community-media` R2 bucket.

In the destination Worker's runtime Settings, preserve/set `PASSWORD_PEPPER`,
`SESSION_SECRET`, and `INTERSERVICE_SECRET` as secrets. Never commit their values.
Preserve the existing `PASSWORD_PEPPER`; changing it breaks existing password
verification. Optional social sign-in and calling secrets are only needed when
those integrations are configured and verified. No inference binding is used.

## Migrations and release order

The owner-approved order remains development, tests, isolated Account 4 preview,
owner review, then Account 3 production approval. An Account 4 preview needs its
own Worker name, account ID, D1, KV, R2, origin and secrets; none of those isolated
resource IDs have been provisioned by this handover. This production config
must not be used as that preview config.

Before activating this Worker in any environment, inspect migration history and
apply pending migrations to that environment's correct database. In particular,
`0019_session_revocations.sql` must exist before the new authentication code is
activated. Authentication fails closed without it. For Account 3, only after
release authorization and the database backup/review step, run
`npm run migrations:production` in this directory using the Account 3 identity.
The deploy command intentionally does not migrate a remote database on its own.

Connect GitHub under the Worker's Settings > Builds with the table above. Use
the inactive-version command while release approval is pending. Switching the
command to `npm run deploy` activates subsequent successful builds, so only do
that after explicit production approval. The Worker name in the dashboard must
match `wrangler.toml`.

After an approved activation, verify the actual homepage and registration
links, guest/member banner transition, authenticated ACTIVE, role boundaries,
logout, media and public feed. A successful HTTP health check alone is not a
functional website verification.

## Current verification limits

Verified on 21 October 2026: `npm run build` completed successfully, including
TypeScript, frontend syntax, 53 regression tests, preflight and Worker bundling.

`npm run build` is a deployment compilation/regression check, not the full
launch audit. `npm run buildcheck` remains the complete existing audit command;
it has known unresolved failures in the Wrangler audit runner and Community
Care's missing screening module/schema. These checks have not been deleted or
marked as passed. Email verification, recovery, administrator MFA and other
launch blockers remain open. Exact screenshot equivalence has not been visually
verified. This commit prepares Git import and does not certify public-launch
readiness or claim any deployment.

Official configuration reference:
https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
