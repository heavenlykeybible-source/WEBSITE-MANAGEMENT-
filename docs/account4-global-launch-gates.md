# Account 4 launch gates (owner approval required)

This document describes the **existing production Worker**. The security checks in this branch are regression checks, not certification.

## Before any merge
1. Require green Account 4 security checks, the full repository test suite, and an explicit code review.
2. Inspect all workflow files for unintended deployment triggers; no push-to-main auto deployment without owner approval.
3. Test owner and non-owner roles against GitHub imports, AI actions, proposals, release approval and secrets.
4. Test invalid and expired sessions, CSRF, origin restrictions, rate limits, D1/R2 permissions, and credential encryption.
5. Confirm an outdated GitHub commit cannot be released; simulate a branch change between review and deploy.
6. Validate full app import, live preview, rollback and recovery using a staging Worker.
7. Confirm the approved release's source SHA and target Worker name match what is actually deployed.
8. Perform mobile/browser accessibility checks, load testing and operational monitoring checks.

## Interface simplification (preserve existing routes)
- Primary navigation: Home; AI Chat; Connections; Waiting Room; Releases.
- Advanced: Pages, Design, CMS, Blogs, Domains, Projects, Cloudflare, Verification, Security, Logs.
- One account selector in AI Chat and import dialogs; show the actual project name and account number.
- Connections page: list GitHub identities, authorized repositories, token expiry/rotation status, and Cloudflare targets.
- Show permission requests in the active AI conversation, but owner must review exact changes in the Waiting Room.
- No credentials in browser storage or logs; no bypass of approval for production deployment.

## Current state
Review branch only. No production deployment or global-launch certification. Do not mark ready until all gates above are independently verified.
