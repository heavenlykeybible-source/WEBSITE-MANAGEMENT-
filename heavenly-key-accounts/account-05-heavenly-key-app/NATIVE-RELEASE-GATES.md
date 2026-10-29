# Account 5 — Native application release gates

**Source of truth:** `heavenly-key-accounts/account-05-heavenly-key-app/` in `heavenlykeybible-source/WEBSITE-MANAGEMENT-`. No native app is publicly released by creating source files or by passing simulator tests.

## Public experience
- Browsing and downloading public applications do **not** require Heavenly Key registration.
- Authentication is required only for protected member functions.
- Admin-only download statistics remain protected by `DOWNLOAD_ADMIN_TOKEN`.
- The website download links are hidden until the worker verifies the published package size, SHA-256, malware-scan marker, and verified signature metadata.
- A browser-installed shortcut/PWA is not an APK, IPA, Windows package, or Mac DMG. Never represent it as one.

## CI and public release controls
1. Run automated source, security and device-build tests. Preserve observed results and record failures.
2. Verify a physical device on supported versions (installation, first launch, opening official service links, login only for member features, downloads, uninstall, offline behavior, and accessibility).
3. Configure the GitHub **production-release** environment with owner-required reviewers and prevent bypasses. Creating a workflow referencing this environment does *not* create reviewers or grant approval.
4. Add signed distribution credentials to GitHub Secrets, not repository source code, chat, logs or downloadable build artifacts.
5. Run the appropriate manually dispatched signed release workflow after review.
6. Verify the finished package on the target device, validate signing, scan the exact package, record its checksum, and approve the precise release identifier.
7. Upload only the reviewed signed binary to Cloudflare `NATIVE_RELEASES` R2 with exact `sha256`, `scannedSha256`, `malwareScan=passed`, `signatureVerified=true`, `appId`, and `platform` metadata. Do not set these fields without corresponding evidence. The serving worker must verify these markers and require the metadata `appId` and `platform` to match the requested QR destination before showing a public installer. The existing all-in-one app binary must be identified as `appId=all-in-one`; a separate app QR requires its own distinct, reviewed package and must not silently install the all-in-one wrapper.
8. Obtain separate owner approval before deploying site changes or making packages publicly downloadable.

## Android
- Testing workflows: `build-account5-android.yml` and `test-account5-android-emulator.yml`.
- Signed candidate: `release-account5-android.yml`.
- GitHub secrets: `HKEM_ANDROID_KEYSTORE_BASE64`, `HKEM_ANDROID_KEYSTORE_PASSWORD`, `HKEM_ANDROID_KEY_ALIAS`, `HKEM_ANDROID_KEY_PASSWORD`.
- Required: production signing; full malware scan; package signature and checksum; on-device installation; release review.
- A debug APK from an emulator job must **never** be published as a production app.

## iPhone / iPad
- Simulator build/install: `test-account5-ios-simulator.yml`.
- Signed candidate: `release-account5-ios.yml`.
- Secrets: `HKEM_IOS_DISTRIBUTION_P12_BASE64`, `HKEM_IOS_DISTRIBUTION_P12_PASSWORD`, `HKEM_IOS_PROFILE_BASE64`, `HKEM_IOS_PROFILE_NAME`, `HKEM_APPLE_TEAM_ID`.
- Signed IPA is for review and submission through authorized Apple distribution. This workflow does **not** automatically publish to the App Store or substitute for Apple's approval.
- Test on physical iPhone and iPad. Apple may require functional features beyond a basic web wrapper.

## Windows
- Testing: `test-account5-windows.yml`; unsigned self-contained executable is strictly an internal test artifact.
- Signed candidate: `release-account5-windows.yml`.
- Secrets: `HKEM_WINDOWS_PFX_BASE64`, `HKEM_WINDOWS_PFX_PASSWORD`.
- The packaging script `native/windows/package-msix.ps1` creates a full-trust MSIX with Windows package identity and local image assets. Its unsigned structure is checked in `test-account5-windows.yml`.
- The gated release workflow assembles and signs an MSIX, matching the Windows `.msix` endpoint. The signed candidate must still pass signature verification, an exact-package malware scan, Windows 10/11 installation and launch tests, and owner approval before publication.
- An unsigned MSIX test package and a signed EXE by themselves must never be published as a signed MSIX release.

## macOS
- Testing: `test-account5-macos.yml`; unsigned test ZIP cannot be distributed publicly.
- Signed candidate: `release-account5-macos.yml`.
- Secrets: `HKEM_MAC_DEVELOPER_ID_P12_BASE64`, `HKEM_MAC_DEVELOPER_ID_P12_PASSWORD`, `HKEM_MAC_DEVELOPER_ID`, `HKEM_APPLE_NOTARY_ID`, `HKEM_APPLE_NOTARY_PASSWORD`, `HKEM_APPLE_TEAM_ID`.
- Requires Developer ID signing, hardened runtime, Apple notarization, stapling, verification, checksum and physical Mac installation testing.

## External blockers
The agent cannot create valid production signing certificates, Apple Developer membership, provisioning profiles, store approvals, notarization results, physical-device testing evidence, or a production-release environment review on behalf of the owner. Do not report these as finished until independently verified.
