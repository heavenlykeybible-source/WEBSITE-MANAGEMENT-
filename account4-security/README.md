# Account 4 — Security Control Room backend

## Prepared files
- `schema.sql`: Cloudflare D1 case, event, challenge, and audit-log tables.
- `worker.js`: private service API for holds, enforcement checks, case review and decisions.

## Deployment prerequisites (not performed by committing code)
1. Create a dedicated Cloudflare D1 database in **Account 4** and apply `schema.sql` through the Cloudflare dashboard or Wrangler.
2. Deploy `worker.js` as a separate Worker with D1 binding **SECURITY_DB**.
3. Configure **SECURITY_SERVICE_KEY** as a Worker secret: at least 32 random characters, not in GitHub or client-side JavaScript.
4. Restrict the Worker with Cloudflare Access/service-to-service controls where feasible. Never expose the secret to a browser or mobile app.
5. Integrate each participating site's authenticated backend with `POST /v1/enforcement` before posting, messaging, uploading, or other restricted actions. The backend must use its authenticated user/service identity and log decisions.
6. Implement authenticated administrator roles in the existing Control Room. Only authorized owner/admin sessions may instruct the backend to call case-management endpoints; log the authenticated actor.
7. Implement Turnstile **server-side verification**, registration/login/post/message rate limits, and secure verification delivery with a configured email provider. Verification links must use hashed or signed tokens and cannot be exposed in plain view.
8. Add quarantine storage only after creating and binding a private R2 bucket. Validate upload type, size, and content on the server. Do not make quarantined objects publicly accessible.
9. Test with synthetic accounts: clear, held, verification-pending, restored, suspended; confirm enforcement from every connected site. Do not place real users on hold without reviewed evidence and approval.

## Internal endpoints
All require `Authorization: Bearer <SECURITY_SERVICE_KEY>` from a trusted server.
- `POST /v1/enforcement`: `{"site":"global","user_id":"test-user"}`
- `POST /v1/cases`: `{"site":"global","user_id":"test-user","status":"on_hold","reason_code":"spam_pattern","risk_level":"high","actor_id":"trusted-admin","evidence_summary":"synthetic test"}`
- `POST /v1/cases/decision`: `{"case_id":"...","actor_id":"trusted-admin","status":"restored","reason":"Account verified by administrator"}`
- `GET /v1/cases`: recent 100 cases.

## Important security limitations
The API is an **integration component**, not an independent login, anti-bot, or spam classifier. Its bearer key identifies a trusted calling backend; it does not authenticate individual administrators or site users.

The schema and Worker are not deployed by these GitHub commits. D1/R2/Turnstile, actual account holds, verification emails, dashboard controls, and cross-site enforcement remain unconfigured until a separate secure deployment is performed.
