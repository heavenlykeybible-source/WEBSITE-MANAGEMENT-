# Persistent installation data

Routine code updates must preserve the existing production D1 database, R2 bucket, and Worker secrets. Never recreate, clear, seed over, or change the production resource bindings as part of an ordinary deployment.

Keep the existing VAULT_KEY: stored provider keys and connection credentials depend on it. Rotation requires an explicit migration that decrypts and re-encrypts saved credentials; never replace the key alone. Preserve SESSION_SECRET, owner identity/password records, connected websites, agents, proposals and audit history. Do not print or commit secrets.

Use additive, idempotent database migrations. Do not run destructive schema resets or production account seed scripts during builds. Deleting/replacing a connection requires an explicit user action. Provider-side expiry or revocation still requires reconnection.

Before publishing changes, run node tests/run.mjs. Connection tests must not delete or replace an existing saved credential on failure. API credentials belong in encrypted D1 storage, not browser localStorage or bundled source.
