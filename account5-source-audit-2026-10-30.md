# Account 5 — Source discovery and release assessment (2026-10-30)

## Verified repository locations
- Account folder: `heavenly-key-accounts/account-05-heavenly-key-app/`
- App source: `heavenly-key-accounts/account-05-heavenly-key-app/source/`
- Source package: `source/package.json`, name `heavenly-key-mobile-app`, version `0.1.0`.
- Source scripts: `npm run build`, `npm run check`, `npm test`, `npm run deploy`.

## Actual source findings
- Account 5 is an installable mobile web/PWA draft, **not** an established collection of native APK/IPA/Windows packages.
- The project documents 66 KJV books, reviewed hymn excerpts, a reading programme and an offline shell. Hymns inside Grow are not proof of a separately packaged Hymn Book application.
- Account 3 community integration is disabled pending verification.
- Approved audio manifests have zero published narrated chapters; do not advertise narrated audio downloads.
- Prior documentation reports local simulated tests, but real-device installation, production endpoints, native store builds, and current CI success remain unverified.
- Do not merge or deploy this draft until owner approval and staging checks pass.

## Release blockers
1. Enumerate actual Apps Page catalogue and match every app to a source path.
2. Verify each package's build output, SHA-256, distribution permission and platform installation.
3. Build independent Hymn Book if required; preserve source/provenance notices and licences.
4. Validate Account 3 integration, privacy, cookie/session protections and Cloudflare environment.
5. Run `npm run build && npm test` in Account 5 source and obtain a successful CI result.
6. Run browser/device/offline and security testing.
7. Require approval before merging or deploying.

## Status
This is a source-grounded audit note; it does **not** claim application defects were fixed or native packages built.
