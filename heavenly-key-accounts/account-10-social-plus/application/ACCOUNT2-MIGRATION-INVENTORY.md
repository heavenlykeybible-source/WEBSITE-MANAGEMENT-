# Account 2 social management migration

Source: `studio/src/index.ts` on `codex/heavenly-key-studio-refinement`.

Routes to migrate: `/api/social/welcome-menu`, `/api/social/assistant/handover-policy`, `/api/social/assistant/conversation`, `/api/social/assistant/conversations`, `/api/social/assistant/takeover`, `/api/social/whatsapp/rules`, `/api/social/whatsapp/rules/preview`, `/api/social/accounts`, `/api/social/automation/readiness`.

Account 10 already has independent welcome menu, auto-reply drafts, conversations, human takeover and social post draft APIs. The original Account 2 implementation uses `LIVE_STATUS_KV` and its operator authentication; data cannot be moved merely by copying code. Implement equivalent independent D1 records, authorized export/import, and verification before retiring Account 2. Do not move tokens or secrets into GitHub. Live provider connections are not configured.
