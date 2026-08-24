#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
REPO_DIR=${SCRIPT_DIR:h}
ARTIFACT_DIR="$REPO_DIR/BuildArtifacts/NativeHost/macos"

cargo build --manifest-path "$REPO_DIR/native-host/Cargo.toml" --release --locked
mkdir -p "$ARTIFACT_DIR"
cp "$REPO_DIR/native-host/target/release/phasepal-browser-host" "$ARTIFACT_DIR/phasepal-browser-host"
chmod 755 "$ARTIFACT_DIR/phasepal-browser-host"
python3 "$SCRIPT_DIR/generate-native-release-metadata.py" \
  --artifact-dir "$ARTIFACT_DIR" \
  --executable phasepal-browser-host \
  --platform macos
