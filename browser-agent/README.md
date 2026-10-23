# Account 4 browser agent

The Control Room contains an owner-only Browser agent panel and three AI tools: `browser_request_task`, `browser_task_status`, and `browser_action`. Each task requires approval of its goal and exact HTTPS hosts. Navigation, clicks, and form actions are staged for an inline owner decision. Private field entry never goes to the AI or D1. Screenshots are returned only to the authenticated owner; input values are masked. Screenshots can still show private page content.

The private Cloudflare Worker runs `@cloudflare/puppeteer`. It exposes no public routes, no arbitrary JavaScript evaluation, and no cookie/storage export. Sessions are isolated per task and encrypted in the control plane. A task lasts two minutes, idle sessions expire after thirty seconds, and the control plane reserves at most three tasks daily. These application limits do not account for other consumers of the same Cloudflare browser allowance. Provider CAPTCHA and authentication remain provider-controlled; some sites will block automation.

## Activation blocked as of 2026-10-23

The configured deployment credential can read the existing Control Room Worker, but the read-only preflight returned HTTP 401 for the browser runtime and HTTP 403 for account subscriptions. No runtime or plan was activated. Live browsing and production browser smoke tests have not passed.

Once Account 4 Browser Run access is enabled by its owner and the appropriate deployment token is configured, deploy this separate Worker and add a service binding `BROWSER_AGENT` targeting `heavenlykey-browser` to `website-management`. Preserve every existing binding, database, bucket, secret, and compatibility setting. Do not deploy the repository's historical root Wrangler configuration. Do not change billing as part of activation. The service configuration is `browser-agent/wrangler.jsonc`; its `HK_BROWSER` binding is required. Deploying the UI alone must continue to report runtime unavailable.

The browser network policy requires exact approved hosts for both pages and subresources, checks public DNS answers, and blocks private IP literals. It is intentionally restrictive; resource hosts and identity-provider redirects must be separately included in a task. DNS checks are not a guarantee against every DNS rebinding attack; use Cloudflare's runtime network restrictions as an additional boundary. Page content and labels remain untrusted. Browser sessions do not automatically share authentication with the owner's local browser.

Validation: `node tests/run.mjs`, `node tests/browser-agent.mjs`, and CI browser fixture tests. The fixture verifies the actual driver against Chromium without third-party sign-ups or production data.
