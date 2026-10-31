# Account 10 SocialPlus — security verification register

**Purpose:** release evidence and an explicit list of controls that still require implementation or production verification. This is not a certification or a claim of OWASP/NIST compliance.

**Benchmarks**
- OWASP Application Security Verification Standard (ASVS) 5.0.0, stable release: https://asvs.owasp.org/
- NIST Secure Software Development Framework (SSDF), SP 800-218 v1.1 (final): https://csrc.nist.gov/pubs/sp/800/218/final
- NIST SP 800-218 Rev. 1 / SSDF v1.2 was an initial public draft at the time of this review; do not treat a draft as a final standard.

## Source-level controls with automated evidence

| Area | Current source evidence | Status |
|---|---|---|
| Request validation and size limits (ASVS V1/V13) | JSON content-type checks, 1 MiB streamed body limit, media signature checks | Automated contract coverage; runtime fuzzing still required |
| Browser mutation protection (ASVS V4/V13) | Fetch Metadata and exact Origin checks; same-site sibling subdomains rejected | Automated contract coverage; browser integration test still required |
| Least privilege (ASVS V4) | Explicit staff read/write allowlists; unknown staff routes denied | Automated unit/contract coverage; role-based live acceptance still required |
| Authentication abuse protection (ASVS V6) | D1 failed-credential counter; keyed HMAC client identifier; fail-closed when migration 0013 is absent | Source-level test; staging D1 test still required |
| Session management (ASVS V7) | Named, expiring, revocable staff credentials exist; owner still uses shared ADMIN_TOKEN | **BLOCKER** — individual owner identity, MFA, short-lived server-side sessions and session revocation are not implemented |
| Secrets (ASVS V13) | Gemini/Meta credentials are Worker-side bindings; client bundle contract forbids Gemini secret/provider URL | Source-level test; Cloudflare encrypted-secret inventory and rotation not verified |
| Webhook authenticity (ASVS V13) | Meta HMAC-SHA256 signature check before storing webhook event; payload size bound | Source-level test; signed provider staging test still required |
| Content Security Policy (ASVS V14) | Same-origin script policy, no script attributes, frame ancestors denied | Script policy hardened; inline styles remain permitted for existing dashboard styling and need a separate removal/audit |
| Data lifecycle (ASVS V8) | No complete production retention, deletion, export or restore evidence | **BLOCKER** — retention and backup-recovery verification required |
| Runtime observability (Cloudflare operations) | 10% sampled Worker logs and Cloudflare Worker Issues enabled in Wrangler; source maps uploaded for server-side stack traces | Configuration is in source; production ingestion, alert routing and retention still require live verification |
| Supply chain (NIST SSDF) | Locked dependencies, typecheck, contract tests and dry-run build in CI | CI passed on recorded PR head; independent dependency/SBOM and provenance review still required |

## Verified code checks

On commit `67b439dc45d9d04ff9cf2196a64384c7bff803f6`:
- Account 10 `verify` workflow: passed.
- Account 10 `Typecheck, test security, and dry-run build` workflow: passed.
- These runs include locked dependency installation, source/test/bundle checks, preflight, security/dashboard/release contract tests (66 security, 48 dashboard, 17 release), TypeScript and dry-run build.
- Wrangler is configured with compatibility date `2026-10-31`, 10% sampled Worker observability and Cloudflare Worker Issues; the production telemetry pipeline has not yet been exercised.
- A Cloudflare Pages check in the same repository failed for the separate GlobalCommunity project; it is not an Account 10 deployment result.
- A Workers Builds check for the repository completed successfully; this does not prove Account 10 production resources are configured or deployed.

## Production release blockers

1. Implement named owner identity and MFA; remove shared owner bearer-token authentication. Define idle and absolute session lifetime, rotate-on-login, server-side logout revocation, recovery, and suspicious-login audit.
2. Rotate any potentially exposed Gemini API key. Configure replacement only as an encrypted Cloudflare Worker secret; inspect provider usage and billing.
3. Verify target Cloudflare account/zone ownership. The prior inventory found an account/zone mismatch and an existing Worker without the expected D1/R2/assets bindings.
4. Back up D1, inspect the live schema, record applied migrations and apply only missing migrations to staging one at a time. Never replay the full migration chain blindly.
5. Verify the target Worker has the correct D1, R2, ASSETS and encrypted secret bindings; deploy only through owner-approved release procedure.
6. Perform authenticated staging and production smoke tests for Gemini, Meta signed webhooks, WhatsApp consent/handover/delivery receipts, and social provider OAuth. Keep outbound sends disabled until separately approved.
7. Verify backup restoration, data retention/deletion, production log ingestion, alert routing, incident response and rollback.
8. Run independent authenticated penetration testing, dependency/SBOM review, and Android/iOS/desktop browser and accessibility acceptance.
9. Remove inline styles if feasible and tighten `style-src` after regression testing.

## Release decision

**NOT APPROVED FOR GLOBAL PRODUCTION LAUNCH.** Source-level checks pass on the recorded PR head, but owner MFA/session controls, Cloudflare target configuration, secret rotation, D1 state, provider staging tests, backup recovery and independent security review remain unverified or incomplete. Keep PR #62 in draft until those blockers are closed and re-tested.
