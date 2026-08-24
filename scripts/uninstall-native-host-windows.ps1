$ErrorActionPreference = "Stop"
$ManifestPath = Join-Path $env:LOCALAPPDATA "PhasePal\ChromeNativeMessaging\app.phasepal.music.json"
$HostPath = Join-Path $env:LOCALAPPDATA "PhasePal\ChromeNativeMessaging\phasepal-browser-host.exe"
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\app.phasepal.music"

if (Test-Path $RegistryPath) {
    Remove-Item -Path $RegistryPath -Force
}
if (Test-Path $ManifestPath) {
    Remove-Item -Path $ManifestPath -Force
}
if (Test-Path $HostPath) {
    Remove-Item -Path $HostPath -Force
}
Write-Host "Removed the Phase Pal Chrome native host registration."
