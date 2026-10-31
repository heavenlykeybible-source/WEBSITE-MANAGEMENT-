# Account 2 Studio — production release gate

Changes are staged on the development branch only. Do not merge or deploy without explicit owner approval.

## Mandatory before applying the new Worker
1. Back up the D1 database and snapshot the current LiveKit egress IDs and state.
2. Apply the D1 migrations in order, including `0006_restream_operation_lock.sql` and `0007_restream_active_state.sql`, to the same D1 binding used by the deployed Worker.
3. Confirm the two tables exist and `MEDIA_ENGINE_SHARED_SECRET` is configured. Never copy streaming keys into logs.
4. Check GitHub CI: `npm run test:broadcast`, `npm run check` and `npm run preflight` must all pass.
5. Perform a controlled cutover; verify that any on-air legacy KV record is adopted into D1 and still points to the same LiveKit egress, without interrupting an active programme.
6. Test start, stop, replacement, reconnect, camera/microphone, RTMPS streaming to real destinations, provider rejection, and a fresh 24/7 session. Confirm unauthorized users cannot control broadcasting.
7. Simulate two simultaneous start requests and overlapping start/stop requests, and verify that the D1 operation lock admits only one operation at a time.
8. Confirm application status from multiple regions and verify monitoring, alerts, and recovery procedures.

**Launch blockers:** successful CI alone does not demonstrate safe legacy cutover, credential validity, actual media output, multi-region correctness, or complete security.


## Owner directive: television is locked; radio only

Television is on hold and must not be unlocked without a separate explicit owner instruction and a reviewed release. The Account 2 `TV_LOCKED` backend gate denies public TV programmes and public video playback (HTTP 423), TV destinations (including `both`), TV playlist/settings changes, TV social egress starts, and new scheduled TV playouts. Cron does not activate previously scheduled TV videos. Radio audio scheduling, radio programmes and explicitly radio-directed streams remain available. Media management and authenticated video previews are preserved for future work; the television broadcasting channel is not enabled.

Verify `GET /api/broadcast/channel-availability` returns radio available and television locked. Run `npm run test:tv-lock` plus existing Account 2 checks. Do not present a passed CI run as proof that radio has passed live listener, device, continuity, and production RTMPS tests.

Before deploying the lock, check whether television or a mixed `both` destination is already on air; coordinate stopping it rather than assuming a code rollout will stop an external provider egress. Production changes still require owner approval.


## Radio-only operating model and proposed 24/7 audio engine

Television and video broadcast capabilities are on hold. Do not delete historical video assets or their database rows: the lock prevents broadcasting and new video upload, but preserves reversible records. Do not publish a release without an owner-approved isolated Account 2 change set.

**Audio ingestion:** Accept supported audio MIME types, verify uploaded size and R2 object existence, retain resumable multipart uploads and publish only approved audio. Improve upload UX later with client-side metadata extraction, audio preview, duplicate checksum checks and an explicit rights/licensing declaration; none of those future UX features are claimed implemented.

**24/7 radio:** Audio files should be stored as audio objects in R2, *not embedded as base64/source code*. A playlist manifest (media IDs, ordering, start times, fallback and rotation policy) is the code/data controlling playback. The existing radio programme endpoint and playlist scheduling can drive listeners, but continuous synchronized internet-radio output requires an always-running audio playout/encoding service (e.g. FFmpeg -> Icecast/HLS) with silence fallback, watchdog, retry, monitoring and legal rights for the audio. A Cloudflare Worker alone is not a persistent audio encoder. Production 24/7 audio output and listener tests remain pending.


## Owner-approved fan-style standby model (listener-activated radio)

Owner clarification: the desired default radio is **on-demand**, like a fan that turns on when needed: no permanent 24/7 encoder or hosted streaming process. The Worker returns an audio playlist only when requested; R2 sends audio data on HTTP range requests; the listener's player begins playback after pressing Play, advances on the audio `ended` event and loops while the listener remains active. If nobody listens, no playback loop is running. Storage, DNS, application availability and any platform minimum billing still remain; this does **not** mean zero infrastructure costs.

The radio playlist now includes a `playback` contract with `delivery=listener-activated`, `loopPlaylist=true` and `synchronizedListeners=false`. This supports a station *available at any time*, not a single worldwide synchronized live station. Existing scheduled programmes can appear in the playlist, but different listeners may begin them at different positions. True simultaneous live transmission is a separate feature requiring a real-time stream.

**Required before launch:** wire the actual website radio Play/Pause/Next controls to this contract, ensure playback starts only by user gesture, test mobile background audio and low-bandwidth reconnect, monitor R2 requests and data transfer, and confirm rights for all recordings. Never tell listeners that an on-demand playlist is a synchronized 24/7 live broadcast.
