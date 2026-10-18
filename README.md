# Phase Pal Music Bridge

Chrome extension and local native host for Phase Pal Dance to Music, maintained
under [Consistency AI](https://github.com/ConsistencyAI/phasepal_extension).

This is a developer source release. It is not a Chrome Web Store release or a
signed, packaged Phase Pal installer. A compatible Phase Pal app with the browser
bridge is required; this repository does not include the app.

See the [V1 design](docs/DESIGN.md) for the data path, privacy boundary,
authentication, and lifecycle rules.

## Supported sites

- Spotify Web
- YouTube Music
- SoundCloud

Playback detection is automatic on these sites. Reported playback is treated as
music: this is not a song, podcast, or speech classifier. Beat sync starts only after the
user selects **Enable Beat Sync** in the extension popup. Chrome shows this as a
user-approved tab capture. The extension keeps tab audio audible while it
calculates energy, tempo, beat phase, and section intensity locally.

The bridge never sends song names, artists, URLs, page titles, page content,
browser history, or captured PCM audio to Phase Pal.

See [privacy and permissions](docs/PRIVACY.md), [security reporting](SECURITY.md),
and the [public release review](docs/PUBLIC_RELEASE_REVIEW.md).

## Extension development

Requirements: Chrome 116 or newer, Node.js 22.12+ on the 22.x line or Node.js 24+,
and npm. The native host
targets Windows and macOS. Linux and other browsers are not supported by the
current install workflow.

```bash
npm ci
npm run check
```

Load `dist/` as an unpacked extension from `chrome://extensions` after running
`npm run build`. Enable Developer mode and select **Load unpacked**. Check that
the extension ID is `liinajbmlphpehjkmjdffpjhajdpgfpm`; the native-host registration
allows only that ID. The public `key` in the manifest fixes this development ID;
it is not a private signing key or credential.

## Native host development

Requirements: Rust 1.85 or newer (edition 2024) with Cargo, Python 3, and the platform
linker/build tools. On macOS, install the Xcode command line tools. On Windows,
use the Visual Studio C++ x64 developer environment. Build the Rust host and its
release metadata from the repository root:

```bash
./scripts/build-native-host-macos.sh
./scripts/install-native-host-macos.sh
```

On Windows, use an x64 Developer PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-native-host-windows.ps1
powershell -ExecutionPolicy Bypass -File scripts/install-native-host-windows.ps1
```

The install scripts register only `app.phasepal.music` for extension ID
`liinajbmlphpehjkmjdffpjhajdpgfpm`. Uninstall scripts remove only that exact
per-user registration.

Run Phase Pal, enable **Dance to Music** in its settings, and start playback on a
supported site. Open the extension popup to check the connection. Select
**Enable Beat Sync** to capture the active supported tab, then **Stop Beat Sync**
to end capture. Disable the extension to stop automatic playback reporting.

To remove the host registration, run `./scripts/uninstall-native-host-macos.sh`
on macOS, or `powershell -ExecutionPolicy Bypass -File
scripts/uninstall-native-host-windows.ps1` on Windows. Remove the unpacked
extension separately in Chrome.

## Local checks and contributions

`npm run check` runs the TypeScript tests, type check, and extension build. Use
`cargo test --manifest-path native-host/Cargo.toml --locked` for the native host.
These checks do not verify Chrome capture, website compatibility, or avatar
behavior. See [CONTRIBUTING.md](CONTRIBUTING.md) for the manual checks required for
a runtime release. No CI setup is required.

## Artifact boundary

- Extension and host source stay in this repository.
- Cargo and Vite intermediate files stay under their normal ignored paths.
- Native release payloads go under `BuildArtifacts/NativeHost/<platform>/`.
- This developer milestone does not stage, sign, or package the host in a Phase
  Pal player release.

Source is available under the [MIT license](LICENSE). Dependency licenses also
apply when distributing built artifacts.
