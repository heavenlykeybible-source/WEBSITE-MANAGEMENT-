# Heavenly Key MeetingSpace — Account 7

**Status: early development, not production ready.** Source is isolated in feature/account7-meetingspace to avoid accidental deployment of other accounts.

## What exists
- Branded responsive meeting lobby
- Create a random room and join using a link or room ID
- Cloudflare Durable Object WebSocket signalling
- Browser WebRTC peer-to-peer audio/video (requires permissions)
- Mute, camera toggle, basic screen sharing, copy invitation and leave
- 12-connection cap per room as a temporary safeguard

## Run locally
```sh
cd account7-meetingspace
npm install
npm run dev
```

## Before public launch
1. Implement proper authentication, host/guest roles, waiting room and admission controls.
2. Replace mesh WebRTC with an SFU (e.g. LiveKit or mediasoup) for larger calls; configure TURN and media region.
3. Add abuse controls, room access tokens, message size/rate limits, monitoring, privacy policy and retention.
4. Fix reconnect and ICE candidate buffering, handle screen share as an independent track, improve device selection and accessibility.
5. Add scheduling, recording consent, chat, captions and administrative controls.
6. Test multiple browsers/devices, NAT networks, load, security, and deployment rollback.
7. Map meeting.heavenlykey.org to the correct account only after verification.

**Do not claim 500 or 1,000 participants are supported.** This version is a prototype, not a production-grade Zoom replacement.
