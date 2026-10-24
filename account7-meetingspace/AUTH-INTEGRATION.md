# MeetingSpace authentication integration contract

This repository currently has **no trusted login/identity provider connected**. The helper in src/auth-boundary.js is a security boundary, not a login system.

## Required before issuing meeting tickets
1. Verify an existing authenticated user session with the trusted Heavenly Key identity provider.
2. Read authoritative room ownership and moderator grants from server-side storage.
3. Authorize the requested role with authorizeRoomRole; never accept a role solely from the client.
4. Mint a short-lived ticket with issueMeetingTicket using a server-side secret.
5. Ensure admission/waiting-room policy is enforced by the room itself, not only by a browser screen.
6. Validate ticket on WebSocket entry and carry verified claims into the Durable Object.
7. Add rate limits, replay protections, audit logs, moderation, revocation, and reconnection tests.

## Browser ticket transport caveat
The current prototype transmits a ticket as a WebSocket subprotocol and the room currently echoes that subprotocol in the handshake. This may expose the ticket in logs or debugging tools. Replace with a safer short-lived, one-time exchange before production. Do not use production credentials in the prototype.

## Never deploy as a public conferencing service before the above work is complete.
