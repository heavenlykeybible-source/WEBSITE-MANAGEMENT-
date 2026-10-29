# Heavenly Key native Windows project

This is a native .NET 8 WPF application with Microsoft WebView2. It loads the Account 5 all-in-one experience on its own HTTPS origin, opens external sites in the operating system browser, and does not require a Heavenly Key account for public reading.

## Build and test

On Windows with .NET 8 SDK:

```powershell
dotnet restore HeavenlyKeyWindows.csproj
dotnet build HeavenlyKeyWindows.csproj --no-restore -c Release
```

Requires the official Microsoft Edge WebView2 Runtime to operate. GitHub Actions tests compilation, a self-contained unsigned test build, and an unsigned MSIX packaging check. The manually triggered `release-account5-windows.yml` creates a production-signing-gated MSIX matching the public download service, but no public release is made by the workflow. Signed packages must pass Windows Defender scanning, review, and physical-device installation testing.

Before public release, use a trusted code-signing certificate with an owner-approved `production-release` environment, verify the MSIX signature and SHA-256, scan the exact package, test installation/uninstallation on supported Windows versions and confirm the WebView2 runtime. Publish only after owner approval. Do not present an unsigned test build as a certified download.
