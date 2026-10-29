# Account 5 native distribution
Android project: android/. iPhone/iPad project: ios/ (SwiftUI, iOS 16+).
The iOS app includes native persistent scripture notes, native prayer tracking, sharing, and ministry resource navigation. Online resources require connectivity; native notes and prayers work offline.

## Build and release
Android testing: existing Build Account 5 Native Android APK workflow.
Android production: Package Account 5 Signed Android Release produces APK and Google Play AAB. It requires the existing HKEM_ANDROID signing secrets; do not create a replacement signing identity for an existing published app.
iOS compilation: Build Account 5 Native iPhone App generates the Xcode project and compiles simulator and device archive builds. An unsigned archive is NOT an installable iPhone download.
iOS distribution: open the generated project on a Mac, choose the owner's Apple Developer team, set the release build number, add approved app icons, archive with signing enabled, validate, and upload through Xcode Organizer to App Store Connect/TestFlight. Bundle ID: org.heavenlykey.apps.
Android store submission: upload the signed AAB to the owner's Google Play Console, complete app content declarations and testing, then submit for review.

## Still required before public release
- Successful native build logs and actual device tests.
- Apple distribution signing/provisioning and App Store Connect app record.
- Android production signing secrets available to the existing release workflow.
- Approved app icons, screenshots, support/privacy URLs and accurate store disclosures covering all embedded services.
- Test account/login, logout, account deletion, navigation, sharing and media on physical devices.
- Store review and published store URLs. Never invent listing URLs or label unsigned/debug artifacts as production releases.
No store approval, successful install, or production publication is claimed by these source changes.

Signed iOS package workflow: Package Account 5 Signed iPhone Release. Requires HKEM_IOS_CERTIFICATE_BASE64 (distribution certificate with private key, P12), HKEM_IOS_CERTIFICATE_PASSWORD, HKEM_IOS_PROFILE_BASE64 (App Store profile), HKEM_IOS_TEAM_ID in private repository secrets. It exports an App Store IPA; this IPA must be uploaded to App Store Connect and is not a direct website installer. The original ministry logo is used to generate icons without changing the source image. No credentials belong in chat or source.

## Native-only download page and private accounting
The download chooser and device pages no longer offer browser installation. iPhone/iPad require a configured, reviewed `stores.apple` URL in the app catalogue after store approval. Missing listings never produce a guessed link. The online resource remains a separate action.

Signed package delivery requires version, release date, minimum OS, processor architecture, matching scanned/published SHA-256 and an R2 SHA-256 checksum attached to the actual stored object. A package without all verification metadata is blocked. Windows delivery uses a signed EXE (`app-id/windows/release.exe`); the previous MSIX object is not silently substituted or deleted. Other keys are `app-id/android/release.apk` and `app-id/mac/release.dmg`. Existing databases, objects and secrets are preserved.

`create-release-manifest.mjs` creates dated metadata only when a scanner/signature report matches the package digest. The Android signed workflow includes the manifest. A trusted publisher must upload bytes with the storage SHA-256 checksum and exact custom metadata. HEAD does not count. A GET increments the private aggregate before a transfer starts; missing/unverified packages and failed requests are not counted. A statistics outage blocks the transfer rather than silently losing the count. These are download starts, not proof of completed transfer or installation. No member/IP/device identifiers are recorded. Apple/Google store downloads must be measured from their own private console analytics; website links cannot prove store installations.

## Desktop source added
`native/desktop` packages an installed Electron desktop application. Remote pages run with Node integration off, context isolation and renderer sandboxing on, restricted ministry navigation and no exposed native bridge. Permissions require consent; web contents cannot silently download and launch files. This is an installed desktop client using online ministry resources, not an offline reimplementation of every remote service.

The desktop PR workflow builds unpacked applications for testing. The manual production workflow requires Windows Authenticode or Apple Developer ID signing; Mac releases require notarization. Windows installers must pass signature verification and Defender scanning. No Windows or Mac release is publicly available until signed outputs are scanned, reviewed and uploaded with matching metadata. Supported OS/processor claims must be taken from the actual package and tested devices. Linux/ChromeOS and older OS releases are not promised. No process can guarantee zero malware or compatibility with every device ever made.

## Source verification completed 2026-10-29
All 122 Account 5 application tests now pass, with zero failures or skipped tests. `npm run check` verifies JavaScript syntax, imported modules and local asset links before the full suite. Root Control Room regression tests also pass. This resolves the ten historical suite failures; the suite retains the complete 66-book KJV integrity checks, reading-plan tests, private counter/security tests and offline-preservation checks. Retired Audio Bible playback tests were replaced by actual integrated hymn playback/approval tests. Directory counts and QR coverage now derive from the approved current catalogue rather than retired app counts.

Bible Study remains a My Walk With God module, not a separate download. Hymns remain integrated resources. Old QR image files and offline manifests are preserved for existing saved device data, while retired catalogue entries are no longer advertised. These source checks do not confirm public installation or store publication; signed production packages, store approval and physical-device installation tests are still required.
