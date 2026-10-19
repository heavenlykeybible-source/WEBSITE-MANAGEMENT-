# Account 1 → Account 2 Proxy Hardening

## Completed
- Administrator broadcast start/stop/heartbeat controls proxy to the Media Engine when configured.
- Administrator live → prerecorded switching proxies to Account 2.
- Administrator prerecorded playout scheduling/listing proxies to Account 2.
- Administrator recording registration/keep/delete proxies to Account 2.
- Administrator social-account connect/list uses Account 2 for the automatable account registry.
- Public live-status reads from Account 2 when the integration is configured, so Account 1 does not need a second live-state store.
- Core signs a short-lived HMAC capability for administrator operations; the browser never receives the shared secret.

## Deliberate boundaries
- The existing Core spiritual-media catalogue is not silently replaced by the Media Engine catalogue. This prevents a partial migration from breaking Bible/hymn/community media references.
- Real encoder/transport and third-party social APIs remain external provider responsibilities.
- Temporary broadcast recordings/media remain subject to Account 2 retention cleanup unless explicitly marked KEEP.

## Production gate
Do not remove Account 1 media/broadcast bindings until staging proves the Dashboard's complete live, prerecorded, recording, and distribution workflows through Account 2.

## Account 2 media upload hardening
Account 2 now exposes an administrator-capability protected `PUT /api/media/{id}/upload` endpoint for media objects registered in Account 2. The endpoint streams the request body directly to Account 2 R2, enforces a 100 MB Content-Length ceiling, checks the registered MIME type, and records the uploaded size. This path is for Account 2 temporary/broadcast media only; it does not replace Account 1's spiritual-media catalogue.
