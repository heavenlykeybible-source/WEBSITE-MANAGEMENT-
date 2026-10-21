# Complete Worker website deployment

This adds a direct Cloudflare release path to the existing control room. It does not use GitHub Actions or run arbitrary repository builds on the control-room server. It targets an existing Worker and inherits its D1, KV, R2, variables, secrets, compatibility date and flags. It does not run SQL, create resources, change DNS, or change cron schedules.

## Sources and owner workflow

1. Build the backend outside the control room into a single UTF-8 `.js` or `.mjs` ES module. Include its dependencies in that compiled module. Keep the complete public website folder separate.
2. Import that full static folder through an existing static-site upload channel: device ZIP upload, chat ZIP attachment, saved GitHub import, or a ZIP from the connected read-only Drive folder. This produces a sealed upload proposal in Waiting. Leave it waiting: it is the immutable asset source, and need not be published as a separate local website.
3. In Cloudflare → Deploy, enter the existing Worker name and static upload proposal ID. Choose a device Worker file/pasted code, saved GitHub repository and compiled file path, or compiled Drive file ID. Send the package to Waiting.
4. In AI chat/MCP, use `propose_worker_package` with `connection`, `name`, `assets_proposal_id`, and a source: `inline` plus `code`; `attachment` plus an authorized current-chat `attachment_id`; `github` plus `github_site` and `path`; or `drive` plus `file_id`. The agent must be unscoped staff with read/propose access and any required active account grant. Member and site-scoped agents cannot use this operation.
5. Open the package in Waiting, inspect the static website preview, the compiled backend source, asset list, target account and staged checks. The preview blocks backend API calls and form submission. It is not a running backend or proof that member features work. Approval requires the existing owner password and exact staged review token.
6. Approval uploads only missing assets using Cloudflare's short-lived upload JWT, then attaches the completed asset set with the reviewed backend. The final Worker upload is refused if an upload bucket is incomplete, bytes changed, the account changed, or the staged target changed. Upload tokens and provider credentials are never returned to the UI or AI.
7. Verify live HTML, assets, API behavior and deployment metadata after approval. A provider response or saved release record alone does not certify the live site.

The full asset set replaces the prior static set: include every public file. Existing immutable source objects remain referenced by the package; do not delete those objects before release. Rejected source proposals cannot be used to create a new package. No automatic retry or rollback is added; uncertain publications retain the existing release reconciliation controls.

## Limits

- Compiled Worker: 1.4 MB, single ES module. No PHP, TypeScript compilation, dependency installation, or multi-module deployment in this path.
- Static package: up to 200 files, 2 MB per file, 20 MB total for complete Worker releases. Existing ZIP import permits 25 MB compressed/expanded but a Worker package must meet the smaller 20 MB limit.
- Chat ZIP uploads now permit 25 MB; other chat attachments retain their 2 MB limit. Server validation and client messages agree. Drive compiled source reads are bounded to 1.4 MB without widening the ordinary 100 KB Drive text reader.
- GitHub compiled source is read from an immutable commit/tree/blob under the saved repository folder. SHA and content digest are recorded. No GitHub Actions run is needed. Separate saved sources may be required when the backend is outside an existing public-folder connection.
- Preview routing and uploaded asset config send `/api` and `/api/*` through the Worker; other paths use static assets. Applications using other server routes require an explicit reviewed routing extension.
- Provider permissions, Cloudflare plan limits, CPU/memory budgets, and upload-session expiration still apply. No live provider deployment or free-plan performance certification has been completed for this change.

## Installation status

Source change only until the existing Account 4 control-room Worker is updated through its protected maintenance deployment process and the plugin tool catalog is refreshed. This feature cannot deploy the control plane itself. Do not use the repository root Wrangler bindings for Account 4 without verifying the actual Account 4 installation.

No schema migration is needed. Keep the same database, bucket, VAULT_KEY, SESSION_SECRET, owner credentials and saved connections.

Validation: package lifecycle and source-channel tests exercise the actual proposal, preview, owner approval and direct upload code against SQLite, in-memory R2 and mocked provider APIs. The existing full suite also has a pre-existing `tests/persistence.mjs` failure: it hardcodes Account 4 DB `897d585c-ced1-4b08-a478-603547f242e5`, whereas the branch root Wrangler config specifies `f86fb475-ea20-4acd-9468-f3a407be97c4`. Neither binding nor that test was altered to hide the mismatch. All other regression tests were run separately. Live plugin exposure, real Cloudflare uploads, runtime performance and the Global Christian Community deployment remain unverified.

API references: https://developers.cloudflare.com/workers/static-assets/direct-upload/ and https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
