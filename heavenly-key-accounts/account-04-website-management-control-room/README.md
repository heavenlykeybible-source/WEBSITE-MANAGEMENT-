# Account 4 — Website Management Control Room

The newer Website Management control room in repository root on `main` is authoritative.

The `source/`, `uploaded-reference/`, and `recovered-onlinebible/account4-control-room/` files contain historical implementations for comparison only. Do not replace the modern control room or deploy the historical Worker, authentication, permissions, UI or schemas.

Before migrating any feature, verify it is absent from the latest implementation, bring over only the missing functionality, run tests, preserve production bindings and obtain deployment verification. Other accounts follow the same latest-version-wins rule.
