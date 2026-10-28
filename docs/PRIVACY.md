# Privacy and permissions

This document describes the source in this repository. It is not a statement about
all Phase Pal app features or third-party music services.

## Data flow

The content script reads media playback state on the exact music-player
hosts in [the site list](SUPPORTED_SITES.md) and on [custom websites](CUSTOM_SITES.md)
the user adds with Chrome's site access permission. It checks whether title, artist,
and timeline information exists, and can read explicit MediaSession playback state.
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
or approved custom tab. Capture includes audio from that tab, including speech or ads. It does not
request microphone access. Audio samples are analyzed in extension memory and
routed back to the audio output so the tab stays audible. This source has no audio
recording or upload path. Select **Stop Beat Sync** to stop capture. Disable or
remove the extension to stop automatic playback detection as well.

## Permissions

| Permission | Purpose |
| --- | --- |
| Supported-site host access | Read playback state and metadata presence on the named music-player hosts. |
| Optional HTTP(S) host access | Request one exact custom website after the Add website action. |
| `scripting` | Register and inject playback monitoring only on approved custom websites. |
| `nativeMessaging` | Exchange fixed messages with the installed local host. |
| `tabCapture` | Obtain the tab audio stream after the popup action. |
| `offscreen` | Analyze audio outside the popup lifetime. |
| `storage` | Save Auto Beat Sync and the Don't show again reminder choice locally on this device. |

The manifest and permission list should be reviewed with each release.

## Chrome Web Store Limited Use

The use of information received from Google APIs will adhere to the Chrome Web
Store User Data Policy, including the Limited Use requirements.

The extension-specific public policy is prepared at
`https://www.phasepal.com/browser-extension/privacy`. It must be deployed before
that URL is entered as a live store privacy link.

## Storage and network boundary

The reviewed source has no analytics or remote upload endpoint. Playback state,
session IDs, and audio analysis state are held in memory. Custom site origins
(scheme and hostname only) are saved locally in Chrome's persistent content-script
registrations. They are not synced or sent to the native host. Paths, query strings,
fragments and credentials are not saved. Removing a custom website removes its
registration and optional permission and stops its capture. This feature does not
transcribe speech or upload audio. Host installation writes
a native messaging manifest and executable to the user profile, plus a per-user
registry entry on Windows. Phase Pal owns its separate runtime descriptor.

The source does not define what the Phase Pal application stores or sends after
receiving a frame. Consult that application's privacy information separately.
Supported websites and Chrome also have their own data practices. Local source
review does not prove the behavior of a future packaged binary.

Auto Beat Sync is off by default. Its boolean preference is stored in
`chrome.storage.local`, not synced or sent to Phase Pal. The Don't show again
choice is a second local boolean that suppresses site reminders across sites and
restarts. Not now dismisses a reminder only for the current document. Once the user enables
capture for a tab, it can remain active during pauses and same-site track changes.
Stop, Auto Beat Sync opt-out, Dance to Music off, app disconnect, permission loss,
tab close, leaving the site, or stream end stops capture. New captures still need
the user's extension invocation. With Auto Beat Sync saved, opening the popup on
a ready supported tab attempts capture once. Stop and permission failure do not
cause automatic retries. A dismissible reminder is drawn locally on supported
pages when the app is ready and capture is inactive.
