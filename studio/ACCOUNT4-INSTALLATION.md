# Account 4 installation and consolidation

## Recommended arrangement

Use one official Account 4 Control Room for sign-in, connections and release review. Keep the live media runtime in Account 2, updating its existing heavenlykey-media Worker. Keep all maintained source under WEBSITE-MANAGEMENT-/studio and release through the Account 4 connected Account 2 channel. Future AI editing and meeting services can have separate paths/sites while remaining reachable from the central Studio home.

No production account, Worker, secret, database or bucket was modified while preparing this candidate. Existing items must be inventoried with live access before deciding which are unused.

## Uploadable release

Run in studio/: npm ci; npm test; npm run check; npm run preflight; npm run verify:release.

release/studio-worker.js is a single self-contained JavaScript module containing the API, sign-in page, Studio homepage and all public assets. release/manifest.json pins its SHA-256, source hashes, asset hashes and existing target Worker. It fits the control room's one-megabyte code limit.

The normal source build uses ASSETS. The single-file release embeds the exact public asset snapshot instead, so the control room can perform the first upload without an asset API or a new binding. Old inherited ASSETS contents cannot shadow embedded files.

The prepared release contains no saved passwords, stream keys, Cloudflare tokens or provider credentials. Regenerate it from tested source for every release; do not edit the generated file by hand.

## First installation after access is available

1. Identify the actual official Account 4 control room Worker, its deployed source, database schema and current owner/admin identity store. Do not assume the older recovery-control or another control-room project has the same schema as WEBSITE-MANAGEMENT-. Preserve working login/recovery and take a backup before any required migration. Confirm the intended connected Account 2 account ID and exact existing heavenlykey-media script.
2. Deploy the reviewed control-room sign-in changes to the compatible official installation. Apply only the additive migrations/0003_studio_signin.sql to its existing control-room database after confirming schema compatibility. Do not replay media history, seed users or reset tables.
3. Configure STUDIO_URL on the control room and CONTROL_ROOM_URL on Studio to the two exact HTTPS origins. Configure the same new dedicated STUDIO_SSO_SECRET on both. Keep the original SESSION_SECRET, VAULT_KEY, MEDIA_ENGINE_SHARED_SECRET, LiveKit and social credentials.
4. Reuse the current active owner/admin records. Direct Studio password sign-in validates against that same database. If an intended admin account is absent, configure it through the official control room's existing Team process during setup; do not clone hashes, overwrite owner records or invent a replacement password.
5. Open Account 4 Cloud/Worker deployment, choose its connected Account 2, select the EXISTING heavenlykey-media Worker, paste/upload release/studio-worker.js and send it to Waiting. Check the manifest hash, staged diff and destination revision. Use the existing owner review/approval channel to install.
6. Verify the manifest version, both sign-in paths, owner/admin permissions, camera/microphone local test, LiveKit check, private upload/resume, public radio/video playback and live start/reconnect/stop. Run Settings > Check connections before testing Facebook. Start an on-air test only with the owner ready and verify incoming video/publication in Facebook Live Producer. A saved stream key is not proof of public delivery.
7. Attach studio.heavenlykey.org to the SAME existing Account 2 Worker when ready; update the configured Studio origin and reauthenticate. Keep code releases on the same channel afterward.

## Cleanup decisions

Keep the chosen controller, media Worker, current D1/R2/KV, original encryption secrets, identity/recovery, ministry-domain routes, current LiveKit and social integrations, media and audit/release history.

Inventory old control-room copies, old frontend deployments, duplicate media Workers and obsolete release workflows. Mark a candidate for retirement only after confirming it has no active domain, binding, caller, scheduled job or needed data, the replacement has passed live acceptance, and rollback is available. Archive its source/release metadata before disabling it. There is no deletion operation in this prepared package.

The old onlinebible copy remains intact as a reference/rollback source until live cutover is verified. Avoid parallel new updates to it once the official channel is established.

## Facebook finding and verification limit

The standalone Studio uses saved RTMP destinations. It does not automatically inherit the website's Facebook OAuth authorization. Current live configuration, credentials, Page eligibility and Facebook responses have not been read, so the actual present failure is not established.

Fixed a code defect that could silently treat unreadable encrypted destinations as an empty store during a save. Reconnect now fails without overwriting the existing store. Upstream errors are redacted instead of returning RTMP stream keys. Diagnostics distinguish missing/disabled Facebook setup, unavailable LiveKit and a distribution request that still needs Facebook confirmation. Connection checks do not start/stop broadcasts.

LiveKit StartEgress request structure was checked against its official API reference: https://docs.livekit.io/reference/other/egress/api/. The current room/template/output shape matches that reference; a missing-method diagnosis is not justified from source alone.

Public smoke probes to the documented Account 2 root and /health returned HTTP 403 from this environment on 19 October 2026. This does not identify whether the block is in the deployment, an edge policy or the testing environment. It is not evidence of a specific Facebook credential failure. No signed-in live configuration was read.

Starting another social distribution no longer automatically stops an existing active or uncertain egress; the operator must finish the current programme explicitly first.
