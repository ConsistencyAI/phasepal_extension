# Phase Pal Browser Music Bridge V1 Design

## Data path

1. A content script detects playback on the exact music-player hosts in
   [SUPPORTED_SITES.md](SUPPORTED_SITES.md), or user-approved custom websites
   described in [CUSTOM_SITES.md](CUSTOM_SITES.md).
2. The extension sends playback and metadata-presence booleans with a fixed
   provider ID, protocol fields, and timing fields.
3. One popup click grants tab capture for that tab.
4. An offscreen document keeps the captured tab audible and runs an AudioWorklet.
5. The TypeScript analyzer publishes compact feature frames at 10 Hz.
6. `phasepal-browser-host` validates each native message and forwards it to the
   authenticated Phase Pal loopback listener.
7. A compatible Phase Pal app maps the frame to `MusicReactiveSnapshot` and
   drives dance, tempo, and beat-phase behavior through the avatar stack.

## Privacy boundary

The page converts metadata to `hasTitle` and `hasArtist` before it sends a
message. The extension and host reject fields outside the fixed protocol shape.
They do not send or store titles, artists, URLs, page titles, page text, browser
history, or PCM audio.

## Trust boundary

- Chrome can start capture only from the popup user action.
- The native host accepts messages only from the stable development extension ID.
- Phase Pal listens only on `127.0.0.1` and uses an operating-system-selected port.
- Each Phase Pal run creates a new 256-bit token in an owner-only descriptor.
- The native host validates protocol version, enums, finite ranges, sequence order,
  8 KB size, and 30-message-per-second rate.
- A second live native host receives the fixed `busy` status.

## Lifecycle

The content script sends a two-second playback heartbeat. Phase Pal expires a
source after five seconds without one. Tab close, unsupported navigation, stream
failure, user stop, Chrome stdin close, app stop, and app dispose all close their
owned streams and tasks. The native host uses bounded reconnect backoff and
replays the last sanitized `hello` after Phase Pal restarts.

Auto Beat Sync is a local saved boolean, off by default. It preserves one
user-approved tab stream through pauses and same-origin navigation. It does not
request a new stream or move capture to another tab. App unavailability or Dance
to Music off cancels pending and active capture. New captures are rejected unless
the app reports ready. Manual Stop, opt-out, unsupported navigation, lost optional
permission, tab close, or stream end also end capture. A document-local dismissible
reminder points users to the toolbar popup; it cannot grant capture authority.
The popup attempts saved Auto Beat Sync once when opened on a ready supported tab.
An existing stream shows Stop; failed requests and manual Stop do not retry during
that popup session. Reminders hide when capture starts, including pending setup.
Don't show again saves a second local boolean; Not now remains document-local.

## V1 limits

Playback on a supported site is treated as music. This path does not reliably
separate songs, podcasts, speech, or advertisements. Beat estimates and section
intensity values are audio features, not verified musical-section recognition.

V1 supports Chrome 116 or newer on Windows and macOS. Native-host installation is
developer-managed. Signing, store release, packaged installers,
selected-text speech, and browser control are outside this milestone.
