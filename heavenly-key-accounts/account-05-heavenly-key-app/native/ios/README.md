# Heavenly Key iPhone/iPad native project

This is the Account 5 native iOS/iPadOS source (SwiftUI + WKWebView), not a bookmark or an Apple App Store listing. It opens the all-in-one app on the official HTTPS origin and sends other websites to the system browser. Public content does not require a Heavenly Key account; protected member functions still require their own sign-in.

## Build verification

Install Xcode and XcodeGen on macOS, then run:

```sh
cd heavenly-key-accounts/account-05-heavenly-key-app/native/ios
xcodegen generate
xcodebuild -project HeavenlyKey.xcodeproj -scheme HeavenlyKey -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

CI verifies that the project compiles without distribution credentials. The simulator build is **not** an installable, signed iPhone release.

## Before public distribution

An authorized Apple Developer team must set bundle identity, review/approve the app icon, supply signing assets and provisioning profiles securely, archive/test the app on physical iPhone and iPad, and use Apple distribution/TestFlight/App Store review. Apple may reject a simple website-wrapper application; review the functionality and App Review guidelines. Do not distribute an unsigned IPA, suggest an App Store listing exists, or label Safari's Add to Home Screen a native App Store download. No owner-approved public deployment is performed by these files.
