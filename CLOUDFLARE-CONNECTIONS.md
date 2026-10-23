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

## Workers runtime compatibility correction

The previous connection helper used `redirect: "error"`, which Cloudflare Workers rejects before sending a request. The catch block incorrectly described every fetch failure as a timeout. This update uses `manual`, blocks Cloudflare API redirects before consuming the response, and distinguishes actual timeout/abort errors from other request failures. It also removes the unsupported option from the other authenticated provider helpers (Workers maintenance, WordPress/Blogger, Google Drive and GitHub). Manual redirects do not forward credentials to another address.

Regression checks emulate the Workers rejection of the unsupported mode, require manual redirects, verify a redirect does not trigger a second request or save credentials, and distinguish real timeouts from network/request failures. All existing credentials, bindings and databases remain unchanged.

Reference: https://developers.cloudflare.com/workers/runtime-apis/request/

## D1, R2 and deployment bindings

Cloudflare account cards include **D1 / R2 resources**. List databases or buckets, follow the next-page control, or propose one empty database/private bucket. Creation goes to Waiting. Review shows the saved account ID, resource type and exact name; approval uses the existing immutable review and release process. A resource that already exists is kept, never replaced. If a creation response is lost, the release is uncertain and cannot be replayed automatically. Verify the destination before any further action.

The API uses the account's encrypted saved token. D1 operations require D1: Edit (API permission D1 Write); R2 creation requires Workers R2 Storage: Edit (Workers R2 Storage Write). Worker deployment requires Workers Scripts: Edit. Listing proves read access only; a write may still be denied. Provider-side permissions must be granted in Cloudflare. The application cannot grant privileges to its own token. No account-wide administrative token, billing permission or token-management privilege is needed for these operations.

Worker proposals accept optional new bindings:

```json
[
  {"type":"d1","name":"TEAMDB","id":"existing-database-uuid"},
  {"type":"r2_bucket","name":"FILES","bucket_name":"existing-private-bucket"},
  {"type":"ai","name":"AI"}
]
```

Create resources first, then use their IDs/names in a Worker proposal. D1 and R2 targets are verified in the selected account. Existing binding names cannot be redirected to different resources. Existing secrets, database/storage bindings, assets and compatibility settings are inherited. The reviewed binding metadata is pinned along with the Worker revision. This interface does not upload a static asset package, execute database SQL or set new secret values; these are separate capabilities still needed for the complete meeting-app installation.

Connected AI clients can use `list_cloudflare_resources` and `propose_cloudflare_resource`; `propose_worker_deploy` now accepts the same bindings array. Scoped/member agents cannot use these infrastructure operations. AI tools can inspect metadata or queue proposals; they cannot approve their own work. Ordinary staff still follow the existing role restrictions.

Saved Cloudflare accounts survive updates, schema reapplication, sign-outs and failed checks. Explicit removal requires an admin/owner and the exact saved account label. Removing a saved connection does not delete any Cloudflare resource. Existing vault and database bindings must remain unchanged during publication.

Account 7 (`6401a8f41a41f5325ba5bd4d006b4ff5`) is the current Meeting App target. Account 2 is the separate Studio and must remain untouched. The Control Room itself remains the existing `website-management` Worker on Account 4.

API references:
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/
- https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/create/
- https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/

### Complete meeting package and generated secrets

Worker proposals now allow `generated_secret` bindings such as `{"type":"generated_secret","name":"AUTH_SECRET"}`. Only missing bindings receive a new 256-bit secret. Values are encrypted in settings and sent directly to Cloudflare metadata; they do not enter proposal previews, logs, public assets or GitHub source. Existing secret bindings are always inherited. The bounded code limit is 1.4 MB; the request limit remains 1.5 MB.

The Zoom project includes a reproducible compressed single-module package for the existing upload form. This replaces the need for a separate static asset upload for this app. It initializes only CREATE IF NOT EXISTS tables/indexes and supports owner entry from the existing Control Room owner session. The owner-launch endpoint is fixed to the Account 7 meeting Worker; it never returns the shared secret, and its signed ticket is sent by POST and consumed once. Other accounts, member users and ordinary admins cannot use this owner entry.

The owner selected Account 7's existing `heavenlykey-db` and `heavenlymedia` resources. The obsolete P-4 database creation proposal is not needed for that selection. Do not approve it as part of the meeting app deployment.

### Direct reviewed installation

Account 7's card includes **Install meeting app** for the signed-in owner. The server verifies the embedded package's SHA-256 and queues that exact code plus the selected D1/R2/AI/generated-secret bindings. No browser file picker or manual code paste is required. This action creates a Waiting proposal only; it does not publish, create databases or seed passwords. The existing owner review and release process still controls deployment. The endpoint refuses other accounts and non-owner users.

To update the embedded package reproducibly, run `node zoom-studio/scripts/bundle-control-room.mjs`, then `node zoom-studio/scripts/embed-control-room-package.mjs`, followed by the required checks. The embedded data contains the public website and backend code only; it contains no private tokens or passwords.
