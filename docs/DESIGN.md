# Phase Pal Browser Music Bridge V1 Design

## Data path

1. A content script detects playback on Spotify Web, YouTube Music, or SoundCloud.
2. The extension sends only playback booleans and a fixed provider ID.
3. One popup click grants tab capture for that tab.
4. An offscreen document keeps the captured tab audible and runs an AudioWorklet.
5. The TypeScript analyzer publishes compact feature frames at 10 Hz.
6. `phasepal-browser-host` validates each native message and forwards it to the
   authenticated Phase Pal loopback listener.
7. Phase Pal maps the frame to `MusicReactiveSnapshot` and drives dance, particle,
   tempo, and beat-phase behavior through the normal avatar stack.

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

## V1 limits

V1 supports Chrome 116 or newer on Windows and macOS. Native-host installation is
developer-managed. Signing, store release, packaged installers, normal YouTube,
selected-text speech, and browser control are outside this milestone.
