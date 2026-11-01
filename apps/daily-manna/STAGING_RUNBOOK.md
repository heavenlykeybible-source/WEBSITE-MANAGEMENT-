# Daily Manna — staging deployment and verification runbook

This runbook is for the dedicated Cloudflare Account 1 staging Worker only. Do not modify existing Heavenly Key Workers, DNS, databases, or social profiles.

## Verified infrastructure
- Cloudflare D1: `strength-for-today-manna-staging`, ID `567e1b66-6fe4-460c-b67a-8bafec52eacd` (listed on Account 1).
- Separate private R2 bucket `strength-for-today-manna-images-staging` has been verified as created in Account 1 and is bound to staging Worker config.
- Worker code, tests, editor and SQL schema are in `apps/daily-manna/` in `heavenlykeybible-source/WEBSITE-MANAGEMENT-`.

## Required before Worker deploy
1. Confirm the dedicated staging D1 is empty. **Never apply the full baseline schema over an already populated database without inspecting existing columns and taking a backup first.** Baseline `schema.sql` includes editorial entries, image mappings, audit entries, delivery queue, immutable correction snapshots, and reviewed/unreviewed release origin.
2. In `apps/daily-manna`, for a verified empty staging DB only: `npx wrangler d1 execute strength-for-today-manna-staging --remote --file=./schema.sql`.
3. Verify expected table names and columns in the dashboard, including `release_mode`, `manna_entry_revisions`, `manna_post_images`, and `provider_post_id`.
4. Set `EDITOR_TOKEN` as a Cloudflare secret; never put it in HTML, git, logs or the public frontend: `npx wrangler secret put EDITOR_TOKEN`.
5. The dedicated `MANNA_IMAGES` R2 binding has been enabled in staging `wrangler.toml`; verify its permissions on deploy and never reuse unrelated private buckets.
6. Use `npx wrangler deploy` from `apps/daily-manna` to the staging Worker; confirm worker is not mapped to a production hostname.
7. Configure Account 4 owner-only proxy after verifying its real authentication and CSRF session middleware; do not expose the editor token client-side.

## Before scheduling public content
- Import the 1,826 dated entries into **staging** only as drafts.
- Confirm that their source/reference material is authorized for publication; automatic release of unreviewed entries must not be used to release unverified source content publicly.
- Confirm Africa/Lagos date boundary and hourly UTC cron. Missed midnight dispatch is recovered at the following hourly trigger.
- The publication code queues `community` and `studio` destinations only. The `community` sender is not implemented; do not label queue records as successful deliveries.
- The existing Studio retains all provider credentials and social-account permissions. Daily Manna requires `STUDIO_BRIDGE_ORIGIN`, `STUDIO_BRIDGE_SECRET`, `MANNA_PUBLIC_ORIGIN`, and `STUDIO_FIRST_POST_DATE` (YYYY-MM-DD). Without the explicit first-post date, the Studio handoff stays disabled to prevent historical backlog flooding. Do not configure those until the Page connection and public URL are validated. The Studio integration uses a signed endpoint in the existing Core app, with idempotent receipt rows, and queues social messages via the existing social-management service. Picture transfer into Account 2 Media Engine is not implemented yet and image-bearing posts are blocked until supported. Ambiguous failures require owner reconciliation before retry.

## Minimum live staging acceptance tests
- Public homepage loads on mobile/desktop and no draft/future entry leaks through /api/archive, /api/today, /api/public/*, or /api/picture/*.
- Draft and approved future-day entries publish at their scheduled Lagos date; status records `release_mode='reviewed'` or `'unreviewed'` correctly.
- Missed cron invocation recovers without duplicate outbox delivery records.
- Owner-only month editor, approval, corrections, stale revision conflict, immutable revision history, uploaded default/day pictures, private future-day preview, image replacement and deletion.
- Browser native Share/Copy and direct dated links, archived pagination, and same-origin picture display.
- Studio receipt and job IDs; independently verify any actual published provider post IDs and failure behavior. No claim of successful social publication based on the handoff alone.
- No email/newsletter/notification delivery in this stage, as deliberately deferred.

## Release status
Code-level work only; until schema application, Worker deployment, and live tests succeed, do **not** report this as launched or globally production-ready. The Studio receiver migration in `onlinebible/migrations/0089_daily_manna_studio_bridge.sql` must be applied on Core staging, and matching server-side bridge configuration is still required.
