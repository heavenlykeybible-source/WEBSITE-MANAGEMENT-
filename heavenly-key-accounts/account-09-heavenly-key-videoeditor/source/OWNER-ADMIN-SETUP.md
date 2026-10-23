# Owner and Admin setup for Account 9

Two separate privileged users are required. Owner email is `emmanuelmeta247@gmail.com`. Admin requires a different valid email address, which has not yet been provided. No live accounts have been created.

**Do not reuse `Apostolic@1`: it was posted in chat, and this application currently requires at least 12 characters in a password.** Choose two different strong passwords.

1. Apply D1 schema and migrations as described in `DEPLOY.md`.
2. On a private machine or appropriately protected CI runner, set environment variables `HK_OWNER_EMAIL`, `HK_ADMIN_EMAIL`, `HK_OWNER_PASSWORD`, `HK_ADMIN_PASSWORD`. NEVER add these values to source files, commands stored in shell history, logs, or committed `.env` files.
3. Run `node scripts/provision-roles.mjs /secure/private-path/account9-initial-roles.sql`. Output SQL is created with restricted 0600 permissions and contains password hashes; treat it as sensitive.
4. Execute the SQL ONCE against the correct private D1 database using authorized operator tools. It inserts two identities with random salts and salted PBKDF2 password hashes; it will refuse duplicate email addresses. Delete private SQL after confirmation.
5. Use `/api/login` to verify each account, then `/api/me` to verify `role: owner` and `role: admin`. Log out and check invalid sessions.
6. Configure MFA and account recovery before a public launch. Password reset is not yet implemented.

Ordinary registration always creates the `member` role and cannot grant administrator status. API roles currently have no special media-edit permissions beyond protecting privileged account deletion. Granting additional actions requires explicit authorization checks for each future endpoint.
