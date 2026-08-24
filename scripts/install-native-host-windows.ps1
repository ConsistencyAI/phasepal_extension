$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $PSScriptRoot
$BuildHostPath = Join-Path $RepoDir "BuildArtifacts\NativeHost\windows\phasepal-browser-host.exe"
$ManifestDir = Join-Path $env:LOCALAPPDATA "PhasePal\ChromeNativeMessaging"
$ManifestPath = Join-Path $ManifestDir "app.phasepal.music.json"
$HostPath = Join-Path $ManifestDir "phasepal-browser-host.exe"

if (-not (Test-Path $BuildHostPath)) {
    throw "Build the native host first with scripts\build-native-host-windows.ps1"
}

New-Item -ItemType Directory -Force -Path $ManifestDir | Out-Null
Copy-Item $BuildHostPath $HostPath -Force
$Manifest = @{
    name = "app.phasepal.music"
    description = "Phase Pal Dance to Music browser bridge"
    path = $HostPath
    type = "stdio"
    allowed_origins = @("chrome-extension://liinajbmlphpehjkmjdffpjhajdpgfpm/")
}
$Manifest | ConvertTo-Json -Depth 3 | Set-Content -Path $ManifestPath -Encoding utf8
New-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\app.phasepal.music" -Force | Out-Null
Set-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\app.phasepal.music" -Value $ManifestPath
Write-Host "Installed $ManifestPath"
