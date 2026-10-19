# Heavenly Key Global Christian Platform

Cloudflare Workers + D1 + R2 + KV backend for the Heavenly Key Evangelistic Movement digital platform.

## Architecture

- **D1** — relational metadata, accounts, community, ministry workflows and audit records.
- **R2** — large/temporary media such as video, audio, recordings and fallback assets.
- **KV** — sessions, rate limits and live-status state.
- **Workers Cron** — cleanup, scheduled broadcast/plauout state and distribution dispatch.

Large media is deliberately not stored in D1. Temporary media follows the project's retention policy and is removed after expiry unless explicitly kept.

## Spiritual media rule

Bible audio, hymn audio/video and prayer audio are served from **approved Heavenly Key media objects in R2**. The platform does not select playback files from random external websites.

Workflow:

1. Administrator registers/uploads media through the Media Library.
2. Media is stored in R2 and reviewed for usage rights.
3. Administrator approves the media.
4. Administrator attaches the approved media to a Bible chapter or hymn.
5. The public resource returns `/api/media/{mediaId}/object` as the playback source.

This supports MP3 prayer audio, hymn audio, hymn video and Bible audio without creating a second storage system.

## Live resilience

A live session enters `RECONNECTING` when broadcaster heartbeats stop. It can remain in that state for up to 10 minutes while the configured ministry fallback video is available to the player. Reconnection restores `LIVE`; expiry finalizes the session and triggers the recording/distribution lifecycle.

## GitHub / deployment

The repository is designed to be connected to GitHub before production deployment. CI performs syntax checks, local preflight and tests. Real Cloudflare resource IDs and secrets are intentionally not committed.

Before production:

- configure staging and production D1/KV/R2 resources;
- set `SESSION_SECRET`, `PASSWORD_PEPPER`, and `ENCRYPTION_KEY` as Worker secrets;
- apply migrations to staging;
- run staging integration tests;
- connect and authorize real social providers where automation is required;
- replace deployment placeholders in `wrangler.toml`;
- run the normal deployment preflight;
- deploy staging, verify, then deploy production.
