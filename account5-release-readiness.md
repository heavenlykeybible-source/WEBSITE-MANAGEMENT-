# Account 5 — Download release inventory

This file is a release gate, **not** a claim that any package exists. Do not publish an app as downloadable until its platform artifact is built, signed where necessary, and verified.

## Required inventory format

Create `account5-release-manifest.json` with `{"schemaVersion":1,"apps":[]}` initially. For each actual application, add:
- `id`: unique stable slug
- `name`: public name
- `sourcePath`: path to its source in this repository
- `packages`: list of `{"platform":"android|ios|windows|macos|linux|pwa","version":"...","url":"https://...","sha256":"64 lowercase hex digits","verified":true}`

Only set `verified:true` after obtaining the exact built artifact, matching SHA-256, checking installation or approved distribution and running security checks. Never invent package links or claim iOS IPA can be installed without Apple signing/distribution.

## Launch gates
1. Identify all applications in the Account 5 Apps Page; reconcile each against this manifest.
2. Run source tests, dependency/security scans and accessibility/mobile checks.
3. Build Android artifacts and verify signing and installation on supported devices.
4. Verify Apple distribution through App Store/TestFlight or an appropriately installable PWA; do not link unsigned IPA files.
5. Verify Windows/macOS/Linux installers only for apps supporting those platforms.
6. Verify download buttons and checksums, no dead links, no executable from untrusted origins.
7. Require owner approval in the Control Room before deployment.

## Hymn Book
The Hymn Book must appear as a distinct app **within Account 5 Apps Page**, not as an independently hosted website. Add it to the manifest only when its real source and package are present.


## R2 native binary integrity requirement (Android, Windows, macOS)

The Account 5 download Worker now rejects a native release unless its R2 object supplies a stored `checksums.sha256` equal to the published `customMetadata.sha256` and `customMetadata.scannedSha256`. On each approved upload:
1. Calculate SHA-256 from the final signed binary, after any changes.
2. Upload the identical binary to the private `NATIVE_RELEASES` R2 bucket with the SHA-256 upload option enabled, so Cloudflare stores and checks the digest.
3. Set `sha256`, `scannedSha256`, `malwareScan=passed`, `signatureVerified=true`, `appId`, and `platform` metadata only after reviewing the exact binary.
4. Verify R2 HEAD returns the expected checksum and exact app identity, then verify an actual GET download and installation in staging.
5. If R2's stored SHA-256 is missing, the binary must be re-uploaded with checksum verification. Do not bypass this gate by editing metadata.

**Status:** the gate is implemented on the development branch; no signed release binary, successful CI execution, physical device test, or launch approval is implied.
