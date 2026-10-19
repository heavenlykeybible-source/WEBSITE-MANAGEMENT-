# Cloudflare account connection

Navigation now says **Cloudflare**. Open **Cloudflare → Add account**.

1. **Open Cloudflare.** The official token-creation page opens in a separate tab. Sign in, select the intended account and create a token with Workers Scripts: Edit. If you already have a suitable token, skip this step.
2. **Return and connect.** Enter an account label, the exact 32-character Account ID and the API token. Click Connect account. For this studio, select Account 2 and use a label such as Account 2 Studio.

The form shows Connecting while it checks the token against the specified account. Successful connection clears the token field and offers View connected accounts. Errors stay on the page. The button prevents duplicate submissions while checking. If the browser times out, check the account list before retrying because the server may already have saved the connection.

Account ID is explicit in the guided form because valid tokens do not necessarily permit automatic account discovery. Labels accept ordinary Unicode text, including long dashes (normalized to a plain hyphen). No Cloudflare password belongs in the token form. Credentials remain encrypted with the existing VAULT_KEY; no keys, bindings, databases, accounts or saved connections are reset.

## Direct authorization

Cloudflare supports registered third-party OAuth clients. That separate flow requires creating a client in Manage Account → OAuth clients, configuring its allowed redirect URL and scopes, and implementing the callback/token lifecycle. It is not activated by the token-creation link. This change implements the guided token option; it does not label a token link as automatic OAuth authorization.

Official references:
- https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/
- https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/
- https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/

## Deployment and validation

Publish the updated root control-room-worker.js through the existing Worker deployment, preserving the current DB, FILES, SESSION_SECRET, ADMIN_USER, ADMIN_PASS and VAULT_KEY. No migration or credential reset is required. Committing the source does not prove that a live deployment occurred.

The complete local Control Room test suite passed. New checks exercise the actual dashboard form handlers (mock DOM/HTTP), loading state, validation, double-submit prevention, inline errors, token clearing, encrypted storage, typographic labels, invalid account IDs, provider permission errors, network failure and preservation of existing encrypted tokens on failed replacement. Real Cloudflare token acceptance requires a live credential supplied privately by the owner.
