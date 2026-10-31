# Account 4 — private website package staging

Status: implemented on the review branch; not deployed or enabled in production.

## Storage isolation required before deployment

The private multipart importer uses the dedicated `PRIVATE_IMPORTS` R2 binding, not the existing `FILES` bucket used by managed website content.

Create the bucket named `website-management-private-imports` in the same Cloudflare account as the Control Room and verify all of the following before deploying:

- Public R2 access is disabled.
- No public custom domain or public development URL is attached.
- Only the Account 4 Worker has the binding.
- The bucket has an explicit lifecycle rule to abort incomplete multipart uploads (24 hours is recommended).
- No website-serving route or static-site origin is configured to expose this bucket.

If the binding or bucket is missing, the API fails closed with HTTP 503.

## D1 migrations

The branch contains:

- `migrations/account4-private-imports.sql`
- `migrations/account4-import-release-attestations.sql`

Back up the Account 4 D1 database, apply these migrations to a staging database first, and verify the table constraints and foreign keys before applying them to production. The application checks for the private-session tables before accepting uploads. No production migration has been run by this change.

## Owner-only API

All endpoints are under the existing authenticated `/api/owner/` route and require the primary staff owner session plus the existing CSRF header.

- `POST workspace/imports` — start a private session.
- `GET workspace/imports` — list the owner's recent sessions.
- `GET workspace/imports/:id` — inspect a session and server-confirmed part numbers.
- `PUT workspace/imports/:id/parts/:number` — upload one exact-size 10 MiB part (last part may be smaller).
- `POST workspace/imports/:id/complete` — complete using only server-persisted R2 receipts.
- `GET workspace/imports/:id/recovery` — inspect an uncertain completion.
- `POST workspace/imports/:id/reconcile` — owner-only reconciliation after object-size and version checks.

Limits: 1 GiB per package, 10 MiB parts, three active sessions per owner, 24-hour session expiry. The UI can resume using the session ID and server-confirmed completed part numbers. R2 ETags and upload IDs are never returned to the browser.

## Publication and malware-scanning boundary

This importer stages objects only. It has no publication or deployment endpoint. Completion does not mean the package is safe.

The existing ZIP compatibility checks validate archive structure, paths, CRCs, file count and expanded size. They are **not** malware scanning. No trusted malware scanner is configured in this repository yet. The release-attestation schema and fail-closed eligibility helper are groundwork only; they are not wired to a scanner or the existing website release pipeline.

Do not treat Account 4 as globally launch-ready until a trusted server-side scanner is integrated, its SHA-256/object-version attestation is verified, explicit owner approval is bound to the exact scanned object, and the release pipeline enforces that gate atomically.

## Verification still required

- Execute the complete Node, SQLite, CMS DOM and browser test suites in a controlled staging environment.
- Exercise upload interruption, retry, expiry, duplicate completion and cross-owner access with real R2/D1 test resources.
- Verify the dedicated bucket's access settings in Cloudflare.
- Complete keyboard, screen-reader, mobile and desktop browser testing against WCAG 2.2 AA.
- Confirm production backup and rollback procedures before migration or deployment.

No production resources, secrets, migrations or deployments were changed by this branch.
