# Groups review and improvements

## What changed

Reviewed existing creation, discovery, approval, membership, manager permissions, settings, feed access and mobile presentation. Existing privacy/permission policy remains authoritative.

- Group discovery now has focus/privacy filters and Discover, Joined, Pending requests and Manage views. Search covers name, Christian purpose and description. Counts refer explicitly to the loaded set; existing API limit remains 100. Hidden groups are never fetched for unauthorized users.
- Creation stays a three-step privacy-first wizard and is now in the central column for mobile reachability. Step progress is announced, Back/Continue move keyboard focus properly, submission reports progress and disables duplicate submissions.
- Group header explains purpose, privacy, membership/role and member count. Public discovery does not claim that member-only posts are public. Existing server post visibility is unchanged. About/rules, members, requests and settings shortcuts only expose supported actions for the current membership/role.
- Pending members can withdraw their own request through the existing leave endpoint, with inline errors and disabled pending controls. Removed/rejected membership does not gain an automatic rejoin path.
- Manager membership requests have clear loading/empty/retry states and inline decision errors; buttons disable while a decision is pending. A failed request fetch no longer breaks the whole group view.
- Member/request rows reuse existing approved profile photos from the profile system. No generated faces or new uploads.
- Nonhidden group share uses Share this group to bless others with the ministry motto beneath it. Hidden groups still have no share-link control.
- Groups-scoped navy/wine/gold presentation, responsive discovery/form layout and readable membership controls complement the original Design Card/feed engine.

## Files changed

- `global-community/public/app.js`
- `global-community/public/active-content.css`
- `global-community/src/services.ts`
- `global-community/test/group-controls.checks.mjs`
- `global-community/review/GROUPS-REVIEW.md`
- `global-community/public/safety.html`
- `global-community/public/spaces.html`
- `global-community/public/fellowship.html`
- `global-community/public/index.html`
- `global-community/public/prayer.html`
- `global-community/public/profile.html`
- `global-community/public/missions.html`
- `global-community/public/grow.html`
- `global-community/public/groups.html`
- `global-community/public/salvation.html`
- `global-community/public/account.html`
- `global-community/public/messages.html`

HTML files only update existing shared script/style cache revisions.

## Existing functionality preserved

Private/hidden visibility; approval requirements; manager-only posting; owner/admin/moderator boundaries; owner retention; member removal/rejoin restrictions; member list authorization; reporting/moderation; original Design Card templates, colours and categories; comments/Christian reactions; feed filters, refresh and pagination; authentication and safety controls. Group privacy can still only tighten. No Control Room, footer, security baseline, Community AI or unrelated feature change.

## Tests performed

Full `npm run buildcheck` passed: TypeScript, frontend syntax, development preflight and 27 tests across the Community suites. Extended real-SQLite group checks cover discoverable pending status, withdrawal/reapplication, member-list denial for pending users, original profile photo fields, private-feed denial for guests/outsiders, approved-member read access and loss of access after leaving. Existing manager/role/join/privacy and messaging tests remain passing.

DOM interaction checks passed: pending and managed discovery; guest create invitation; owner controls; pending member cannot compose or edit settings; request withdrawal uses the existing endpoint; manager-request fetch failure displays retry. Final copy correction and syntax checks passed afterward.

## What remains unfinished

Rendered browser/mobile visual inspection and real-user usability testing are not certified in this environment. Discovery still filters the existing 100 loaded groups and member/request lists retain their existing 100-record limits. No new events, uploads, analytics, calls, hidden-group invitations or ownership transfer are introduced. Hidden groups continue to follow existing server rules. Integrated release/protected-state checks and owner acceptance remain required before deployment.

## Database migration

None. Photo fields already exist; existing membership tables/endpoints are reused. Earlier ACTIVE migrations remain separate.

## Review state

Saved in the existing Community draft only. No merge, production SQL or deployment.
