# Heavenly Key — cross-application release gate

This checklist applies to **every** app and account. No application is considered global-launch-ready merely because it builds or responds with HTTP 200.

## Repository checks
- Run `node scripts/platform-quality-audit.mjs` and review each flagged link and font.
- Run `node scripts/platform-security-audit.mjs` and review each finding in context.
- Run each application's existing type checks, unit tests, build, and preflight checks.
- Avoid automatically triggering deployment workflows while conducting audits.

## Browser and device verification
- Test 320px, 375px, 768px, 1024px, and 1440px viewports.
- Verify every primary navigation item, internal page, form, and error state.
- Confirm no horizontal overflow and that text remains readable at 200% zoom.
- Keep ordinary interface text at least 14px; preserve the Bible reader's user-controlled sizing.
- Check keyboard navigation, focus visibility, accessible labels, touch targets, and screen-reader announcements.
- Test sign-in, sign-out, session expiry, unauthorized access, and recovery paths.
- Verify low-bandwidth handling, retries, offline behavior where promised, and clear error messages.
- Confirm uploads are type/size-limited and validated server-side; check authorization on every API endpoint.
- Verify official branding, one authorized footer, and absence of unauthorized floating assistants, radio widgets, or advertising.

## Release policy
- Use an isolated review branch and preview deployment.
- Record actual test results per app; do not claim that a test passed without execution evidence.
- Fix confirmed defects, retest, and only then seek approval for production release.
- Verify production URLs after deployment and keep a rollback path.
- Assess real-world capacity using load tests, monitoring, rate limits, queues, and infrastructure budgets before claiming Facebook-scale readiness.
