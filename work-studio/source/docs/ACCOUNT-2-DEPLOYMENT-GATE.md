# Account 2 Deployment Gate

Before production deployment, all must pass:

- [ ] Separate Cloudflare account/project created.
- [ ] D1 provisioned and migration 0001 applied.
- [ ] R2 provisioned with lifecycle/retention policy.
- [ ] `MEDIA_ENGINE_SHARED_SECRET` stored as a Worker secret.
- [ ] Media Engine staging health endpoint passes.
- [ ] Invalid/missing capability returns 401.
- [ ] Administrator capability works; non-admin role is rejected.
- [ ] One-active-live-session database guard verified.
- [ ] 180-second heartbeat timeout verified.
- [ ] 10-minute reconnect deadline verified.
- [ ] Expired temporary R2 media is deleted automatically.
- [ ] KEEP media survives cleanup.
- [ ] Playout transitions scheduled → playing → completed.
- [ ] Social provider credentials are stored only in Account 2.
- [ ] Real provider distribution is tested with test accounts.
- [ ] Core-to-Engine proxy is tested before removing Core media bindings.

No production switch is authorized while any item above is unverified.
