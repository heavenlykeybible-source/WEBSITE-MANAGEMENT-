# Account 2 → Account 10: safe migration procedure

## Confirmed resources (2026-10-27)
- Source Account 2 D1: `heavenlykey-media-db` (ID `0a512013-8b98-46b2-9404-4df65b0c0f04`).
- Destination Account 10 D1: `heavenlykey-social-management-db` (ID `96001ae8-d057-40d1-ba8a-167d8eab63cc`).
- Accounts are in **different Cloudflare accounts**. Never run destructive SQL on the source.
- Account 2 also stores some social conversations and WhatsApp rules in `LIVE_STATUS_KV`; a D1-only export is **not** a complete migration.

## Access required
An authorized Cloudflare operator must obtain a read-only export of the source D1 social tables and the social keys from Account 2's LIVE_STATUS_KV. The currently connected management tool can only list D1 resources, not query/export them. Keep all exported user messages, account IDs and private data **outside GitHub**.

## Prepare Account 10 (Cloudflare CLI with Account 10 credentials)
1. Confirm the destination binding in `wrangler.toml`.
2. Apply `schema.sql` to the destination database with Cloudflare Wrangler D1 execute (`--remote --file=schema.sql`) from the `account10-social-management` directory.
3. Configure `ADMIN_TOKEN` as a Cloudflare Worker secret; never put it in source code.
4. Deploy the Worker and static assets only after verifying TypeScript compilation and the schema.
5. Confirm `/health`, then authorized `/api/readiness` and `/api/migration/status`.

## Transfer in safe order
1. Export Account 2 social account **metadata**, not access tokens. Reconnect provider OAuth credentials in Account 10 separately.
2. Export automation rules from the Account 2 KV store.
3. Export conversation metadata and historical messages from Account 2 KV; retain stable IDs, original timestamps, direction, human pause state and human requests.
4. Map and validate source records offline. Do not assume source KV and destination D1 use identical shapes.
5. Import to Account 10 through authenticated endpoints:
   - `POST /api/accounts/import` with `{"items":[{"channel":"facebook_page","providerAccountRef":"..."}]}`
   - `POST /api/automation/rules/import` with `{"items":[{"keyword":"...","reply":"..."}]}`
   - `POST /api/conversations/import` with `{"items":[{"id":"...","channel":"whatsapp_business","senderId":"...","messages":[]}]}`
   - `POST /api/messages/import` with `{"items":[{"id":"...","conversationId":"...","direction":"inbound","body":"..."}]}`
6. Compare source and destination record counts and sample messages; inspect human handover states and duplicate handling.
7. **Do not disable Account 2 or cut over production routing** until all counts, functionality and external provider reauthorizations are verified.

## Explicit limitations
The current import API does not fully preserve original timestamps, paused flags, or provider credentials. Implement and test these before claiming a complete historical migration. No live social publishing or external messaging should be claimed until provider integration tests pass.

## Security
Never commit exports, tokens, OAuth refresh credentials, messages, or personal information. Limit export access to authorized operators, use encrypted transfer, and remove temporary copies after verification.
