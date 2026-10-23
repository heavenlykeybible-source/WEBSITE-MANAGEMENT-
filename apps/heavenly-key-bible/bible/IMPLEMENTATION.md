# HEAVENLY KEY BIBLE implementation

See README.md for current capabilities, validation and release blockers, and SOURCE.md for KJV provenance. Deploy configuration is bible/wrangler.toml; the dedicated Worker serves the Bible assets at its root and proxies only allowlisted public ministry APIs. The shared main ministry Worker is not redeployed by this Bible configuration.

Local checks passed for complete KJV source integrity, reader/search/study behavior, offline download and checksum failures, Worker credential isolation, and UI asset wiring. Wrangler 4.145.0 deployment dry run passed. No live deployment is claimed.

Gospel assets must be published with topic gospel-music through the existing Media Library. No unrelated project, protected resource, database, signing key or administrator credential is changed.
