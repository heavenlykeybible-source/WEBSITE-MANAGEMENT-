# Heavenly Key Media & Broadcast Engine

Separate Cloudflare Worker for administrator-only broadcast and temporary media operations.

## Scope
- Live broadcast control and reconnect state
- Picture + audio, Bible, hymn and prerecorded video source selection
- Prerecorded playout
- Social account/distribution control plane
- Campaign scheduling
- Temporary R2 media lifecycle

## Retention
This is **not** a media archive. Temporary objects expire automatically (default 48 hours). Distribution completion should shorten retention according to the operational policy. Permanent retention requires explicit `keep_media=1` and is reserved for approved ministry resources.

## Security
Browser clients never receive the Media Engine shared secret. Core authenticates administrators and calls this Worker with a short-lived HMAC capability.

The Worker is a control plane; actual video encoding and third-party social transport remain external provider responsibilities.


### Live-to-prerecorded handoff

The Admin Dashboard can switch an active live session directly to an approved/published prerecorded video with `POST /api/broadcast/live/:session_id/switch-to-video` and `media_id`. The live session remains active; only its source changes to `video`. The external encoder/player must consume this source change and play the selected media. The administrator can then use the normal stop action to end the live session.
