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
