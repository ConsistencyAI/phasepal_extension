# Phase Pal Music Bridge development

Chrome extension and local native host for Phase Pal Dance to Music, maintained
under [Consistency AI](https://github.com/ConsistencyAI/phasepal_extension).

The source repository is public. Chrome Web Store submission is still being
prepared. It is not a Chrome Web Store release or a signed,
packaged Phase Pal installer. A compatible Phase Pal app with the browser bridge
is required; this repository does not include the app.

See the [V1 design](DESIGN.md) for the data path, privacy boundary,
authentication, and lifecycle rules.

## Music site integrations

- Spotify Web
- YouTube Music
- SoundCloud
- Apple Music, Amazon Music (including regional players), Deezer, TIDAL, Qobuz,
  Pandora and Yandex Music.
- QQ Music and KuGou; JioSaavn; LINE MUSIC and Bugs; JOOX; Anghami; Audiomack.

See [the exact site list and verification limits](SUPPORTED_SITES.md).
Users can also add their own websites through **Custom websites** in the popup.
Chrome asks for access to that exact website. See [custom website setup](CUSTOM_SITES.md).
These are implemented integrations; account, region and live playback checks
are still required before a runtime release. Older Phase Pal apps and native
hosts accept only the original three services.

Playback detection is automatic on these sites. Reported playback is treated as
music: this is not a song, podcast, or speech classifier. Beat sync starts only after the
user selects **Enable Beat Sync** in the extension popup. Chrome shows this as a
user-approved tab capture. The extension keeps tab audio audible while it
calculates energy, tempo, beat phase, and section intensity locally.

The bridge never sends song names, artists, URLs, page titles, page content,
browser history, or captured PCM audio to Phase Pal.

See [privacy and permissions](PRIVACY.md), [security reporting](../SECURITY.md),
the [source release review](PUBLIC_RELEASE_REVIEW.md), and the
[current store preparation status](STORE_PREPARATION.md).

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

## Connect to Phase Pal

Updated Phase Pal Windows and macOS builds bundle the native bridge and register
it with Chrome when the app starts. Users install the extension and open Phase
Pal; they do not need Rust, Python, Visual Studio, or terminal commands. This
requires an app build that includes the new integration. Older app builds do not
gain it from an extension update alone.

The app's normal sidecar source and producer are `Tools/phase-browser-music` in
the Phase Pal repository. That source snapshot records this repository's native
host revision. Keep the fixed protocol and extension identity coordinated when
updating either repository. Source integration is not packaged-player QA or store
approval.

## Standalone native host development (older app builds)

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
per-user registration. These commands are developer fallback tools, not steps
for users of an updated packaged app.

Run Phase Pal, enable **Dance to Music** in its settings, and start playback on a
supported site. Open the extension popup to check the connection. Select
**Enable Beat Sync** to capture the active supported tab, then **Stop Beat Sync**
to end capture. Disable the extension to stop automatic playback reporting.

To remove the host registration, run `./scripts/uninstall-native-host-macos.sh`
on macOS, or `powershell -ExecutionPolicy Bypass -File
scripts/uninstall-native-host-windows.ps1` on Windows. Remove the unpacked
extension separately in Chrome.

## Local checks and contributions

### Auto Beat Sync and site reminder

Auto Beat Sync is off by default and saved locally in Chrome. Turn it on in the
popup. Opening the extension with Auto Beat Sync on attempts capture once for the
current ready music tab; if Chrome requires another action, select Enable Beat Sync.
Capture stays active
through pauses and same-site track changes; it does not switch to another tab.
Turning Auto Beat Sync off or pressing Stop ends capture. Turning Dance to Music
off, losing the app connection or site permission, leaving the site, closing the
tab, or ending the stream also stops capture. A new tab or ended stream needs a
new extension invocation or Enable click; the saved option never grants unattended capture permission.

Supported pages show a dismissible “Want to enable Beat Sync?” reminder when the
app is ready and no capture is active. It directs users to the extension's toolbar
popup. Not now dismisses it for that document. Don't show again saves a local
choice that suppresses reminders across sites and restarts. No desktop notification permission is
needed. Capture still includes speech and ads from the selected tab.

For a Chrome Web Store draft, run `npm run package:store` with Python 3 available.
The checked store-upload ZIP, unpacked preview ZIP, checksums, and field drafts are written under
`BuildArtifacts/chrome-web-store/<version>/`. See [the submission checklist](../store/RELEASE_CHECKLIST.md).
The store upload omits the development public key. Confirm the assigned store ID
and coordinate it with the native host before building a release app.

`npm run check` runs the TypeScript tests, type check, and extension build. Use
`cargo test --manifest-path native-host/Cargo.toml --locked` for the native host.
These checks do not verify Chrome capture, website compatibility, or avatar
behavior. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the manual checks required for
a runtime release. No CI setup is required.

## Artifact boundary

- Extension and host source stay in this repository.
- Cargo and Vite intermediate files stay under their normal ignored paths.
- Native release payloads go under `BuildArtifacts/NativeHost/<platform>/`.
- This developer milestone does not stage, sign, or package the host in a Phase
  Pal player release.

Source is available under the [MIT license](../LICENSE). Dependency licenses also
apply when distributing built artifacts. The bunny logo is separate company
artwork; see [NOTICE](../NOTICE) for its use and distribution terms.
