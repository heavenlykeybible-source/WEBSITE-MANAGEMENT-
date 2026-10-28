# Direct AI workspace and complete imports

This release extends the existing Control Room. It does not move production databases, reset passwords, expose provider credentials, enable automatic deployments or publish without review.

## Clients

An enabled assistant can use the Control Room's `/mcp` endpoint with its own bearer token. The Agents screen provides Claude Code, Gemini, Cursor and generic configuration. Tools are discovered using MCP `initialize` and `tools/list`; clients must not assume a connector's cached tool list is current.

OAuth clients can register 1–5 exact HTTPS callbacks, or HTTP callbacks on localhost/127.0.0.1/IPv6 loopback. Each authorization still requires the signed-in owner's consent. S256 PKCE, exact redirect matching, resource audience, short-lived single-use codes, expiring tokens and revocation remain enforced. Registration alone grants no account access. The server does not fetch arbitrary client metadata URLs.

A client that cannot support MCP may use the existing bearer-authenticated REST endpoints:

- `POST /api/agent/upload/start`: site slug, title, note.
- `PUT /api/agent/upload/{proposal_id}?path={encoded_path}`: raw file bytes.
- `POST /api/agent/upload/{proposal_id}/finalize`: send the whole update for owner review.

## Direct multi-file work

1. Discover `list_sites`, `list_files` and `read_file`; inspect the actual existing target.
2. Call `begin_site_update` once for an existing managed site.
3. Call `upload_site_file` for each changed/new file. Use UTF-8 content or base64 binary; `delete: true` proposes removal. All calls use the same proposal ID.
4. Call `get_site_update` to inspect the manifest. It belongs only to the assistant that created it.
5. Call `finish_site_update` only after every required file has arrived.
6. Call `request_owner_review`. Supported hosts can show URL elicitation; other hosts receive a secure review link. The assistant cannot approve itself.
7. The owner previews, reviews and approves the exact immutable candidate. Publication changes only the proposed files. Conflicting changes since draft creation block approval.

Capacity: 1000 files and 125 MiB per resumable update, 2 MiB per file. Individual requests remain bounded. A bundled backend Worker retains its separate 7,000,000-byte source limit. Infrastructure access still uses exact account permissions.

These direct file updates apply to sites already served by Control Room managed content. Cloudflare Workers, native assets, databases and other external applications are not silently converted into managed content. Backend code changes still require a reviewed Worker version; no production `eval`, shell execution or unsigned remote-code loader is installed.

## Repository and phone imports

External MCP clients can use `list_workspace_sources`, `get_workspace_candidates`, `import_workspace_source` and `stage_workspace_source`. Continue the same scan until complete and the same stage until waiting/archived. Agent archives use their own bearer-authenticated `/api/agent/workspace/archive` endpoint; another agent cannot read them. Scoped assistants cannot enter the global workspace, and Worker staging retains existing infrastructure policy checks.

Built website imports scan and stage in small resumable batches, rather than stopping at 40 files. Every Git blob is verified; the exact commit, complete file list and destination are recorded. Incomplete scans cannot be staged, and incomplete staged imports remain unsealed and cannot be approved. The selected destination cannot change partway through staging.

The phone/computer folder importer uploads complete built output as separate bounded requests, up to 1000 files/125 MiB. ZIP remains a separate 25 MiB bounded path. Folder selection availability depends on the device/browser.

The new Full source project choice preserves frontend, backend, migrations and build configuration in a private archive. Phone/computer source folders use hashes recorded before upload; changed files are rejected. Credentials, private keys, database copies and `.env` files are blocked. Repository dependencies and caches are reported as omitted. Source archives do not execute, seed a database or publish as static pages. They are retained for seven days and can be downloaded as streamed ZIP checkpoints. Compiled applications must still use their actual build and reviewed runtime release.

## Friendly missing pages

The included 404 pages provide homepage, Community, Apps and Bible buttons without printing code, stack traces or private request details. Control Room navigation failures use this response while preserving HTTP error status. API, MCP and asset responses retain their machine-readable behavior. No forced redirect loop or automatic cache/data clearing is added.

Static 404 assets are included for Accounts 1, 3, 6, 8/meeting, 9 and 10. Each external host must publish the asset and configure its missing-page handling before it can be claimed live there. A source file alone does not change routing on a different Cloudflare hostname.
