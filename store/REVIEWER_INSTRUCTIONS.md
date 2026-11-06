# Reviewer instructions draft

This extension depends on a separate Phase Pal desktop application and its bundled
native messaging host. It does not require a paid music account to use a custom
site with freely playable audio. The extension feature itself does not ask for a
Phase Pal account. The chosen desktop build may have separate distribution access
requirements, which must be disclosed before review.

## Windows review setup

Use Google Chrome 116 or newer on Windows and the normal Phase Pal Windows
installation route. A separate reviewer-only installer is not required. Add
access instructions only if that route has restrictions. Do not send personal
credentials or claim an app version includes the bridge without checking it.

The assigned Chrome Web Store item ID is
`depmepnaojmbbjgogihalfgeajkfkbjj`. Its public key was verified to derive this ID.
The unpacked extension and current host configuration use the same ID. Older
installed Phase Pal builds may still allow the former development ID and need
an updated app/host registration. Source changes do not update an old player.

## Test steps with a compatible Windows app

1. Install Phase Pal for Windows through its normal installation route and start it. Enable Dance to Music.
   The app registers its bundled local bridge. No Rust, Python, Visual Studio,
   or terminal host installation is required for users of that build.
2. Install the draft extension through the review environment. Open its popup and
   confirm the app connection. A missing app produces an unavailable status.
3. Start playback on a built-in music site available to the reviewer, or use a
   permitted HTTP(S) test site with freely playable audio/video.
4. For a custom test site, expand Custom websites, enter its address, select Add
   website, grant the exact site, and refresh the tab if needed. Approving access
   enables playback observation; it does not itself start audio capture.
5. Open the popup on that tab and select Enable Beat Sync. Check Chrome's capture
   indicator, audible tab output, and updating BPM/beat-confidence values. Exact
   estimates depend on the audio. Speech may trigger playback without a steady beat.
6. Select Stop Beat Sync and confirm capture ends. Restart capture and verify that
   closing/navigating the tab or removing the custom site's access stops it.
7. Stop/restart the app, refresh the music tab, and verify recovery. App connection,
   privacy and setup help are linked from the public support page.

Public support: https://consistencyai.github.io/phasepal_extension/#support
Extension privacy: https://consistencyai.github.io/phasepal_extension/privacy/
Contact: hello@consistencyai.net

No live Chrome, subscription/region-wide compatibility, installed-player, macOS
signing, or reviewer credential verification is implied by the local test suite.
