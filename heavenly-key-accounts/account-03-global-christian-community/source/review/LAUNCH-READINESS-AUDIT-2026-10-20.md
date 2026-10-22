# Global Christian Community — Source Audit & Launch Gate
Date: 2026-10-20
Scope: GitHub source only. No live-site requests, production credentials, deployment, migrations, or user-data changes were performed.
Base: fix/global-launch-blockers-20261020

## Executive decision

**NO-GO for a broad public launch until the P0/P1 gates below are closed and verified.** This is a source-level review, not a penetration test or production certification. The repository has meaningful safety and authorization work, but several identity, operational, and global-readiness controls are either absent, configuration-dependent, or not proven by the source reviewed.

## Positive controls found in source

- New registration requires explicit adult attestation and acceptance of community standards/privacy notice.
- Registration validates email/name, rate-limits registration attempts, and batches account/profile/acknowledgement creation.
- Passwords are salted and hashed with PBKDF2; password policy on the audit branch requires 15–128 Unicode code points.
- Session cookies are HttpOnly, Secure, SameSite=Lax; session lookups re-check current account role/status in D1.
- Server routes include request-size limits, JSON content-type checks, origin/cross-site checks, security headers, and write throttling.
- Social sign-in code has state/nonce/PKCE-oriented checks and provider setup is explicitly configuration-dependent.
- Moderation supports report queues, held content, documented appeal paths, group/site review separation, and account restrictions.
- Profile visibility defaults to private in registration.
- Existing tests cover registration, group controls, stewardship, social sign-in/adverts, design cards, feed, and API/architecture contracts.

## Findings and launch gates

### P0 — Do not launch until verified

1. **CI is red on the current launch-blocker PR.**
   GitHub Actions run 39354368484 on fix/global-launch-blockers-20261020 reports failures in Community source checks, shared platform contract/architecture checks, and release-manifest consistency. Job logs were unavailable through the connected GitHub tool, so exact failing assertions are not yet confirmed. Do not merge based on assumption; rerun and capture actionable logs, then fix each failure.

2. **Email ownership and account recovery are missing or not demonstrated.**
   The open PR description explicitly lists email verification and password recovery/change as unresolved. Without them, typo-squatted/incorrect email accounts, recovery after lost credentials, and safe account takeover remediation are not launch-ready. Add verified-email state and signed, expiring, single-use recovery/change flows with rate limits, audit events, and session revocation after credential changes. If intentionally deferred, restrict launch scope and disclose it clearly.

3. **Administrator/owner accounts lack a demonstrated strong-authentication gate.**
   No enforced MFA/step-up authentication was established in the reviewed auth code. Before a multi-country public launch, require MFA or equivalent step-up protection for owner/admin accounts, protect recovery of privileged accounts, and test privilege escalation and session revocation. Do not rely only on UI hiding.

4. **Production deployment readiness is not proven by source checks.**
   wrangler.toml identifies Cloudflare resources and comments list secrets to configure; source preflight itself says it does not certify deployment readiness. Verify secret presence without printing secret values, D1 migration parity, KV/R2 bindings, domain/routing, rollback, backups/restore, and a tested staging release before production.

### P1 — Must close before unrestricted international launch

5. **Session lifecycle is long-lived and limited revocation controls are not demonstrated.**
   Sessions use a 30-day KV TTL. The reviewed code re-checks account status/role, which is good, but the source reviewed does not establish user-facing “log out all devices”, session inventory, or credential-change revocation. Add session rotation and revocation strategy, expiry policy, and tests for logout, restricted users, password changes, and role changes.

6. **Rate limiting uses KV read-then-write counters.**
   The rate helper reads a counter, increments it, and writes it back. This pattern is not atomic under concurrent requests and should not be treated as a hard abuse-control boundary. Add a concurrency-safe limit where supported, or document the best-effort nature and layer edge-level limits/bot controls for registration, login, messaging, reports, and social auth. Test distributed bursts.

7. **Global moderation coverage is explicitly limited.**
   docs/CHRIST-CENTERED-SAFETY.md says text checks are rule-based, are not comprehensive, cannot reliably handle all contexts/languages, do not scan linked videos, and cannot prove intent. This is a material international safety gap. Keep human review and appeals; add language-aware reporting/moderation operations, local-language help and rules, escalation/SLA, and region-appropriate abuse reporting. Never auto-lock members solely from keywords or report counts.

8. **Adult-only registration is an attestation, not age assurance.**
   The flow requires ageConfirmed, but source alone cannot verify age. Decide and document the age policy, safeguarding/reporting process, data-minimizing age-assurance approach if required, and jurisdiction-specific obligations before accepting users globally.

9. **Privacy/legal readiness is not established by code.**
   Privacy defaults are helpful, but no reviewed source proves a complete privacy notice, retention/deletion/export workflows, consent and ad-personalization choices, data processor inventory, or country-by-country legal review. Prepare these operational and legal materials before launch; do not collect precise location or sensitive religious information without a defined purpose and controls.

10. **Social providers and calling are optional/configuration-dependent.**
    Social provider readiness is surfaced through an API; the test suite expects providers to be unavailable until configured. Calling requires external TURN configuration. Publish only features whose provider credentials, redirect URIs, abuse controls, cost limits, and failure behavior are verified in staging. Clearly label unavailable features.

### P2 — Reliability, usability, and launch operations

11. **Internationalization and accessibility need a dedicated test pass.**
    The reviewed frontend contains English-only page text and no evidence of a complete locale system. Test mobile layouts, keyboard/screen-reader flows, reduced motion, slow connections, right-to-left languages, long translated strings, time zones, and low-end devices. Do not infer global usability from desktop/static tests.

12. **Support and incident response are not proven operational.**
    Assign real owner/moderator coverage across time zones, report-queue SLAs, urgent child-safety/credible-threat escalation, compromised-admin response, backup restore drills, security contact, and an incident log. The safety documentation itself says queues need regular review and real staff accounts must be assigned.

13. **Advert and ministry editorial controls need a privacy and abuse review.**
    Test advertiser authorization, approval, schedule/time-zone boundaries, destination-link safety, disclosures, opt-out/consent where applicable, and audit trails. Do not allow sponsored content to appear indistinguishable from pastoral or official ministry communication.

## Required verification checklist

- [ ] Fix every failing check in the launch-blocker PR and obtain green CI on the exact commit intended for merge.
- [ ] Add automated tests for email verification, password reset/change, token expiry/replay, account enumeration, and session revocation.
- [ ] Add admin MFA/step-up authentication and tests for every privileged route.
- [ ] Run authorization matrix tests for anonymous/member/moderator/admin/owner across every route and object ownership boundary.
- [ ] Run dependency, secret, static-analysis, and security-header checks; review logs for personal-data leakage.
- [ ] Validate every migration from an empty D1 database and from a production-like prior schema on disposable staging data.
- [ ] Verify backup and restore, rollback, incident response, and moderation staffing.
- [ ] Complete privacy, terms, adult-only/safeguarding, retention/deletion, and country launch review.
- [ ] Conduct multilingual, mobile, keyboard, screen-reader, reduced-motion, and low-bandwidth acceptance tests.
- [ ] Test staging end-to-end using synthetic accounts only; never use real member data in audit fixtures.
- [ ] Obtain explicit owner approval before any production deployment.

## Safe audit boundaries

This change adds documentation only. It does not alter production data, secrets, Cloudflare resources, migrations, or deployment settings. Findings about the live deployment remain unverified because this audit intentionally targets GitHub source only.
