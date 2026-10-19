# Heavenly Key Temporary Media Storage Policy

## Default rule
- Large media is stored in Cloudflare R2; D1 stores metadata and job state only.
- Uploaded media receives a 48-hour retention deadline.
- Media may be explicitly marked **Keep**. Kept media has no automatic expiry.
- Owners may manually delete their own media at any time. Moderator+ may delete media they are authorized to manage.
- Scheduled cleanup runs every 15 minutes and is idempotent.

## Social distribution
- Distribution jobs store lightweight D1 state; they do not copy media into D1/KV.
- After every delivery job for a media item reaches `sent`/`cancelled`, and there is no future scheduled campaign item using that media, the R2 object is eligible for immediate deletion.
- Failed/retrying jobs keep the object available until the normal retention deadline or explicit deletion.

## Prerecorded playout
- Prerecorded video/audio is scheduled against the same temporary R2 object.
- If the requested playout begins after the 48-hour deadline, the platform requires the operator to explicitly keep the asset or re-upload it closer to playout.
- This prevents a long-lived media archive from accumulating unintentionally.

## Live recordings
- `broadcast_recordings` tracks temporary recordings separately from ordinary media.
- Recordings default to temporary retention and can be explicitly kept for personal download.
- Cleanup removes expired recording objects from R2 and marks their D1 record as deleted.

## Deployment requirements
Create separate production and staging R2 buckets and bind them as `MEDIA_R2` in the corresponding Wrangler environment. The scheduled trigger is `*/15 * * * *`.

No provider API credentials or media tokens belong in source control. Provider connections remain disabled until their official API authorization and live test have been completed.


## Recording controls
- `POST /api/broadcast/recordings` registers an approved encoder recording written to R2 under `recordings/…`.
- `GET /api/broadcast/recordings/:id/download` streams a retained recording to authenticated Moderator+ users and marks it downloaded.
- `POST /api/broadcast/recordings/:id/keep` toggles permanent retention.
- `DELETE /api/broadcast/recordings/:id` force-deletes it immediately.
- Recording bytes never enter D1/KV.

## Large uploads

Single-request uploads are capped at 100 MiB. Multipart media upload is intentionally disabled in this release to preserve the resource-light Heavenly Key storage policy. Larger media should remain in the external broadcast/social distribution workflow rather than turning Heavenly Key into a media warehouse.

## Live broadcast resilience

Live sessions use a lightweight heartbeat. If the encoder heartbeat is missing for about 30 seconds, the session enters `reconnecting` for a **10-minute grace period** instead of ending immediately. During this state the player/control plane should show the configured fallback/slate media and a loading indicator. A successful heartbeat restores `live` state. If the 10-minute deadline expires, the session becomes `ended`; the finalized recording remains available to the recording/distribution workflow and is still subject to the normal 48-hour temporary-retention rule unless explicitly kept.

The Worker checks this state every minute. Storage cleanup remains throttled to every 15 minutes, so the resilience feature does not require 15-minute storage polling and does not materially increase storage operations. The configured fallback is a ministry-owned video/audio asset; the player should loop it during the grace window and show a loading indicator. The backend does not transcode or generate the fallback file, which avoids unnecessary CPU/storage consumption.

## Prayer audio / MP3

Prayer audio is supported as ordinary `audio` media. It should use the same temporary R2 lifecycle as other uploaded media: 48-hour retention by default, explicit KEEP when the ministry wants to retain it, and automatic cleanup otherwise. This avoids adding a separate permanent audio-storage subsystem merely for the prayer page/radio experience.
