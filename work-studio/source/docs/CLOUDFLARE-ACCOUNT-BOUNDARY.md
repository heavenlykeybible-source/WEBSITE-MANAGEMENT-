# Heavenly Key — Five Cloudflare Account Boundaries

This is the current cross-account architecture. The older two-account-only guidance is superseded; it does not describe the current five-account deployment.

## Account 1 — Main Website and CMS
- Cloudflare Worker: `heavenlykey`
- Public Worker URL: `https://heavenlykey.alldaywow247.workers.dev/`
- Source: `heavenly-key-website/`, `src/`
- Owns the ministry website, visual Website Builder, CMS published content and revisions, ministry account and administrator identity, Bible Reader interface, site settings, light-weight APIs and related D1/KV/R2 resources.
- May receive ordinary tested frontend and API code updates. Normal deployments never reset CMS content, roles, D1/KV/R2, stored secrets or published media.

## Account 2 — Media and Live Broadcast Engine
- Worker: `heavenlykey-media`
- Public health URL: `https://heavenlykey-media.omegawealthcreator.workers.dev/health`
- Source: `media-engine/`
- Owns media ingest, playout, live status and transport integrations, distribution jobs, stream sessions and media-specific storage, plus authorized social channel credentials where configured.
- Does not own Account 1 CMS or Account 3 member database.

## Account 3 — Global Christian Community
- Worker: `heavenly-key-global-community`
- Public URL: `https://heavenly-key-global-community.adiohwomiracle.workers.dev/`
- Source: `global-community/`
- Owns community member state, posts, groups, messages, session namespace, moderation, and community media, with its own D1, KV and R2 resources.
- The live Worker has been verified to bind `DB` to `heavenly-key-global-community-db`, `SESSIONS` to `heavenly-key-global-community-sessions`, and `MEDIA` to `heavenly-key-global-community-media`. IDs must remain pinned to their existing resources.

## Account 4 — Owner Update / Recovery Control Centre
- Worker: `heavenlykey-recovery-control`
- URL: `https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev/`
- Source: `recovery-control/`
- Owns separate owner access, controlled staging/waiting rooms, signed approvals for Accounts 1–3, release history and recovery workflow.
- No ordinary code update may reset the existing owner password, D1, KV, R2, signing keys or audit history.

## Account 5 — Independent Heavenly Key Mobile App
- Repository: `aoemeta247-cell/heavenly-key-mobile-app`
- Worker: `heavenly-key-app`
- URL: `https://heavenly-key-app.heavenlykeyapp.workers.dev/`
- Hosts app/PWA/public assets and a basic health endpoint. It does **not** copy or bind the Account 1–4 member databases or administrative credentials. App updates have a separate repository/test/deployment lifecycle.
- Do not claim a fully integrated native app, direct member sign-in or verified broadcasting without further acceptance tests.

## Release behavior

For routine updates, deploy **only the accounts whose tested code/assets changed**, via their existing release workflows. Protect the existing CMS drafts/published changes, data, member/admin logins, sessions, channels, media, provider tokens, bindings and user settings. An ordinary deploy is **code-only**: no migrations, no secret rotations or provisioned replacement databases/KV/R2.

A necessary database, credential, CMS-engine or protected-config change is handled separately with owner approval, backup/recovery review, isolated tests, and explicit account-scoped changes. The rule is **preserve data; do not freeze software**.

For the full account matrix, change classification, staging and approval checklist, see [FIVE-ACCOUNT-CODE-ONLY-RELEASE-POLICY.md](FIVE-ACCOUNT-CODE-ONLY-RELEASE-POLICY.md).

## Cross-account authorization

A browser or API must not acquire administrator capabilities merely by making a request to another public Worker URL. Existing authorizations, verified sessions, short-lived server-to-server grants and roles must be validated on the server; never expose Cloudflare secrets, provider credentials or keys to clients.

## Media retention

Temporary distribution media is eligible for deletion only according to an approved retention policy and confirmed completion across intended platforms, with needed recovery windows. Approved permanent Bible, hymn, public broadcast, or other retained media remains protected until explicitly removed by an authorized ministry operator.

## Custom domain

`heavenlykey.org` currently serves a separate older website; publishing a Worker does not automatically change its DNS or routing. Any domain cutover requires its own owner-approved domain/configuration change.
