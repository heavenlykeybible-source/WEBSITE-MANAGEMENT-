# Owner and admin setup

This update is prepared locally; it has not been deployed to a live Cloudflare account.

## Initial logins

| Username | Role | Initial password |
| --- | --- | --- |
| owner | Owner | Supplied privately at setup |
| admin | Admin | Supplied privately at setup |

The usernames are aliases for owner@studio.local and admin@studio.local. They are local studio identities, not email inboxes. No verification email is required for these or admin-created accounts.

Only upload the contents of `site/` (or the enclosed `site.zip`) as the Cloudflare Pages website. Never upload the whole project as public assets: the private account setup script contains password-derived provisioning values.

## Activate on Cloudflare

1. Back up the existing D1 database before upgrading.
2. Fresh installation: run `server/schema.sql` on your D1 database. Existing installation: run `server/migrations/2026-10-roles.sql` once. Older databases also need the existing retention migration if it has not been applied. Do not run the role migration after a fresh schema install.
3. Keep/bind that database as `TEAMDB`. Keep the same `AUTH_SECRET` (32+ characters) used by the existing website. This is a private deployment secret, not a password users enter. It also protects existing channel tokens; do not casually change it.
4. On a private computer with Node.js, supply that exact secret through `AUTH_SECRET` and your chosen initial password through `STUDIO_INITIAL_PASSWORD` and run `node server/setup-accounts.mjs > initial-accounts.sql`.
5. Import the generated SQL into the same D1 database using its console or Wrangler. The generated SQL contains password hashes, not the plain password. It inserts the two initial accounts only if they do not exist. It never overwrites existing passwords or roles. If those usernames already exist, resolve the conflict privately before deployment.
6. Deploy `site.zip` with index.html and _worker.js at its root. Sign in as `owner` and open Admin.
7. Create users with a username/email and a password of at least eight characters. Owner can also create admins or promote users. Admin can create, reset and suspend ordinary users. Owner and admin have staff access without subscription purchase. Regular users still use the existing access-plan rules; use +7/+30 days to grant their access.

An admin can reset another ordinary user's password without email delivery or a second password. Password resets end that user's previous sessions. Every account can change its own password under Account > My password. Username accounts should ask an admin for forgotten-password assistance.

Owner is protected from suspension, administrative password resets, role changes and self-deletion. Only the owner can manage admins. Existing `ADMIN_EMAILS` settings remain supported; existing configured identities cannot be registered publicly. `OWNER_EMAILS` is optional for an already-provisioned owner identity; it must never be used as a substitute for provisioning.

YouTube/Facebook still require platform authorization and configured developer credentials. Account login changes do not remove those platform requirements. In accounts mode, the studio obtains its relay token automatically. The streaming server must still have a matching `RELAY_SECRET` and configured `RELAY_URL`; no user-facing relay password is necessary.

24/7 Radio is marked on hold in the Start screen. Its underlying code is retained for later work. Password-free Control Room entry is a separate integration and is not added here because no Control Room source or signing configuration was supplied in this package.
