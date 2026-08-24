# Phase Pal Music Bridge

Developer-ready Chrome extension for Phase Pal Dance to Music.

See the [V1 design](docs/DESIGN.md) for the data path, privacy boundary,
authentication, and lifecycle rules.

## Supported sites

- Spotify Web
- YouTube Music
- SoundCloud

Playback detection is automatic on these sites. Beat sync starts only after the
user selects **Enable Beat Sync** in the extension popup. Chrome shows this as a
user-approved tab capture. The extension keeps tab audio audible while it
calculates energy, tempo, beat phase, and section intensity locally.

The bridge never sends song names, artists, URLs, page titles, page content,
browser history, or captured PCM audio to Phase Pal.

## Extension development

Requirements: Chrome 116 or newer and a current Node.js release.

```bash
npm install
npm run check
```

Load `dist/` as an unpacked extension from `chrome://extensions` after running
`npm run build`.

## Native host development

Build the Rust host and its release metadata:

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

## Artifact boundary

- Extension and host source stay in this repository.
- Cargo and Vite intermediate files stay under their normal ignored paths.
- Native release payloads go under `BuildArtifacts/NativeHost/<platform>/`.
- This developer milestone does not stage, sign, or package the host in a Phase
  Pal player release.
