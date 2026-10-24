# Public release review

Review date: 2026-10-18 (America/Chicago).

Result: local source preparation and checks are complete. The repository is still
private. Publishing source and distributing
a working extension/native-host package are separate decisions.

## Scope

Source review covers the extension manifest, playback and capture paths, fixed
protocol, native-host connection, build/install scripts, and public documentation.
Base: `2568de6`, cloned from `https://github.com/ConsistencyAI/phasepal_extension.git`.
The source license is MIT, copyright Consistency AI. This review does not verify
copyright ownership or audit the separate Phase Pal application. No CI was added.

## Findings from documentation and source review

- The README now identifies the company repository, developer setup, fixed
  extension ID, local checks, and source/store release boundary.
- Privacy documentation lists transmitted fields and permission purposes. Supported
  site playback is not a song-versus-speech classifier.
- The manifest public key fixes the development extension ID. It is not a secret.
- The native host uses loopback and a descriptor token. Descriptor creation and
  protection are owned by the separate Phase Pal application.
- SECURITY.md now lists the maintainer-approved private contact,
  `hello@consistencyai.net`. GitHub private reporting was not confirmed: the API
  returned 404 while this repository was private. The email path does not depend
  on that feature.

## Changes made

- Fixed pending audio capture: stop, tab close, and navigation invalidate the
  pending capture. Stale replies and events cannot take over a newer capture.
  Cancelled sessions close their own tracks and audio contexts.
- Kept popup controls busy during pending actions and handled action errors.
- Added extension sender checks and bounded feature-frame validation. Removed
  the unused `storage` permission.
- Made the Windows producer stop on Cargo or metadata-generation failure so it
  cannot stage an old executable after a failed build.
- Updated Vitest to 4.1.12 and the lockfile to remove the reported development
  dependency alerts. Updated the Vite config import for Vitest 4 types.
- Added contribution, security and privacy documents, clearer setup instructions,
  and ignore rules for local environment files and logs. Corrected stale design
  text about music particles and documented the song/speech detection limit.

## Evidence

- `npm ci --ignore-scripts` completed with the updated lockfile.
- `npm run check`: 29 tests passed; TypeScript and Vite production build passed.
  Nine new cases cover capture cancellation, overlapping starts, stale events,
  sender checks and malformed features with fake Chrome/audio APIs.
- `npm audit --json`: zero known vulnerabilities on the checked lockfile.
  The original lockfile had four alerts, including transitive development
  dependencies. This does not prove that the software has no vulnerabilities.
- `cargo test --manifest-path native-host/Cargo.toml --locked`: 12 tests passed in
  the Windows Visual Studio x64 developer environment. No release helper was
  built or installed.
- Windows producer failure checks used fake Cargo/Python commands and a marker
  executable: failed Cargo did not stage the old marker; failed Python returned
  failure. No registry or native-host registration was changed.
- `git diff --check` passed.
- Pattern scan covered both commits and 38 unique Git blobs; no common private
  key, GitHub token, AWS key, API-key or secret-assignment candidates were found.
  No tracked builds or vendored dependency assets were found. This is a limited
  pattern scan, not a guarantee that all confidential information is absent.
- GitHub confirmed company ownership and private visibility. There were zero
  Actions runs and zero releases at review time. Organization member access and
  other organization settings were not audited or changed.
- Tools used: Node.js 22.14.0, Vitest 4.1.12, Vite 7.3.6. npm 11.3.0 could not
  resolve the upgrade; npm 11.6.2 generated the lockfile. Normal `npm ci` then
  succeeded. No global npm installation was changed.

The advisory review included
[Vitest's mocker issue](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) and
[Tinypool's worker-options issue](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).
Rust dependencies were compiled and reviewed at the source/dependency-list level;
`cargo audit` was unavailable, so no Rust advisory scan is claimed.

## Remaining release checks

Custom-site follow-up: users can add and remove exact HTTP(S) websites from the
popup. Access is requested per site using optional permissions; persistent Chrome
script registrations store only origins. The native protocol adds the fixed
`custom_site` ID, with no URL, raw audio or transcript. Tests cover permission
requirements/removal, local persistence, popup controls, unauthorized messages,
capture cancellation, late playback after navigation, and energy/silence states.
All 92 extension tests, TypeScript checks and both production builds passed.
The Windows bridge was rebuilt/staged and passed release staging preflight.
Real Chrome permission prompts, browser restart persistence and live playback
remain open. See [custom website setup](CUSTOM_SITES.md).

Global-provider follow-up: the catalog now contains 18 services and 35 exact
HTTPS hosts. Host permissions and content-script matches derive from that
catalog. Both Rust validators and the Phase Pal receiver accept the same IDs.
New-provider live account/region checks remain open; see SUPPORTED_SITES.md.
The updated extension passed 71 tests, TypeScript checks and both production
builds. The generated manifest has the expected 35 hosts and the classic content
script parses without module imports. The matching bundled Windows native host
passed 13 Rust tests; app receiver and packaging checks are recorded in Phase
Pal's `Docs/ChromeMusicBridgeSidecar.md`.

App integration follow-up: Phase Pal source now includes a native-host snapshot,
sidecar build/staging checks, player copy, and per-user Chrome registration.
Users of a newly built app should not need the standalone host commands. This
does not establish that an already distributed app includes the bridge. Windows
and macOS packaged-player and Chrome checks remain required.

- Maintainer: confirm authority to publish the existing MIT-licensed source and
  review organization access before changing visibility.
- Confirm the approved changes are on the company repository before changing
  visibility.
- For compiled distribution, include applicable complete dependency license texts.
  The current metadata generator produces a dependency inventory, not a complete
  binary license bundle. Signing and store identity still need qualification.
- Native reliability follow-up: `read_bridge_status` discards a partial status
  prefix if a socket read times out. Fragmented responses can cause reconnects.
  This was not changed; test partial-timeout behavior before a runtime release.

The initial source review did not perform Chrome, website, native-host installation,
or Phase Pal runtime verification. The global-provider follow-up inspected the
JioSaavn player UI without login or playback and rebuilt/staged the app's Windows
host. Live playback and Windows/macOS packaged-player manual checks remain
required before a runtime release. Linux support, store submission,
signing, packaged installers, and distribution of the host with Phase Pal are
outside this source-preparation work.

Temporary producer probes remain in ignored
`BuildArtifacts/NativeBuildScriptCheck/`. Automatic approval review blocked their
cleanup with the reason "blocked by policy"; these files are not part of the
public source changes.
