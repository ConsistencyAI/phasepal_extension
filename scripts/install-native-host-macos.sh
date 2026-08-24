#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
REPO_DIR=${SCRIPT_DIR:h}
BUILD_HOST_PATH="$REPO_DIR/BuildArtifacts/NativeHost/macos/phasepal-browser-host"
INSTALL_DIR="$HOME/Library/Application Support/PhasePal/NativeMessaging"
HOST_PATH="$INSTALL_DIR/phasepal-browser-host"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/app.phasepal.music.json"

if [[ ! -x "$BUILD_HOST_PATH" ]]; then
  print -u2 "Build the native host first: ./scripts/build-native-host-macos.sh"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"
mkdir -p "$INSTALL_DIR"
cp "$BUILD_HOST_PATH" "$HOST_PATH"
chmod 700 "$INSTALL_DIR"
chmod 700 "$HOST_PATH"
python3 - "$HOST_PATH" "$MANIFEST_PATH" <<'PY'
import json
import pathlib
import sys

host_path, manifest_path = sys.argv[1:]
manifest = {
    "name": "app.phasepal.music",
    "description": "Phase Pal Dance to Music browser bridge",
    "path": host_path,
    "type": "stdio",
    "allowed_origins": ["chrome-extension://liinajbmlphpehjkmjdffpjhajdpgfpm/"],
}
pathlib.Path(manifest_path).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY
chmod 600 "$MANIFEST_PATH"
print "Installed $MANIFEST_PATH"
