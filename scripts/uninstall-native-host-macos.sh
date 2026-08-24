#!/bin/zsh
set -euo pipefail

MANIFEST_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/app.phasepal.music.json"
HOST_PATH="$HOME/Library/Application Support/PhasePal/NativeMessaging/phasepal-browser-host"
if [[ -f "$MANIFEST_PATH" ]]; then
  rm "$MANIFEST_PATH"
  print "Removed $MANIFEST_PATH"
else
  print "Phase Pal native host was not installed."
fi
if [[ -f "$HOST_PATH" ]]; then
  rm "$HOST_PATH"
  print "Removed $HOST_PATH"
fi
