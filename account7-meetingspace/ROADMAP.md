# Heavenly Key MeetingSpace — production development roadmap

## Core principle
Build a safe, reliable meeting and broadcasting product without representing unimplemented functionality as operational.

## Phase 1: meeting foundation
- Secure identity, host/guest roles, invitations, waiting room and meeting locks.
- Reliable signalling with reconnect, ICE buffering, TURN, authenticated tokens, device selection and accessibility.
- Adopt and deploy a dedicated SFU for scalable meetings. Cloudflare Workers alone cannot serve as the group media SFU.
- Test real browsers and networks, mobile devices, bandwidth adaptation, observability and rollback.

## Phase 2: messaging
- WhatsApp-inspired layout: conversation list, chat thread, compose bar, reactions, attachments, unread counts and search.
- Direct chats, groups and in-meeting chat, message persistence, privacy controls, abuse reporting and moderation.
- Authentication, authorization, rate limiting and encryption strategy before accepting real user data.
- Voice notes and calls after the secure core is validated.

## Phase 3: multi-destination live broadcast
- Authorized destination manager with multiple independently connected accounts/pages/channels.
- OAuth and platform-specific permissions where available; secure credential vault and expiry/revocation handling.
- Encoder/SFU-to-RTMPS output service with isolated per-destination workers, retries, status and stream health.
- YouTube, Facebook, Instagram, TikTok, LinkedIn, X, and custom destinations only as each platform allows.
- Platform restrictions differ: not every account supports external live production, personal-account streaming or third-party API publishing.
- Provide explicit destination preview, start/stop controls, stream key protection and failure recovery.
- Never collect or store social media account passwords.

## Phase 4: professional tools
- Recording with consent, captioning, translations, searchable transcripts, summaries and moderation.
- Webinars, breakout rooms, polls, virtual backgrounds, presenter modes and scheduled events.
- Optional church services and ministry events templates.
- Admin dashboards, billing controls if introduced, usage quotas and incident handling.

## Launch gates
- Threat model and security review
- Functional end-to-end browser tests
- Real multi-device media tests and load testing
- Platform permissions and authorized social connections
- Monitoring, disaster recovery and rollback
- Privacy, consent, retention and child safety policies
- Staging approval before any production DNS or Worker routing change

**Status**: destination configuration and chat protocol validation are foundations only; no live social stream, messaging service or SFU is implemented by these modules.
