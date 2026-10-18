$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $PSScriptRoot
$ArtifactDir = Join-Path $RepoDir "BuildArtifacts\NativeHost\windows"

cargo build --manifest-path (Join-Path $RepoDir "native-host\Cargo.toml") --release --locked
if ($LASTEXITCODE -ne 0) {
    throw "Native host build failed with exit code $LASTEXITCODE."
}
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
Copy-Item (Join-Path $RepoDir "native-host\target\release\phasepal-browser-host.exe") (Join-Path $ArtifactDir "phasepal-browser-host.exe") -Force
python (Join-Path $PSScriptRoot "generate-native-release-metadata.py") --artifact-dir $ArtifactDir --executable phasepal-browser-host.exe --platform windows
if ($LASTEXITCODE -ne 0) {
    throw "Native host release metadata generation failed with exit code $LASTEXITCODE."
}
