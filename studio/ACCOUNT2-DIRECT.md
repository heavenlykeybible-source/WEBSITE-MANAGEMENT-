# Direct Account 2 deployment

Target: existing heavenlykey-media Worker, Cloudflare account c324d871146f8fcc5e7dcd3da057011c. Website: https://studio.heavenlykey.org/.

Connect WEBSITE-MANAGEMENT- on branch codex/heavenly-key-studio-refinement, root studio. Build: npm ci && npm run verify:release. Deploy: npx wrangler deploy --config wrangler.account2.toml.

The embedded release serves the website directly. STUDIO_AUTH_MODE=account2 authenticates against the existing ADMIN_USERNAME and ADMIN_PASSWORD Worker secrets. No Account 4 service or shared SSO key is required for this mode. Existing credentials are not changed or copied. Password changes invalidate local sessions. Sessions use Secure HttpOnly cookies, same-origin writes and a per-IP KV login throttle (eventual consistency applies).

Preserve the existing MEDIA_ENGINE_SHARED_SECRET, other secrets, DB, MEDIA_R2, LIVE_STATUS_KV, domain routes and one-minute cron. No database migration, seed or reset is needed. Replace code in the existing Worker to retain encrypted secrets; remove obsolete additional Workers only after inventory and successful live cutover. Account 4 and Account 7 are outside this deployment.

Validated locally: root regressions, Studio authentication/media/radio/connection/device checks, direct Account 2 authentication/security tests, TypeScript, preflight and embedded release verification. Live broadcast acceptance still requires saved LiveKit/provider configuration and a deliberate on-air test.
