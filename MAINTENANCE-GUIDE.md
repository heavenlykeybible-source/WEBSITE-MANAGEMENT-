# Cloudflare AI maintenance

This release adds a separate maintenance tool to the connected AI/MCP toolset and the built-in assistant. This is prepared code, not a deployed service.

In Cloud → AI maintenance permissions / log, the owner selects one active staff agent, exact Worker names and/or a Cloudflare Zone ID with exact hostnames, and grants 1–24 hours of access. Enter the owner's password to grant, replace or revoke access. Built-in assistant agents appear after the first chat with that AI account. Site-restricted and member agents cannot receive this account-level capability.

Supported actions without a visual preview:

- `worker_status`: read existence and last deployment time of an explicitly granted Worker. This is not runtime log collection or a complete health check.
- `purge_urls`: clear cache for 1–10 HTTPS URLs on exact granted hosts. No wildcard, whole-zone purge, arbitrary API endpoint, source edits or shell execution.

Tell the AI the connection ID and what to check or which URLs to clear. The tool checks the agent, connection, expiry and resource scope at execution. Token material and Worker settings/secrets are never returned. The existing encrypted Cloudflare token needs Workers Scripts Read for status checks; cache operations need Zone Read and Cache Purge on the selected zone. Cache grants verify the zone belongs to the selected account. Use the narrowest token resources possible.

Every execution has an action ID and durable running/succeeded/failed/uncertain record. Network errors after a purge request are uncertain: inspect the destination before another attempt. There are no automatic retries. A crash can leave a running record. Revocation and execution share a connection lock: revocation cannot cancel an already executing request. Disconnection makes subsequent operations fail.

Code fixes continue through the existing deployment proposal review flow. Maintenance does not grant code publishing, DNS, database, access-policy, billing or resource deletion tools. These unsupported operations are rejected, rather than treated as an approval bypass. Existing human Worker deletion now also requires owner password reauthentication and the exact Worker name. Website direct editing routes and the separate upload/editor enhancements are not changed by this maintenance release.

No schema migration is needed beyond the existing package schema/release migration; grants and action records use settings. Logs are retained without automatic deletion; monitor D1 storage over time. Cloudflare permissions and real account operations still need deployment-time testing. Local tests use mocked Cloudflare HTTP responses and real SQLite.

API reference used: https://developers.cloudflare.com/api/resources/cache/methods/purge/
