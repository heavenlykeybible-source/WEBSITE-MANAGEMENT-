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
