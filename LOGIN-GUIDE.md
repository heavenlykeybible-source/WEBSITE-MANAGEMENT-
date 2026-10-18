# Simple sign-in and account setup

The sign-in screen has Owner and Admin shortcuts. They fill the username; they do not grant permissions. Other users can type their own username or email. Press Enter or Sign in to continue. Show password and Hide password let you check typing; the form provides browser password-manager autocomplete fields.

All new account passwords use the same length rule: 10 to 128 characters. Capitals, numbers and special symbols are not mandatory. Passwords are case-sensitive, so copy a generated password exactly. Account changes, invite/reset links and self-registration follow the same rule.

The separate private-login-setup.zip contains the requested owner/admin credentials, their one-time initial account SQL, and the three Cloudflare secret values for a fresh installation. Actual passwords are not embedded in this application package. Use the private bundle's START-HERE.txt before the first sign-in. The owner has full release approval and Cloud controls; the admin manages content, team and agents and cannot approve owner-only releases.

Fresh setup sequence: create the new database → run schema.sql → run the private initial-accounts.sql → set the supplied Worker secrets and bindings → deploy → sign in. The initial SQL deliberately does not overwrite an existing account or act as a password reset. Keep the private bundle with your login records.

For an existing installation, preserve its current ADMIN_PASS and VAULT_KEY. Use the signed-in owner's Team page to add an admin and the Account page to change your own password. Do not import a fresh-install secrets file over an existing installation.

Email reset requires both an account email and configured mail sending. It is not enabled merely by showing a Forgot password link. Existing password/session invalidation and sensitive-action confirmation remain enforced.

Validation: the full repeatable application suite has 58 local checks, including separate owner/admin login, role boundaries, password changes, old-session invalidation, password length policy, and the actual dashboard's Owner/Admin and Show/Hide controls. Three further local checks tested the generated private account seed verified that rerunning initial setup did not replace an existing password, and checked the requested owner/admin-only reset file. No live Cloudflare accounts have been created or deployed by preparing these files.


Team → Add user now has an optional initial password field. Setting it creates an active user who can sign in immediately. Leaving it blank creates the existing single-use invitation link. Admins can add permitted lower-role users; only the owner can add another admin or an independent member. A newly supplied password is hashed before the new account is inserted, and is never returned in the API response.

The private bundle now also includes set-owner-admin-passwords.sql for an explicit update of matching existing owner/admin staff logins. Apply it only if those accounts already exist and you want the requested password update; it does not reset other users or encryption keys.

Set SESSION_SECRET to an independent random Worker secret, as supplied in the private fresh-install configuration. This keeps session signatures separate from human login passwords. Existing deployments without it retain legacy signature compatibility; adding it signs out old sessions and expires old signed links without changing stored connections.
