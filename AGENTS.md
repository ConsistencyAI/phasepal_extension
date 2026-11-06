# Phase Pal Music Bridge agent guidance

## Scope and release state

- Keep the GitHub repository private until the user explicitly asks to publish it.
- Source publication, Chrome Web Store review, and extension publication are
  separate actions. Preparing a package does not authorize any of them.
- Do not add CI workflows unless the user explicitly requests them.
- Check `git status --short` before edits and preserve unrelated work.
- Read the current code and relevant documents before changing behavior.

## Project map

- `src/`: TypeScript extension, popup, content script, and local audio analysis.
- `public/manifest.json`: development manifest and public development identity.
- `config/extension-id.json`: coordinated extension and native-host identity.
- `native-host/`: Rust native messaging host; a separate copy is bundled by Phase
  Pal from `Tools/phase-browser-music` in its application repository.
- `store/`: listing, permissions, reviewer instructions, and packaging checklist.
- `docs/PRIVACY.md`: extension data boundary; update it for data-use changes.
- `docs/STORE_PREPARATION.md`: dated candidate and remaining submission requirements.

## Checks and packaging

Use the supported Node.js version from `package.json` and the committed lockfile.
Run `npm run check` for extension behavior changes. Run `npm run package:store`
to test, build, and produce the draft upload ZIP. Keep generated output under
the ignored `BuildArtifacts/` directory. For native-host changes, run its focused
Rust tests in the required platform toolchain; do not rebuild unrelated helpers.

Verify the assigned store extension ID before distributing the native host.
Coordinate identity changes with both host source copies and Phase Pal's
registration. Do not make old binaries appear compatible by changing reports.

## Privacy and licenses

- Preserve user-approved capture, cancellation, fixed message fields, and local
  processing. Playback on a supported site is not proof of music classification.
- Do not add raw audio, arbitrary metadata, URLs, credentials, or page content to
  native messages, persistent storage, or logs. Keep approved custom site origins
  inside Chrome's local settings and script registrations.
- New permissions, network services, telemetry, and reference media need an
  explicit purpose and privacy/license review. Do not add paid API calls.
- Do not commit captured audio, builds, caches, personal settings, or secrets.
  The manifest's public development key is not a private signing credential.
- Keep LICENSE and NOTICE. Company artwork has separate terms from the MIT code.
- Report local tests, live Chrome checks, and packaged-player checks separately.
  Do not claim runtime, store, or public-URL verification that was not performed.
