# Phase Pal Music Bridge

[English](README.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Español](README.es.md) · [日本語](README.ja.md)

Connect browser playback to **Dance to Music** in Phase Pal, with optional beat
analysis performed on your device. Maintained by Consistency AI.

Install [Phase Pal Music Bridge from the Chrome Web Store](https://chromewebstore.google.com/detail/phase-pal-music-bridge/depmepnaojmbbjgogihalfgeajkfkbjj). A compatible Phase Pal desktop build with the browser bridge is required.

## Setup and privacy

- [Setup guide](https://consistencyai.github.io/phasepal_extension/)
- [Privacy policy](https://consistencyai.github.io/phasepal_extension/privacy/)
- [Technical privacy and permissions](docs/PRIVACY.md)
- [Development and native-host setup](docs/DEVELOPMENT.md)

## What it does

Reports playing/paused state on Spotify Web, YouTube Music, SoundCloud, Apple
Music, Amazon Music regional players, Deezer, TIDAL, Qobuz, Pandora, Yandex Music,
QQ Music, KuGou, JioSaavn, LINE MUSIC, Bugs, JOOX, Anghami, and Audiomack.
See the [exact hosts and verification limits](docs/SUPPORTED_SITES.md). You can
also add an exact website through **Custom websites**, after Chrome grants
access to that site; see [custom site setup](docs/CUSTOM_SITES.md).

Supported-site playback is treated as music. Speech, podcasts and ads can also
trigger dancing; this is not a song or speech classifier. Account, subscription,
region, protected-content and player restrictions still apply. These integrations
need live playback checks before a runtime release.

## Use the extension

1. Use Chrome 116 or newer on Windows or macOS and a compatible Phase Pal build
   that bundles and registers the browser bridge. Linux and other browsers are
   outside the current install workflow. Older apps do not gain the bridge from
   an extension update alone.
2. Open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/phase-pal-music-bridge/depmepnaojmbbjgogihalfgeajkfkbjj) and select **Add to Chrome**.
3. Open Phase Pal and turn on **Dance to Music**. Start playback on a supported
   or approved custom site, then open the extension popup to check the connection.
4. Select **Enable Beat Sync** to analyze that tab's audio locally. Chrome shows
   the capture indicator; the tab remains audible. Select **Stop Beat Sync** to end it.

**Auto Beat Sync** is off by default and saved only on this device. With it on,
opening the popup on a ready music tab attempts capture once. An approved stream
can continue through pauses and same-site track changes. A new tab or ended
stream needs another extension invocation or Enable click; the setting never
grants unattended capture. Stop, opting out, Dance to Music off, app disconnect,
permission loss, leaving the site, tab close or stream end stops capture.

A dismissible site reminder points to the toolbar popup. **Not now** lasts for
the current document; **Don't show again** saves a local preference across
sites and restarts. Disable or remove the extension to stop playback reporting.

## Data stays local

Tab audio, including speech and ads, is analyzed in extension memory without
microphone access, recording, transcription, analytics or remote upload. Only
fixed playback/provider flags, metadata-presence booleans, session/protocol
fields and numeric rhythm values go to the local Phase Pal app. Song names,
artist names, URLs, page text, browser history and raw audio are not sent to it.
Custom origins and the two preferences stay in Chrome locally. Phase Pal, Chrome
and music services have separate privacy practices; see [the full boundary](docs/PRIVACY.md).

## Build and check

Use Node.js 22.12+ on the 22.x line or Node.js 24+, npm, and the committed lockfile:

```bash
npm ci
npm run check
```

Load the resulting `dist/` directory as an unpacked extension. The development
ID must be `depmepnaojmbbjgogihalfgeajkfkbjj`, matching native host
`app.phasepal.music`. The manifest's public key fixes this ID; it is not a
private credential.

See [development and native-host commands](docs/DEVELOPMENT.md),
[V1 design](docs/DESIGN.md), and [contributing](CONTRIBUTING.md). Ordinary users
of a compatible packaged app do not need Rust, Python or manual host installation.
Host development needs Rust 1.85+, Python 3 and platform build tools.

```bash
cargo test --manifest-path native-host/Cargo.toml --locked
npm run package:store
```

Packaging requires Python 3 and writes both ZIPs and their checksums under
`BuildArtifacts/chrome-web-store/0.1.0/`. The preview ZIP keeps the development
key. The store upload omits it; verify Google's assigned store ID and coordinate
both native-host copies and app registration before distributing an app for that
ID. No native binary is included. Local tests do not verify live Chrome capture
or a packaged player. No CI is configured.

## Release and support

Download extension ZIPs and checksums from
[GitHub Releases](https://github.com/ConsistencyAI/phasepal_extension/releases).
Keep builds, audio, caches, settings and secrets out of Git.

Contact [hello@consistencyai.net](mailto:hello@consistencyai.net).
See [security reporting](SECURITY.md) and [conduct](CODE_OF_CONDUCT.md).
Source and documents use the [MIT license](LICENSE); dependency licenses apply
to builds. The bunny artwork has separate terms in [NOTICE](NOTICE).
