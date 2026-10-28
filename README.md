# Website Management

Isolated Cloudflare Worker CMS with D1 and R2. Secrets are configured in Cloudflare and must never be committed.

Run checks: `node tests/run.mjs`. Deployment: `npx wrangler deploy`.

See the included audit, setup, login, release and maintenance guides for capabilities and limitations.

## Find an account or application

Use the [official account registry](HEAVENLY-KEY-ACCOUNT-REGISTRY.md) and [account folders](heavenly-key-accounts/). Machine-readable locations are in [config/heavenly-key-accounts.json](config/heavenly-key-accounts.json).

### Account 8 — Heavenly Key MeetingSpace

Open [Account 8](heavenly-key-accounts/account-08-heavenly-key-meetingspace/README.md) for its source, website, Worker, deployment workflow and test links. The complete meeting app is maintained in [zoom-studio/](zoom-studio/README.md). It is already in this repository; no separate meeting repository is required. Account 7 is Radio.
