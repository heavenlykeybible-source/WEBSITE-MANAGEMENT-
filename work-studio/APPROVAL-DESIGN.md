# Studio approval boundary — implementation contract

Status: design only. No runtime approval enforcement added by this commit.

## Evidence and entry points

Core source/src/routes/broadcast.ts authorizes Administrator and proxies live start/stop and source switches; when MEDIA_ENGINE_URL is absent some handlers use Core services instead. Core source/src/routes/media.ts can approve publication through Media.approveMediaForPublication. The Media Engine also has direct authenticated mutation endpoints. A gate in only one of these locations leaves a bypass.

## Required workflow

1. Authenticated people or connected AI submit a proposed change for a specific connected site. The proposal stores an immutable payload, operation, site ID, base version, creator, content hash, preview artifact and UTC timestamp (display in Africa/Lagos).
2. Private uploads and drafts remain private. Saving an upload must not publish it. The waiting room displays one row per proposal with site, title, submitted Lagos date/time, version, status, preview and decision controls.
3. A verified owner reviews the exact preview and approves or rejects. AI/service identities cannot approve. Do not accept owner roles supplied in request JSON. The exact deputy approval policy must be made explicit rather than inferred from existing streaming permissions.
4. Approval binds the site, operation, payload hash and base version. Any edit invalidates that approval. Credentials, provider secrets and stream keys never enter preview artifacts or proposal logs.
5. Execution checks current site connection, owner identity, approval status and version, then atomically claims the approved operation in D1. Concurrent executions must not duplicate effects. Each external call receives a stable idempotency key when the provider supports it.
6. Record pending, approved, rejected, executing, succeeded and failed outcomes with actor/time and safe error details. Uncertain provider outcomes require reconciliation; never mark success merely because a job was queued.
7. Disconnecting a site revokes outstanding execution grants. Direct Core fallback routes, generic proxies, engine routes and background jobs must all enforce the same policy. No missing configuration may silently select an ungated legacy write path.

## Operation handling

| Operation | Required policy |
|---|---|
| Private upload, local preview, private preset | Authenticated preparation; no public side effects |
| Publish/unpublish, playlist order/settings, schedule/cancel, public source switch | Approved operation before effect |
| Start live/social transmission | Explicit owner-authorized session scope and destinations before transmission |
| Heartbeat/reconnect/token refresh | Continue only the already authorized session; cannot change scope |
| Stop active transmission | Preserve an authenticated emergency stop; log action. Approval must never trap a live microphone on air |
| Secret/connection changes | Separate restricted settings flow; redact values and require explicit owner authorization |
| Automated expiry/cleanup | Document retention authorization; protect KEEP and active programme dependencies |
| Deployment/restore | Preserve Account 4 review, worker identity, persistent bindings and forward-only data migrations |

## Required regression tests before enforcement is called complete

- Unauthenticated/member/AI identities cannot approve or execute.
- All direct, proxy and legacy Core fallback publication paths reject missing approval.
- Wrong site, disconnected site, expired approval, changed payload and stale base version reject.
- Two concurrent executions cannot claim one approval twice; provider timeout is reconciled.
- Preview/draft uploads remain private; secrets never appear in logs or previews.
- Heartbeats cannot authorize a new session/destination; emergency stop remains usable.
- Account 4 sign-in uses verified short-lived identity grants, not removed authentication.
- Browser and real provider tests verify actual capture, playback and streaming separately from build tests.

## Environment limitation

On 2026-10-19 the local execution environment was unavailable. Repository inspection and documentation corrections were completed through GitHub. No new runtime tests or deployment are claimed for this design commit. Prior authentication tests belong to commit 5e05b81f93a3d7c176db988ce05ad932190755f6.
