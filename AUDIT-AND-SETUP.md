# Control Room audit and Cloudflare Free setup

Reviewed 18 October 2026. Scope: the supplied standalone control-room-worker.js. No GitHub repository or live Cloudflare account was changed.

## Verdict

Suitable for a small, private control room after a staging deployment and CPU checks. This is a corrected source package, not a certified production deployment. Keep SIGNUP_OPEN=false initially. Public multi-user hosting needs the follow-up work below.

## What the application does

A single JavaScript module serves the dashboard and API. D1 holds users, roles, agents, proposals, site metadata, revisions and activity. R2 holds uploaded site files and proposed Worker code. It can manage simple block pages, R2-backed static sites, GitHub files, WordPress and Blogger content, Cloudflare Workers and AI provider accounts. AI clients can connect through the bearer-token REST API or its basic HTTP MCP endpoint. Agents propose changes; humans review them. Member accounts have a separate scope for their connections and proposals.

The uploaded file contained no SQL schema or Wrangler configuration. The included schema is for a FRESH installation. The advanced upgrade also includes migrations/0002_release_controls.sql specifically for a database created from the previous package; it is not a migration for an arbitrary older database. Read ADVANCED-RELEASE-GUIDE.md before upgrading.

## Fixes made

| Finding | Correction |
| --- | --- |
| Original ADMIN_PASS still logged in after UI password change/reset | Bootstrap secret stops authenticating once the owner has a stored password. Keep the secret: it still signs sessions and capability links. |
| Preview capability links could be minted without checking proposal ownership | Check ownership, upload type and sealed status before signing. |
| Staff admins could approve proposals despite the stated owner-approval model | Staff proposal approvals and undo require the owner; independent members retain approval within their own account. |
| Browser policy blocked preview iframes | Explicitly allow same-origin/about preview frames; retain sandboxing and prevent external framing of the dashboard. |
| JSON and MCP request bodies were buffered without a byte limit; null/arrays caused failures | Stream-enforced byte limits and object validation; MCP uses the same reader. |
| Raw uploads trusted Content-Length, rejected empty files, and counted replacements twice | Check actual bytes, accept empty files, subtract replaced size and permit replacement at the file-count cap. |
| Unicode file sizes counted characters | Proposal file sizes now use UTF-8 bytes. |
| Large imports could silently omit files and consume excessive operations | Limit GitHub imports to 10 eligible files; reject larger imports and truncated repository trees explicitly. Use smaller folders or direct uploads. |
| Large GitHub files could be edited after silent truncation | Reject oversized files; show full proposed GitHub and Worker content in review. |
| AI tool filtering only affected advertised tools | Enforce the actual allowed tool names before dispatch. Cap tool executions at four per chat request. Oversized results return an explicit error instead of partial source. |
| Concurrent AI requests could evade the daily message counter | Use a single conditional SQL increment with RETURNING. |
| Hard-coded provider model could be unavailable | Require a model ID supplied by the user/provider; ANTHROPIC_MODEL is required for the built-in secret shortcut. |
| Weak new-password hashing | New passwords use 100,000 PBKDF2 iterations; existing hashes retain their recorded iterations. Profile Cloudflare CPU before accepting this configuration. |
| Old upload undo could overwrite later edits | Reject undo if current file pointers differ; recover original recorded sizes where available. This check is not a distributed lock. |
| Missing signing secrets could produce predictable signed links | Fail closed when ADMIN_USER or ADMIN_PASS is absent. |
| Cross-origin requests and reset-link referrers | Reject cross-origin API/MCP browser requests; suppress referrers; dashboard uses no-store. Selected authenticated outbound API calls reject redirects. |
| Excess polling and public signup defaults | Poll once per minute; new self-registered members start with private profiles. |

## Fresh installation

1. Create a D1 database named approval-queue-db and an R2 bucket named approval-queue-files, using Standard storage. Keep the bucket private.
2. Copy its D1 database ID into wrangler.toml. DB and FILES are case-sensitive binding names.
3. Run schema.sql against the new database. With Wrangler:

```sh
npx wrangler d1 execute approval-queue-db --remote --file=schema.sql
```

4. Set secrets through the Cloudflare dashboard or Wrangler:

```sh
npx wrangler secret put ADMIN_USER
npx wrangler secret put ADMIN_PASS
npx wrangler secret put SESSION_SECRET
npx wrangler secret put VAULT_KEY
```

Choose a lowercase username, a long unique password, and a separate random VAULT_KEY of at least 32 characters. Never put them in the source or TOML. Losing/changing VAULT_KEY makes saved encrypted provider credentials unreadable. Changing ADMIN_PASS invalidates existing signed sessions and links.

