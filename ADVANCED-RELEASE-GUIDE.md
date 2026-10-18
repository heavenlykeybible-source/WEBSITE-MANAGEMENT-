# Advanced Control Room release controls

This upgrade implements selected Account 4 design ideas as new code for the standalone Control Room. It does not import Account 4's account IDs, credentials, repository references or production data.

## What is stronger now

| Feature | Behavior |
| --- | --- |
| Shared source protection | The same validator protects file proposals, raw uploads, GitHub changes and imports. GitHub paths include the connection's configured subfolder, so changing that folder cannot bypass protection. |
| Protected control plane | Authentication/security files, CMS runtime files, migration/configuration paths and selected system names are blocked from ordinary source editing. The control-room Worker cannot deploy or delete itself through this dashboard. |
| Immutable uploaded files | Each write gets a unique R2 object key. Its storage ETag is recorded. Replacing an unsubmitted file does not overwrite an earlier object's bytes. |
| Upload/finalize coordination | Each proposal has a mutation lock shared by upload, batch/import construction and finalization. Finalized uploads cannot be changed through the upload API. |
| Staged review | Opening a waiting proposal as its approving owner checks the payload and captures the live target's current state. A hash identifies the candidate and its baseline together. |
| Specific approval | Approval needs a fresh review token belonging to the reviewer, a review acknowledgement and their current password. File changes also require opening the sandboxed preview. |
| Stale review rejection | A changed candidate or changed baseline invalidates approval. Reviews expire after 30 minutes. GitHub writes additionally check the exact reviewed branch commit. |
| Serialized publication | Queued publications, recovery and the dashboard's existing direct content saves use one global publication lock. This deliberately favors consistency over parallel publishing for a small installation. |
| Release records | Proposal publications record applying, succeeded, uncertain, failed or rolled_back status, plus the candidate hash, target, approving user and timestamps. |
| Safe local recovery | An approved local page/design release can create a new recovery proposal. Uploaded-file releases can restore the prior file pointers. Recovery refuses to overwrite a newer target state. |
| Uncertain outcomes | An interrupted write stays unresolved. It is never automatically changed back to waiting and retried. The owner must inspect the destination and record its verified outcome. |
| Abandoned-lock inspection | The installation owner can inspect locks and explicitly clear one older than 15 minutes after verifying no operation is running. Locks are never silently stolen based on time alone. |

## Installation and upgrade

New installation: use schema.sql and the normal setup guide. Do not apply the upgrade migration after creating the new schema.

Existing installation created from the PREVIOUS PACKAGE: export/back up D1 and preserve R2 first. Pause uploads and approvals during the upgrade. Apply this one-time migration against that existing database:

```sh
npx wrangler d1 execute approval-queue-db --remote --file=migrations/0002_release_controls.sql
```

Then deploy the updated Worker:

```sh
npx wrangler deploy
```

The migration adds two nullable upload-manifest columns and three new tables plus indexes. It does not drop users, pages, connections, site files or existing storage objects. Apply it exactly once. If the database comes from another source or has been modified, inspect its schema first instead of assuming compatibility. Do not rerun schema.sql as a substitute for a migration.

Previously approved/live files continue to serve. Legacy waiting upload proposals lack the new immutable manifest and must be resubmitted before approval. Opening old preview links is not supported; open the proposal again for a new link. Other waiting proposal types can be staged using their current live baseline, provided their payload is still valid.

Set CONTROL_WORKER_NAME to the actual name of this control-room Worker. If you rename it in Wrangler, update that variable too. PROTECTED_WORKERS is an additional comma-separated list of Worker names that ordinary dashboard deployment/deletion must never touch. The name control-room is always protected. Protection is conservative across all connected Cloudflare accounts.

## Daily workflow

1. An agent or human submits a proposal. It remains waiting and has no live effect.
2. The relevant owner opens it. Structural/revision checks capture a staged review.
3. Review the before/after content or full source. For file uploads, open and inspect its sandboxed preview.
4. Tick the review acknowledgement and enter your current password. Approval is bound to that exact candidate and live baseline.
5. Open Releases to inspect the publication result. A failed request may require verification rather than a retry.

A staging check is not a build, security scan, runtime test or proof the owner read every line. The application still relies on the owner's judgement. Uploaded HTML previews and post content previews are isolated views; they do not reproduce a destination site's entire production environment.

## Recovery and uncertain results

Local pages/designs: Releases → Prepare recovery proposal. This creates a waiting proposal containing the prior content. Stage, review and approve it normally. It is not published immediately.

Uploaded files: Releases → Restore files. Password confirmation and current-file checks are required. The operation restores the prior R2 pointers and marks the original successful release rolled_back. No R2 object or database is recreated.

GitHub: use a reviewed revert of the recorded repository commit and your hosting pipeline. Worker and WordPress/Blogger recovery use the original platform's verified versions/revisions/backups. The dashboard does not offer automatic recovery for those targets. Export important post content before editing it.

Uncertain: inspect the destination first. Did the external change happen? Check the actual post, commit or Worker before choosing “I verified: succeeded” or “I verified: failed.” This records a human attestation, not an automated probe. A failed proposal must be resubmitted as a new proposal; it is not silently retried.

An abruptly terminated request can leave applying state and a lock. After at least 15 minutes, the installation owner can clear the abandoned lock only after verifying no operation is running. Then inspect the destination and resolve the old applying release explicitly. Ordinary member accounts cannot clear installation-wide locks.

## Scope and remaining limits

- The release history covers proposal publications and related file recovery. Existing direct human saves remain in the audit log. They use the serialization lock but are not automatically converted to proposals or full release records.
- A succeeded record means the application applied the local change, received the external publish response or created the GitHub commit. It does not certify a downstream hosting build or the live website's health.
- There is no isolated execution environment for proposed Workers or arbitrary repository builds. Worker review checks source and the provider's modification timestamp; GitHub review pins the branch commit. External changes outside this dashboard can still race with APIs that offer no atomic compare-and-swap.
- Before applying local page/design changes, the baseline is checked. Their database writes are batched where appropriate. Remote writes and the release database cannot participate in one distributed transaction; uncertainty is handled explicitly instead.
- Source protection is a path/name policy, not semantic analysis of arbitrary code. Protected maintenance must use a separately reviewed deployment process. Do not weaken the policy just to submit an ordinary website change.
- Release manifests and immutable/abandoned storage objects need a future retention policy. Do not delete any object referenced by live files or backups. All existing traffic, storage and AI quotas still matter.
- The new controls add database reads, cryptography and password confirmation. Profile the Cloudflare Free 10 ms CPU limit with your actual users and files before production use. Tests enforce the 50-query D1 invocation budget for the exercised owner workflows, but do not prove runtime CPU limits or every possible provider call path.

## Validation

Run with Node.js 24 or newer:

```sh
node --disable-warning=ExperimentalWarning tests/run.mjs
```

58 local application checks pass: the earlier 27 checks, 19 release-control checks, three dashboard interaction checks, and nine account/password checks. Three additional checks verified the actual private account seed separately. The database checks use real SQLite; provider calls and storage are mocked. The dashboard check runs the actual script with a mock DOM and verifies the staged-review, acknowledgement, masked-password, approval, release-history and recovery flow.

A real browser rendering check could not run because the environment has no Chromium executable. Live Cloudflare deployment, free-plan CPU profiling, provider publishing and production recovery remain untested. No existing Account 4 service, GitHub repository or production account was modified by this upgrade.


For the simplified login screens and the separate private owner/admin setup bundle, read LOGIN-GUIDE.md.
