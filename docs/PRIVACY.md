# Privacy and permissions

This document describes the source in this repository. It is not a statement about
all Phase Pal app features or third-party music services.

## Data flow

The content script reads media playback state on Spotify Web, YouTube Music, and
SoundCloud. It checks whether title, artist, and timeline information exists.
Actual title and artist text remains in the page. The extension uses tab URLs
locally to identify supported sites and tab IDs locally to select playback.

The bridge sends the following to the local native host and Phase Pal:

- A fixed provider ID, playback and capture flags, and metadata-presence booleans.
- Protocol and extension versions, a random browser-service session ID, sequence
  numbers, and timestamps.
- During optional capture: energy, beat confidence, estimated tempo and phase,
  beat pulses, onset density, and section intensity.
- A fixed reason code when capture stops.

The host reads a local Phase Pal runtime descriptor with a port and session token.
It uses these to authenticate to `127.0.0.1`. The protocol does not carry song names,
artist names, URLs, page titles, page text, browser history, or raw audio to Phase
Pal. Playback on a supported site is treated as music; podcasts and speech can
also trigger it.

## Optional audio capture

Select **Enable Beat Sync** in the popup to start capture of the active supported
tab. Capture includes audio from that tab, including speech or ads. It does not
request microphone access. Audio samples are analyzed in extension memory and
routed back to the audio output so the tab stays audible. This source has no audio
recording or upload path. Select **Stop Beat Sync** to stop capture. Disable or
remove the extension to stop automatic playback detection as well.

## Permissions

| Permission | Purpose |
| --- | --- |
| Supported-site host access | Read playback state and metadata presence on the three listed sites. |
| `nativeMessaging` | Exchange fixed messages with the installed local host. |
| `tabCapture` | Obtain the tab audio stream after the popup action. |
| `offscreen` | Analyze audio outside the popup lifetime. |

The manifest and permission list should be reviewed with each release.

## Storage and network boundary

The reviewed source has no analytics or remote upload endpoint. Playback state,
session IDs, and audio analysis state are held in memory. Host installation writes
a native messaging manifest and executable to the user profile, plus a per-user
registry entry on Windows. Phase Pal owns its separate runtime descriptor.

The source does not define what the Phase Pal application stores or sends after
receiving a frame. Consult that application's privacy information separately.
Supported websites and Chrome also have their own data practices. Local source
review does not prove the behavior of a future packaged binary.
