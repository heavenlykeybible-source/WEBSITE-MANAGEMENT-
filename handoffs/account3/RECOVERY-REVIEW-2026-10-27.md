# Account 3 Global Christian Community — recovery review

## Scope
Reintegrated the previous Work session's `Global-Christian-Social-Network-Changes.patch` (41 file changes) from `handoffs/account3/Global-Christian-Social-Network-Changes.patch` onto the separate review branch `account3-auth-recovery-review-20261027`.

## Restored features
- Registration, email login, account password change and password-reset paths
- Session invalidation and account-level rate limit storage
- Authenticator TOTP enrollment/verification, recovery codes and passkey device registration
- Additional account authentication and social-sign-in safeguards
- Social feed, sidebar, messaging layout, API performance indexes and regression checks
- Database migrations 0020 through 0025

## Conflict resolution
The original patch appended a dotted background to `public/account.css`, conflicting with the later WhatsApp-inspired illustrated authentication background fix on main. Preserved the illustrated background and restored only the accessibility-oriented password guidance font size from the patch.

## Verification and release gates
- Restored code and tests committed on review branch, NOT main.
- Separate `.github/workflows/account3-auth-review.yml` runs `npm ci`, `npm run build` and `npm run buildcheck` on branch pushes, WITHOUT deployment.
- GitHub workflow success not yet independently confirmed in this session.
- Do not merge or deploy until CI passes, tests validate with real Cloudflare bindings, migrations are reviewed/applied to the correct Account 3 D1 database, reset-email provider is configured, and real-device login/registration/passkey testing is complete.
- Required secret names include SESSION_SECRET, PASSWORD_PEPPER, INTERSERVICE_SECRET, and password-reset mail settings RESEND_API_KEY / RESET_EMAIL_FROM; do not put actual secret values into Git.

## Rollout safety
Confirm session/version migration ordering and password-reset sender before release. Protect existing user accounts and preserve a rollback plan. Run staging tests before promoting production.
