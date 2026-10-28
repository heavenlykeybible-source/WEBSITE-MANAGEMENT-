# Account 3 → Account 4: manual release review

Status: **AWAITING OWNER/ADMIN APPROVAL — NOT DEPLOYED**

Project: Heavenly Key Global Christian Community (https://global.heavenlykey.org/)
Repository: https://github.com/heavenlykeybible-source/WEBSITE-MANAGEMENT-
Review PR: https://github.com/heavenlykeybible-source/WEBSITE-MANAGEMENT-/pull/42
Reviewed source branch: `account3-auth-recovery-review-20261027`
Verified source revision prior to this handover: `0a8455f035d929f537fe296ad97039340f8cbcfe`
GitHub workflow check on that revision: **SUCCESS**, run `40699765033`.

## Scope presented for review

- Authentication recovery and security checks
- Friend requests, approval, decline and cancel; notifications and member discovery
- Member-to-member messages, privacy and abuse controls
- ACTIVE = member-authored posts expiring within 24 hours (not an online presence directory)
- Online friends with indicators only in the right sidebar
- Manual-only Account 3 production workflow with exact main-branch SHA approval

## Release gates (do not bypass)

1. Review PR #42, reconcile changes against the current `main` branch and pass CI on the final merge candidate.
2. Confirm all required production secrets, D1 migrations, backup/recovery process and account bindings using the release preflight.
3. Perform real-device member-to-member, ACTIVE 24-hour expiry, real notification refresh, account access and responsive UI smoke tests.
4. Owner or administrator approves the exact final `main` SHA and starts the Account 3 `workflow_dispatch` deployment.
5. Verify `global.heavenlykey.org` is serving new assets, preserves users/data and handles rollback only with manual authorization.

**This file is a source-controlled handover for Account 4 review, not an automatically queued or approved production deployment.**
