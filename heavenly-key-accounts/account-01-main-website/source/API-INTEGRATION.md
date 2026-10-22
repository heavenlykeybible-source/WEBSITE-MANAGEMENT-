# API-INTEGRATION.md
**Heavenly Key Public Website — Current API Integration Guide**

## Production contract
- Canonical website: `https://www.heavenlykey.org`
- Canonical API: `https://api.heavenlykey.org`
- Account 1 Worker is configured with a Custom Domain for `api.heavenlykey.org` and keeps `workers.dev` enabled as a fallback.
- CORS is implemented for the canonical website origin.
- `js/api-client.js` and `js/main.js` both use the canonical API URL.
- CI and production deployment run `check:api-contract` so frontend endpoints cannot silently drift away from Worker routes.

## Live website endpoints
Public forms:
- `POST /api/contact`
- `POST /api/newsletter`
- `POST /api/partner`
- `POST /api/public/prayer`
- `POST /api/public/testimony`
- `POST /api/decisions`

Public reads:
- `GET /api/testimonies`
- `GET /api/devotionals`
- `GET /api/events`
- `GET /api/bible/verse-of-day`
- `GET /api/bible/memory-verse`

Unsupported blog/sermon API calls were removed from production JavaScript; those homepage areas continue using curated static content until a real backend contract exists.

## Security
- Public intake submissions are server-validated, rate-limited, encrypted with AES-256-GCM and stored in D1.
- Decrypted public intake data is restricted to Deputy Super Administrator or higher.
- Member community submission routes remain separate and authenticated.
- Website API responses include security headers and canonical-origin CORS.
- API-derived URLs must pass `sanitizeURL()`; text interpolation must use `escapeHTML()`.

## Deliberately not connected
- Volunteer sign-up remains a mock adapter until a real volunteer API is approved.
- Event RSVP remains a mock adapter until a real registration API is approved.
- Counselling remains intentionally withheld pending safeguarding approval.

## Deployment rule
A production deployment must pass:
1. deployment preflight;
2. website/API contract check;
3. architecture regression check;
4. TypeScript check;
5. unit/integration tests;
6. Wrangler dry-run bundle compilation;
7. remote D1 migrations;
8. Worker deployment.

Do not bypass these gates merely to make a deployment turn green.
