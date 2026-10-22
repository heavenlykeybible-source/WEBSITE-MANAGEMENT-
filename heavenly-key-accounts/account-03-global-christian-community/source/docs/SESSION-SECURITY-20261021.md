# Session revocation — development verification

The existing implementation used KV deletion alone for logout. KV is eventually
consistent, so a previously cached session could remain usable after deletion.

`auth.ts` now commits a SHA-256 session-token tombstone to D1 before deleting the
KV entry. Every authenticated session lookup checks the tombstone and current
account role/status in the same database query. A stale KV copy cannot bypass
that check. New sessions also carry an explicit expiry; existing sessions keep
their original KV expiration. Malformed identities and unknown database roles
are rejected. A failure to query the revocation table denies authentication.

Migration `0019_session_revocations.sql` adds an isolated table and expiry index.
No member records or existing schemas are rewritten. The hourly scheduled job
removes tombstones only after their 30-day retention exceeds the maximum session
lifetime. Tokens themselves are not recorded in D1. Logout revokes the current
device; full device inventory and revoke-all remain outstanding.

Apply the migration to the isolated preview database before deploying this
Worker version. Do not apply it to production as part of source verification.
If KV deletion fails after the D1 write, logout reports failure but the session
is already unusable. Retrying logout is safe.

## Validation

- TypeScript and frontend syntax checks passed.
- Six executable tests use the actual auth module and all real SQL migrations:
  stale KV after logout; KV deletion failure; role promotion/demotion and account
  locks; malformed/expired sessions; independent devices and legacy sessions;
  and fail-closed behavior without the migration.
- Existing registration, ACTIVE, social sign-in/adverts and stewardship tests
  are included in regression verification.
- `npm run test:security` is included in the full buildcheck command.

This change does not establish launch readiness. Email ownership verification,
password recovery, administrator MFA, atomic abuse limiting, full privacy-flow
verification, and the previously recorded buildcheck failures remain open.
No visual exact-match claim, staging deployment, or production deployment is
made by this change. The separate temporary HTML samples are not application
source and are not part of this implementation.
