# Heavenly Key native Windows project

This is a native .NET 8 WPF application with Microsoft WebView2. It loads the Account 5 all-in-one experience on its own HTTPS origin, opens external sites in the operating system browser, and does not require a Heavenly Key account for public reading.

## Build and test

On Windows with .NET 8 SDK:

```powershell
dotnet restore HeavenlyKeyWindows.csproj
dotnet build HeavenlyKeyWindows.csproj --no-restore -c Release
```

Requires the official Microsoft Edge WebView2 Runtime to operate. GitHub Actions checks compilation only; it does not produce a signed public MSIX installer or prove real-device compatibility.

Before public release, create a properly versioned package with required runtime dependencies, sign it with a trusted code-signing certificate, verify antivirus and SHA-256, test on supported Windows versions, and publish only with owner approval. Do not present an unsigned build as a certified download.
