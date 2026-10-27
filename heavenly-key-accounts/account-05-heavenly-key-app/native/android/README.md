# Heavenly Key Android native installer

This is an Android application (APK), not a browser shortcut. It launches the official Account 5 all-in-one experience inside an Android WebView. Internet access is required for online pages.

## Build

Use Java 17, Android SDK 35 and Gradle 8.10.2:

```sh
gradle :app:assembleDebug
```

Debug builds are for device testing only. **Never publish a debug-signed or unsigned APK as a production release.**

For production, configure `HKEM_ANDROID_KEYSTORE_FILE`, `HKEM_ANDROID_KEYSTORE_PASSWORD`, `HKEM_ANDROID_KEY_ALIAS`, and `HKEM_ANDROID_KEY_PASSWORD` securely and build `gradle :app:assembleRelease`. Keep the signing key for all future updates. Upload only a verified signed release to private R2 at `all-in-one/android/release.apk` after testing.

Native installation on iPhone requires Apple's distribution process and is not provided by this Android project.