5. Keep SIGNUP_OPEN=false. Optional email settings are ADMIN_EMAIL, RESEND_API_KEY and MAIL_FROM. Optional built-in AI settings are ANTHROPIC_API_KEY and ANTHROPIC_MODEL. Other AI accounts are configured through the dashboard. Provider API usage is billed separately from Cloudflare hosting.
6. Deploy the module and configuration:

```sh
npx wrangler deploy
```

7. Sign in with the bootstrap credentials, set a new password in Account, and verify the old bootstrap password fails. Test an agent proposal, preview, owner approval and undo. Use a disposable GitHub repository/Worker/blog for initial external-write tests.
8. Inspect Cloudflare CPU and invocation metrics while testing login, password reset, large previews, domain-record views and AI chats. Do not assume passing local tests proves the 10 ms CPU budget is met.

For an existing deployment, export D1 and preserve R2 first. Compare the real table definitions with schema.sql and write a specific migration; CREATE TABLE IF NOT EXISTS does not add missing columns. Do not reset or overwrite the existing database using this package.

## Free-plan considerations

Official documentation checked 18 October 2026:

| Service | Included allowance relevant here |
| --- | --- |
| Workers Free | 100,000 requests/day, 10 ms CPU per HTTP request; external subrequest limits also apply. |
| D1 Free | 5 million rows read/day, 100,000 rows written/day, 5 GB total account storage. These are rows, not SQL-query counts. |
| R2 Standard | 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month. Usage beyond allowances can be charged. |

Workers: https://developers.cloudflare.com/workers/platform/limits/
D1: https://developers.cloudflare.com/d1/platform/pricing/
R2: https://developers.cloudflare.com/r2/pricing/

The free plan is realistic for light private management. Large imports, cryptography, long AI tool loops and public record-chain verification need profiling and smaller operations. Hosting every static file through this Worker spends Worker, D1 and R2 operations; prefer Cloudflare static asset hosting/Pages for public site traffic and keep this application as the control panel.

## Important remaining work

- Distributed consistency: immutable uploads, upload/finalize coordination, serialized publication, applying/uncertain states and explicit reconciliation are now implemented. External APIs and the release database still cannot commit atomically together. Do not blindly retry a failed publication; inspect its destination first. See ADVANCED-RELEASE-GUIDE.md.
- Cleanup and quotas: no automatic expiry of abandoned/rejected uploads, old revisions, reset tokens, usage counters or audit logs. Add retention that preserves every R2 object referenced by live files and backups. Rate-limit public traffic at the edge; existing IP counters are not a complete abuse control.
- Passwords: 100,000 PBKDF2 iterations improve the original 10,000 but are not a full modern identity design. Existing users need a password change to gain the stronger setting. Prefer managed authentication/passkeys and MFA for an internet-facing control plane; measure CPU before enabling many password accounts.
- Worker deploys: single-file uploads are not a complete deployment system for multi-module Workers. Existing bindings are inherited, but other deployment settings may change. Do not use this feature to overwrite an important multi-module Worker or this control room without a tested rollback.
- Public proofs: the work-record chain is tamper-evident relative to its stored contents, not an independently anchored proof. Concurrent work creation can fork it; the 500-record public view can show only a prefix. Direct human save endpoints do not create the same records as approved proposals. Public records can reveal author/approver labels even when a profile is private.
- Integrations: Blogger OAuth state now uses a one-use nonce bound to the initiating account and browser. Domain verification, custom provider URLs and their DNS/redirect behavior still need stricter controls for a public service. Basic MCP support needs testing with your intended client; it has no OAuth discovery flow.
- Public sites use subpaths and sandboxing. Root-relative asset URLs and features needing same-origin storage/service workers may not work. Use a separate site origin for full websites.

## Validation performed

Run with Node.js 24 or newer:

```sh
node --disable-warning=ExperimentalWarning tests/run.mjs
```

The complete suite now passes 58 local checks, including remote editing/export, release controls and dashboard interaction logic. SQLite is real; provider calls, storage and the dashboard DOM are mocked. No live Cloudflare deployment, browser visual test, provider billing test or external publishing test was performed. See the advanced guide for coverage and limits.


## Second audit: WordPress/Blogger editing and export

See WORDPRESS-BLOGGER-AUDIT.md for the follow-up changes, capability limits and test results. The package now includes scoped JSON/HTML post exports, pagination, publication-status preservation, stale-edit checks and stronger Blogger authorization. No database migration is required for these follow-up changes; OAuth nonces use the existing settings table.


## Advanced upgrade

Read ADVANCED-RELEASE-GUIDE.md for the current staged review, release history, source protection, local recovery and required upgrade migration. Those instructions supersede earlier descriptions of proposal approval. The WordPress/Blogger export features remain included.


## Prepared owner and admin logins

A separate private setup bundle provides owner/admin credentials and fresh-install account provisioning. Read LOGIN-GUIDE.md. Those logins are not active on Cloudflare until its setup steps and deployment are completed.
