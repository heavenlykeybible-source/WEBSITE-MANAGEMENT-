# Account 4: AI Worker Development Studio

Status: **foundation and safety checks implemented; end-to-end studio is not yet implemented or launched**.

## Goal

An authorized AI, whether from a connected ChatGPT MCP client or the Control Room's own AI, can inspect and propose changes to a *specific* Cloudflare Worker without requiring a GitHub commit. The existing `propose_worker_deploy` tool and Waiting proposal system are the starting integration, but they do not yet supply a safe full-app preview or a complete multi-module build pipeline.

## Required lifecycle

1. Owner grants access to the exact Cloudflare connection and specific Worker, with expiry. AI never receives or exports the Cloudflare credential.
2. Read **all** active source modules, compatibility options, assets, and a non-secret binding manifest; take a base version ID / source hash. Never assume a single-file Worker represents a multi-file application.
3. AI edits a private workspace copy. Validate syntax, imports, compatibility, dependencies, target account, and changes. Protect production resources.
4. Create an **isolated Cloudflare Preview** with separate test D1/KV/R2/storage and limited outbound capabilities, never production secrets or production traffic. A Worker Version URL is *not* sufficient isolation because it can reuse production bindings.
5. Run HTTP smoke checks, UI/mobile browser checks, and auth/security acceptance tests against preview. Save screenshots, diagnostics, a file diff, and a preview URL.
6. AI finishing the task creates exactly one Waiting Room release candidate. It cannot approve or publish its own proposal.
7. Owner signs in, inspects live demo, scope, diff, security checks, binding changes, and before/after snapshot, then approves or declines the *exact immutable revision*.
8. At approval, re-check current production version, approved bytes/hash, ownership, Cloudflare account, Worker name, compatibility and resource bindings. Any changed baseline or unavailable test evidence must block release.
9. Publish only the approved version, preserve production bindings, verify its live health, and retain a rollback reference. Fail closed on ambiguous Cloudflare responses.
10. GitHub export/backup is optional and never required for the ordinary Worker-editing workflow.

## Mandatory boundaries

- No implicit access to *all* accounts; each connection requires explicit owner permission.
- Do not execute arbitrary user code inside Account 4's management Worker.
- No production preview under the live hostname; no unreviewed DNS, domain or production release changes.
- Only a human authorized as owner can approve production changes.
- Preserve full multi-module code, static assets, Worker settings, secret bindings and version history; refuse unsupported architectures rather than silently replacing them with one module.
- A preview is **not** proof that production state is safe; migration and binding changes require separate manual review.
- Externally connected MCP assistants are not authenticated dashboard owner sessions and cannot self-grant owner permissions.
- All events need audit records including agent, target, source/version digest, preview revision, approval actor, release version and rollback reference.

## Already present in code

- Cloudflare connections and read/list Worker AI tools.
- AI proposal tools for Worker code/attachments.
- Waiting Room and human decision controls.
- Owner authorization, approval and MCP connection mechanisms.

## Still to implement

- Full multi-module live Worker snapshot and version/hash locking.
- Private editable AI workspace and file-level diffs.
- Isolated Cloudflare Preview provisioning and test resource mapping.
- Automated functional/security checks and browser demo.
- Atomic immutable Waiting Room artifact with automatic submission on AI completion.
- Approved-version publication with baseline re-check, safe rollback and post-release verification.
- End-to-end tests against a dedicated disposable Cloudflare test account.

The policy module `workspace/worker-studio-policy.js` and `tests/worker-studio-policy.mjs` are initial fail-closed validation scaffolding. They are **not yet wired to production routes** and must not be represented as a completed studio.
