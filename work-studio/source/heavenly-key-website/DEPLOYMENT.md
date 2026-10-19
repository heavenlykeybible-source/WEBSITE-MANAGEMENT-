# Heavenly Key Account 1 — Website Deployment Guide

## Current website endpoints
- Main website and API Worker: `https://heavenlykey.alldaywow247.workers.dev/`
- Separate Account 2 Media Engine: `https://heavenlykey-media.omegawealthcreator.workers.dev/`
- Separate Account 3 Global Community: `https://heavenly-key-global-community.adiohwomiracle.workers.dev/`
- Account 4 Owner Update Centre: `https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev/`
- Account 5 mobile app Worker: `https://heavenly-key-app.heavenlykeyapp.workers.dev/`

The custom ministry domain `heavenlykey.org` must not be assumed to point to Account 1. Changing domain routing is a separate, owner-approved operation.

## What may be published in an ordinary release

**Normal changes:** reviewed website HTML/CSS/JS, new pages, frontend components, design, API/feature code and other compatible software, with an exact GitHub commit SHA. Ordinary code releases must be allowed after successful CI, staging and Account 4 signed owner approval.

**What remains permanent and protected:** existing Account 1 `heavenlykey-db` D1 and records, existing KV/R2 resource identities and objects, live CMS published text and images, CMS drafts/revisions, roles, member/admin passwords and security secrets, settings and any connected provider tokens. A frontend deployment must not overwrite or reseed those contents.

**Schema changes are a separate change type.** Do not automatically run D1 migrations, apply new SQL, regenerate secrets, change D1/KV/R2 IDs or perform CMS resets as part of routine production deployment. If a feature requires a new table/field, prepare a specific owner-reviewed additive migration, validate staging and recovery options, and publish the feature only after compatibility has been confirmed.

## How the protected workflow works

1. Identify the exact source branch and tested SHA, and verify that the desired new feature is actually merged into the candidate. Unmerged PRs cannot appear in production just because staging or a previous SHA deployed.
2. Run the account-specific tests and stage the exact SHA in Account 4's isolated Account 1 waiting room.
3. Review the actual preview website and its behavior as a visitor and authorized administrator. Confirm that the new changes appear; if the preview still shows old design, reconcile source first rather than redeploy the old version.
4. In Account 4, the owner must approve the exact candidate with the existing signed per-account release mechanism. Never bypass or forge the owner signature.
5. Run the existing `Promote Account 1 to Production` workflow. It must protect CMS and login continuity, verify existing resource identities, make a D1 recovery bookmark where configured, and deploy code/assets only.
6. Verify the live Worker version and behavior, key public pages, CMS public content and administrator/member sign-in. A green GitHub Actions check does not prove the expected UI is present.
7. Record the exact SHA in release history, any remaining integration blockers, and the rollback procedure for code. Never imply code rollback restores D1/KV/R2.

## Website Builder versus code

The website's *CMS software* may evolve through separately reviewed compatible code updates. Its **published CMS content, drafts, uploads, layout and revision history** are independent durable state and must not be replaced during a code release. The Website Builder publishes user-controlled content through its own authorized workflow.

If there are no published homepage CMS overrides, the live homepage uses the static template. Publishing an unchanged template will not make an unmerged redesign appear; check the GitHub source first.

## Assets and cache verification

The Worker serves assets from `heavenly-key-website/` as declared in `wrangler.toml`. Preserve CSP/security headers and PWA behavior. Update service-worker asset cache identifiers when assets change; verify both a fresh public request and real device UI before attributing an old page to caching.

For the current five-account release and permanent data requirements, see [../docs/FIVE-ACCOUNT-CODE-ONLY-RELEASE-POLICY.md](../docs/FIVE-ACCOUNT-CODE-ONLY-RELEASE-POLICY.md).

No credentials, keys or private personal data belong in repository documentation.
