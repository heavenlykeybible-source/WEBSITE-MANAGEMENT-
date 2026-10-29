# MeetingSpace social broadcasting relay

The app Worker serves the interface and meeting signalling. This separate Node/FFmpeg service transcodes its browser stream and forwards it to the RTMP/RTMPS destinations selected by the broadcaster. Do not upload this server as Worker JavaScript.

## Deploy on an existing authorized host

Use a Linux host with Docker Compose, a public hostname pointing to that host, inbound ports 80/443 and sufficient outbound bandwidth for every destination. Capacity must be measured before increasing `MAX_SESSIONS`; the supplied configuration permits one simultaneous broadcaster. Running a new paid host or increasing capacity is an operator decision.

1. Copy `.env.example` to `.env` inside this deploy directory and enter the actual relay hostname and exact MeetingSpace HTTPS origin.
2. Set `RELAY_SECRET_PATH` to a private file on that host containing the same existing value as the app Worker's `RELAY_SECRET`. Do not rotate or overwrite an existing app key, and never paste keys into chat or commit them. Docker mounts the file as a read-only secret. It must be readable by container user UID 1000; set the dedicated host file’s ownership/permissions accordingly rather than making it world-readable.
3. From this directory run `docker compose config --quiet`, then `docker compose up --build -d`. The HTTPS proxy waits for relay health. No database, storage bucket or application identity is changed by this package.
4. Check `https://YOUR_RELAY_HOST/healthz`. A successful health response confirms the relay and FFmpeg are available; it does not prove a social platform is receiving a broadcast.
5. On the existing Account 8 Worker, preserve all current bindings and secrets and set `RELAY_URL` to `wss://YOUR_RELAY_HOST`. Its `RELAY_SECRET` must match the mounted private file. Configure `TURN_URLS` and the existing private TURN credential mechanism for calls across restrictive networks, if needed.
6. For one-click channel connections, configure the approved Google/YouTube and Meta/Facebook developer applications and authorize the broadcaster's actual channels/pages. OAuth callbacks are `/api/oauth/youtube` and `/api/oauth/facebook` on the MeetingSpace origin. Manual server URLs and stream keys can be used without these optional OAuth integrations.

## Broadcast

Open Go live, select connected channels or add the platform-provided RTMP/RTMPS server URL and stream key. Up to ten selected destinations are accepted. A platform must grant that account streaming access; this app cannot grant external platform permissions. Keys stay in the current browser tab and must not appear in logs.

The app waits for relay acceptance before capturing a broadcast. Encoding progress changes the status to Broadcasting. This confirms relay processing, not the final public visibility or moderation decision on each platform. Check each platform's preview/status before announcing the event. Explicitly stop the broadcast when finished.

On a temporary disconnect the relay can supply a backup frame. This package limits an unattended fallback to five minutes by default; adjust only after reviewing host capacity and operating costs. Failed credentials/destinations stop with an error instead of reconnecting forever. A changed destination list starts a new encoding session instead of silently retaining the old destinations.

## Tests and scope

From the app source directory run `npm ci`, `npm test`, `npm run test:browser`, and `npm run test:relay` (FFmpeg/ffprobe required). The relay integration sends real generated media over WebSocket into the unchanged production encoding path and receives H.264/AAC through two local RTMP listeners. A test adapter maps a fixture hostname to those listeners; production destination validation remains enabled.

This repository package does not itself provision a host, create DNS records, install production secrets, authorize social accounts, or prove cross-network delivery. The release workflow requires the relay and browser audits before its manual application deployment.
