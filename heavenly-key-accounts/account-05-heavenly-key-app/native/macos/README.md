# Heavenly Key native macOS application

Native SwiftUI/WKWebView shell for macOS 12+. Visitors can access public ministry content without a Heavenly Key account. Account 5 stays on its own HTTPS origin; other ministry sites and downloads open in the system browser.

## CI and local build

```sh
cd heavenly-key-accounts/account-05-heavenly-key-app/native/macos
xcodegen generate
xcodebuild -project HeavenlyKeyMac.xcodeproj -scheme HeavenlyKeyMac -configuration Debug -sdk macosx CODE_SIGNING_ALLOWED=NO build
```

The CI output proves source builds only. Before public distribution, create a signed and notarized application using the owner's Apple Developer ID, test on physical Macs, produce a verified .dmg or .pkg with SHA-256 and malware review, and publish only after explicit release approval. Never advertise an unsigned build as a public installer.
