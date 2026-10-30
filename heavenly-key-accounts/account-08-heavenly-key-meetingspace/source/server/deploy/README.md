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

## TURN setup for cross-network meetings

The optional `compose.turn.yaml` now supplies the missing coturn service. Run it on an existing authorized Linux host with a public IPv4 address. This baseline offers authenticated TURN over UDP and TCP on 3478; networks that only allow TLS on 443 need a separately configured TLS TURN endpoint. Do not put TURN behind Cloudflare's HTTP proxy. Its DNS record must point directly to the host.

1. Privately set `TURN_SECRET_PATH` to the file holding the existing Worker's `TURN_SHARED_SECRET`. If none exists, generate a strong secret privately and install the same value in both places. Never replace `AUTH_SECRET` or another existing app secret.
2. Set `TURN_HOST`, `TURN_PUBLIC_IP` and `TURN_LISTEN_IP` to the actual hostname, public IPv4 and host interface IPv4. On a directly public host, both IP values are the same. From this directory run `node prepare-turn.mjs`. It creates an ignored mode-0600 configuration and refuses to overwrite an existing file. Keep it private; `docker compose config` does not embed its contents. Ensure the approved container user can read it without world-readable permissions.
3. Set `COTURN_IMAGE` to an operator-approved `coturn/coturn` tag or digest. Permit inbound TCP/UDP 3478 and UDP 49160–49200 in the host/provider firewall; allow outbound media to public peers. Run `docker compose -f compose.turn.yaml config --quiet` and `docker compose -f compose.turn.yaml up -d`.
4. In the existing Account 8 Worker set `TURN_URLS` to `turn:YOUR_TURN_HOST:3478?transport=udp,turn:YOUR_TURN_HOST:3478?transport=tcp` and install the matching private `TURN_SHARED_SECRET`. Preserve all existing bindings. Neither the hostname nor secret is supplied by this repository.
5. From the app source run `node scripts/check-live.mjs https://meetingspace.heavenlykey.org`; add `--broadcast` when releasing streaming. This read-only gate exits nonzero for missing services. It does not prove media connectivity.
6. Before public use, verify an authenticated TURN allocation and a call between two physical devices on different networks. Force relay-only ICE in a controlled test to ensure TURN, rather than a direct connection, carries media. Verify mute, admission, reconnect and call end. Test each intended broadcaster platform's actual preview separately.

The baseline is limited to 40 allocations and 41 relay ports; size it from measured concurrent calls and bandwidth. It is a small initial deployment, not a large-conference SFU. The current app defaults to 25 room connections and six guest stage positions, so capacity testing remains necessary before announcing larger meetings.

Reference: https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf
