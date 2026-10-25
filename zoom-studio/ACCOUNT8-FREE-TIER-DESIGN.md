# Account 8 MeetingSpace: free-tier community follow-up design

Account 7 is Heavenly Key Radio. Account 8 is Heavenly Key MeetingSpace. Account 9 is VideoEditor. This document does not authorize migration of an existing Cloudflare resource.

## First release: opt-in meeting-to-group follow-up

Reuse the existing groups and user identity tables and routes; do not create parallel membership stores. After a meeting ends, show an invitation to join the host's group **only if the host enabled it**. The default is OFF. A guest can decline or dismiss without losing meeting access. Membership requires an explicit action and must never be inferred from attendance. An unauthenticated guest is directed to the existing registration/login flow before submitting a request. Group moderators approve requests, and users can leave and mute notices. Never expose meeting attendance or contact information to group members automatically.

Follow-up should start with an in-app group announcements page and a next-meeting link. Email reminders must be optional, verified, and rate-limited. No SMS, WhatsApp, or paid messaging dependency in the free-tier default. Do not send invitations to all attendees automatically.

## Resource limits and operational safeguards

- Keep media browser-to-browser (WebRTC); never proxy camera/video streams through Workers, D1, or R2.
- Use Durable Objects only for bounded room signalling; limit messages and participants, and avoid per-second D1 writes for presence.
- Reuse existing D1 groups, memberships and indexes. Store one join request per (group,user), and prevent duplicates. Read group summaries with pagination, not full scans.
- Batch notifications and attendance aggregates. Do not write heartbeat records to D1. Enforce server-side per-user and per-group rate limits.
- Keep recordings OFF by default. Never record or upload media without participant notice and consent. Recordings need explicit retention, quota and deletion controls before enabling.
- Make translation, AI summaries, external streaming and email opt-in and quota-bound, not automatically triggered on every meeting.
- Ensure room capacity, chat size, request-body size and message-rate caps are enforced server-side.
- Protect membership changes with authenticated role checks and CSRF/origin safeguards as appropriate. Provide moderation, reporting, blocking and deletion paths.

## Acceptance checks before launch

Test guest admission, host permissions, camera/microphone, screen sharing, network reconnection, mobile browsers, group invite acceptance/rejection, member exit, rate limits, and notification opt-out on the deployed Account 8 Worker. Verify actual Cloudflare usage and limits before increasing participant caps. Do not claim that this design alone implements those features.
