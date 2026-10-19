# Heavenly Key Studio and Media Engine

Account 2 source is maintained here as a candidate in web management. See [the refinement and activation guide](../STUDIO-REFINEMENT.md). Existing D1/R2/KV bindings, API integration and provider secrets must be preserved.

Validation (Node 24): `npm ci`, `npm test`, `npm run check`, `npm run preflight`.

Deploy only to the existing `heavenlykey-media` Worker in the correct Cloudflare account. Never run historical migrations or recreate resources as part of an ordinary code deployment.
