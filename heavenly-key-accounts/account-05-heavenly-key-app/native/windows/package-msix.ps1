param(
 [Parameter(Mandatory=$true)][string]$Publisher,
 [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$stage = Join-Path $projectRoot 'msix-staging'
$published = Join-Path $projectRoot 'signed-candidate'
if (-not (Test-Path (Join-Path $published 'HeavenlyKeyWindows.exe'))) { throw 'Published Windows executable missing' }
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
# Package only the application and runtime dependencies, not prior installers.
$contents = @(Get-ChildItem -LiteralPath $published -Force | Where-Object {
  $_.Name -notmatch '(?i)\.(msix|msixbundle|appx|appxbundle|sha256|pfx|cer)$' -and
  $_.Name -notmatch '(?i)\.security\.txt$'
})
if (-not ($contents | Where-Object { $_.Name -eq 'HeavenlyKeyWindows.exe' })) {
  throw 'Published app executable not found in selected MSIX payload'
}
foreach ($file in $contents) {
  Copy-Item -LiteralPath $file.FullName -Destination $stage -Recurse -Force
}
$assets = Join-Path $stage 'Assets'
New-Item -ItemType Directory -Force -Path $assets | Out-Null

# Create local placeholder package logos without external downloads or untrusted assets.
Add-Type -AssemblyName System.Drawing
foreach ($item in @(@('Square150x150Logo.png',150),@('Square44x44Logo.png',44),@('StoreLogo.png',50))) {
 $name=[string]$item[0]; $size=[int]$item[1]
 $bitmap=[System.Drawing.Bitmap]::new($size,$size)
 try {
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  try {
   $graphics.Clear([System.Drawing.Color]::FromArgb(24,55,112))
   $brush=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
   try {
    $font=[System.Drawing.Font]::new('Arial',[Math]::Max(10,[int]($size*0.35)),[System.Drawing.FontStyle]::Bold)
    try { $graphics.DrawString('H',$font,$brush,[single]($size*0.21),[single]($size*0.22)) }
    finally { $font.Dispose() }
   } finally { $brush.Dispose() }
  } finally { $graphics.Dispose() }
  $bitmap.Save((Join-Path $assets $name),[System.Drawing.Imaging.ImageFormat]::Png)
 } finally { $bitmap.Dispose() }
}
$escapedPublisher = [System.Security.SecurityElement]::Escape($Publisher)
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap rescap">
  <Identity Name="HeavenlyKey.Apps" Publisher="$escapedPublisher" Version="1.0.0.0" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>Heavenly Key</DisplayName>
    <PublisherDisplayName>Heavenly Key Evangelistic Movement</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources><Resource Language="en-us"/></Resources>
  <Applications>
    <Application Id="HeavenlyKey" Executable="HeavenlyKeyWindows.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="Heavenly Key" Description="Heavenly Key Christian apps"
        BackgroundColor="#183770" Square150x150Logo="Assets\Square150x150Logo.png" Square44x44Logo="Assets\Square44x44Logo.png" />
    </Application>
  </Applications>
  <Capabilities><rescap:Capability Name="runFullTrust"/></Capabilities>
</Package>
"@
[IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'),$manifest,[Text.UTF8Encoding]::new($false))
$kitRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
$makeappx = Get-ChildItem $kitRoot -Filter makeappx.exe -File -Recurse |
 Where-Object { $_.DirectoryName -match '\\x64$' } |
 Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $makeappx) { throw 'Windows SDK makeappx tool missing' }
& $makeappx pack /d $stage /p $OutputPath /o
if ($LASTEXITCODE -ne 0) { throw 'MSIX packaging failed' }
if (-not (Test-Path $OutputPath)) { throw 'MSIX output missing' }
