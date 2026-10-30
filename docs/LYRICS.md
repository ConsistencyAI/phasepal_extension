# Optional timed lyrics

Date: 27 October 2026. Source implementation; live Chrome checks remain open.

**Release hold:** This feature is experimental source work. Do not release it
until permission covers commercial lyric display, synchronized highlighting,
and local caching for Phase Pal. API access does not establish those rights.

**Show lyrics** is off by default in Phase Pal. It requires Dance to Music and
browser detection, plus an updated extension, native host, and app. It does not
require Beat Sync capture or a Phase Pal Cloud account.

When the app requests lyrics, content scripts read song metadata and the actual
media element position. They report once per second, and immediately on song,
pause, seek, buffering and speed changes. A random document ID and track ID
identify ownership without exposing a website address. Missing metadata or an
unavailable media timeline produces an unavailable report; timing is not guessed.

The worker forwards song details only for its selected music source. It stops
forwarding and clears retained song details on opt-out, disconnect, or protocol
fallback. Native messages have an exact field allowlist and bounded values.
Song text, PCM audio and website addresses are not added to basic dance frames.

The app uses KuGou over HTTPS. It sends the song title and artist for search,
then a recording hash and lyric access key for lookup/download. Duration is used
locally to reject a different recording. KuGou receives the usual network request
information, including the app's public IP address. The app caches up to 100
successful lyric documents and up to 100 recording offsets locally; it does not
upload them to Phase Pal Cloud or include them in analytics or release files.
Turning lyrics off does not delete this bounded local cache.

The panel uses original word times for color fill and falls back to timed lines.
Pause and buffering freeze the clock. Source loss, song change, and app shutdown
cancel old work. The panel yields to speech and follows avatar visibility.
There is no speech recognition, generated singing, translation, or lip sync.

## Protocol

Transport descriptor and authenticated loopback handshake: version 1.
Browser envelope: versions 1 and 2. Existing v1 frames retain their exact shapes.
V2 status adds only `lyricsRequested`. A v2 `lyrics_playback` frame contains the
usual session/sequence/timestamp envelope plus `provider`, `sourceId`, `trackId`,
`title`, `artist`, `durationMs`, `positionMs`, `playbackRate`, `playing`,
`buffering`, and `available`. IDs are random, never URLs. Song strings are at
most 256 UTF-16 code units; positions are milliseconds. No additional fields are
accepted. Version 1 has no lyric packet.

A rejected v2 hello switches the extension back to v1 dancing. The bundled host
and the extension development host must both support v2. A new host can forward
v1 frames for an old extension, and v1 frames to an old app. A native reconnect
repeats negotiation. Existing installed players need a new build to show lyrics.

## Verification

`npm run check` exercises mocked Chrome APIs and produces the extension bundle.
Native host tests validate v1/v2 shapes and bounds. The app repository contains
managed clock, parser, provider, cache and cancellation checks. These do not prove
site access, permission dialogs, UI layout or real playback synchronization.
