# Account 4 — Website Management Control Room

The newer Website Management control room in repository root on `main` is authoritative.

The `source/`, `uploaded-reference/`, and `recovered-onlinebible/account4-control-room/` files contain historical implementations for comparison only. Do not replace the modern control room or deploy the historical Worker, authentication, permissions, UI or schemas.

Before migrating any feature, verify it is absent from the latest implementation, bring over only the missing functionality, run tests, preserve production bindings and obtain deployment verification. Other accounts follow the same latest-version-wins rule.


## Owner password security (Account 4)

The owner password reset route now requires a verified owner identity. An ordinary Cloudflare Access administrator cannot change the owner's password.

For initial setup or recovery through the Access-protected Control Room, configure the `OWNER_ACCESS_EMAIL` Worker secret with the *specific email address* assigned to the owner in Cloudflare Access. Do not commit that email or any password to GitHub. The email must exactly match the verified Access JWT identity (case-insensitive). Without this configured identity, administrators can work normally but cannot reset the owner password.

An owner who is already authenticated on the dedicated owner dashboard can change their own password. Changing the password revokes all existing owner sessions. After deployment, verify owner login, administrator login, logout, access denial for a non-owner administrator, and password rotation using two browsers.

Production deployment continues to require owner approval.
