# Shared Heavenly Key Doctrine — implementation and limitations

## Canonical owner-controlled content
Source file in Account 1: `heavenly-key-accounts/account-01-main-website/source/doctrine/approved.json`
Planned publication address: `https://www.heavenlykey.org/doctrine/approved.json`.
Contains 22 numbered articles, the KJV-only policy, an edition version and the owner's salvation, restitution and eschatology explanations.
Site `_headers` config permits public read-only access and 60-second revalidation. The actual Cloudflare Worker must serve this JSON correctly.

## Consumers updated in this branch
1. Account 1 main website: `assistant/knowledge.json` includes canonical feed pointer and pinned fallback doctrine. **Its live chatbot calls a separate CMS assistant endpoint, whose server-side knowledge loader is not present here; no proof it polls the canonical feed.** Backend integration is still REQUIRED.
2. Account 3 community AI: `apps/global-christian-community/src/heavenly-key-ai.ts` and its alternate source now fetch the canonical JSON per request, validate the schema and use it as additional official instructions. An embedded approved doctrine policy remains as fallback when inaccessible. Deploy/test after review.
3. Account 5 Heavenly Key App: `public/faith-content.js` exports `loadOfficialDoctrine()` to retrieve the feed. **Existing app screens do not yet call that function**; UI integration remains REQUIRED.
4. Account 6 Online Bible and other apps: NOT wired yet. Never modify KJV text to apply doctrine. Teaching commentary can reference the same JSON after a deliberate content-integration design.

## Owner update flow
1. Owner requests revisions to exact article(s) or interpretation in the main doctrine JSON.
2. Preserve Scripture citations verbatim and distinguish doctrine from KJV quotations.
3. Validate schema: exactly 22 numbered articles, approved authority and KJV translation; check review diff.
4. Run automated tests and preview. Owner approves changes before merging/deploying central JSON.
5. On publication, connected consumers refresh from the feed. New versions only require central publication where consumer integration is complete. No app-wide automatic deployments are required for policy-only revisions.
6. Use explicit version strings and keep a rollback copy; restore previous owner-approved revision if incorrect.

## Security / reliability
- This source is a PUBLIC read-only policy, never secrets, passwords, personal details or API keys.
- Only an owner-authorized publishing workflow may update the feed; don't allow users to alter doctrine through chat.
- Validate schema and origin; never fetch arbitrary URLs supplied by visitors.
- On outage, community AI uses pinned approved fallback; expose stale-policy state during future observability work.
- A cache max age of 60 seconds is a target, not a delivery guarantee. CDN, offline users and rollout take time.
- No deployment or browser/device/network verification has occurred in this branch.
