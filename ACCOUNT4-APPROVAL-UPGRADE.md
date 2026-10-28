# Account 4 approval and domain upgrade

Target: existing `website-management` Worker on saved Cloudflare Account 4, connection 5. Preserve production D1, R2, secrets, owner records and all account connections. No production migration or reset is needed.

## Changes

- Preserve the owner-only Meeting Studio menu shortcut and passwordless signed launch; repair its browser JavaScript URL validation.
- AI permissions: select all saved accounts in one screen and optionally share bounded access with all enabled, unscoped staff AI connections. Selected account scope, expiry, revocation and disabled-agent checks remain in force. Shared access includes Worker status inspection, preparation and proposals; it never self-approves publication.
- External MCP AI can request several accounts in one request. Supporting clients receive negotiated URL elicitation; other clients receive a secure review link. The signed-in owner can approve or decline and share the requested access across enabled staff AI. Repeated equivalent pending requests are reused.
- Optional ten-minute owner verification session in tab memory avoids repeated password entry. Each release still needs an explicit click on its staged version. Server checks owner role, password version and expiry. Proofs and passwords are not put in browser persistent storage.
- Returning from a provider verification link rechecks the saved API connection and reports missing-token permissions instead of silently appearing complete. Cloudflare dashboard login is not an OAuth grant to the saved token.
- New heavenlykey.org Worker-subdomain requests use Cloudflare's documented custom-domain API after explicit owner approval. They verify the active zone, existing Worker and account, refuse existing DNS/mappings, recheck immediately before writing, record uncertain outcomes, and block blind replay. A Worker and zone must be in the same account. Cross-account routing and arbitrary DNS editing are outside this change.
- Waiting includes account-authorization entry and subdomain requests. Expired or resolved requests cannot publish.

## Validation

`npm run build:cms`, `node tests/run.mjs`, `node tests/account4-studio-menu.mjs`, `node tests/account4-permission-ui.mjs`, `node tests/domains.mjs`, `npm run test:cms-dom`, and syntax/diff checks passed locally. The full runner includes the new unified-access suite covering multi-account grants, isolation, native-host handoff/fallback, approval-session expiry/password revocation, domain conflicts, no external write before approval, and replay denial. Cloudflare/provider calls in these tests are mocked.

## Release status

Prepared source only. No live deployment or production functionality has been verified. This session's Control Room connection previously denied maintenance access. The Account 4 GitHub workflow remains manual-only with an exact approved main SHA. GitHub environment required-reviewer configuration and Cloudflare build triggers have not been verified. A ChatGPT-native popup depends on the client advertising MCP URL elicitation; website code cannot force unsupported host UI. Refreshing/reconnecting the MCP tool list may be required after release.

## Fivefold Worker limit and Account 10 recovery

Worker code limit is now 7,000,000 UTF-8 bytes (formerly 1,400,000); the large JSON envelope is 30 MiB (formerly 6 MiB). Both MCP and owner/agent propose-worker routes use the expanded envelope; ordinary authentication requests retain their smaller bound. The standard file/ZIP limits are unchanged. These source changes are not live until the protected Control Room Worker is released by the owner.

Account 10 source was recovered from codex/heavenly-key-studio-refinement, commit 487e7500c703d17bca99a9439864e7e2164506ff. It contains the Social Management Worker, both public assets, schema and five migrations. The saved Account 10 database ID matches its configuration. Prior missing-source conclusions based only on main were incomplete. A new complete review candidate was accepted as Waiting proposal 39. TypeScript, dry-run deployment, exact public asset delivery, unauthorized API denial and isolated schema/migration checks passed; no production migration or provider action was run. The installed dependency mismatch was fixed by pinning compatible development versions. Earlier agents’ full proposal/release history cannot be audited with my_proposals, which is scoped to this agent.
