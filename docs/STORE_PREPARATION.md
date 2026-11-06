# Chrome Web Store preparation

Updated November 6, 2026.

The user authorized public source, GitHub Pages and a GitHub preview release for
[ConsistencyAI/phasepal_extension](https://github.com/ConsistencyAI/phasepal_extension).
This does not authorize Chrome Web Store review submission or publication. The
source is MIT licensed; the company icon has separate terms in [NOTICE](../NOTICE).
No CI workflow is configured. The user's main-branch ruleset is left unchanged.

## Candidate and checks

The preview uses extension version `0.1.0` and the committed runtime source from
`58f3d3afebeb9ad875609002a6b847e8aa4173a0`, plus documentation and packaging updates.
Uncommitted song-recognition changes in the separate development checkout remain
excluded. Playback state, optional local Beat Sync, saved Auto Beat Sync, site
reminders and custom websites are included. Song recognition is not advertised.

`npm run package:store` runs the extension tests, TypeScript checks and both Vite
production builds. On November 6, 2026, 116 tests passed on Windows with Node.js
22.14.0. These are local automated checks, not live Chrome or packaged-player QA.
No native source changed in this preparation and no new native binary is supplied.

## Preview release files

Generated files live under `BuildArtifacts/chrome-web-store/0.1.0/`:

- `phasepal-music-bridge-preview-0.1.0.zip`: extract and Load unpacked for developer
  use; retains the public development key and ID.
- `phasepal-music-bridge-0.1.0.zip`: draft Chrome Web Store upload, with the
  development key omitted. Do not use this ZIP to assume native-host identity.
- `SHA256SUMS.txt`: SHA-256 checksums for both ZIPs.
- `package-report.json`: store file hashes, preview checksum and identity status.

Both ZIPs have `manifest.json` at the root and include runtime files, LICENSE,
NOTICE and build-runtime dependency license text. Neither includes the native
host, app installer, recordings, source maps, tests, caches or credentials.

## Store fields and hosting

- [Listing](../store/LISTING.md)
- [Privacy fields](../store/PRIVACY_FIELDS.md)
- [Reviewer instructions](../store/REVIEWER_INSTRUCTIONS.md)
- [Submission checklist](../store/RELEASE_CHECKLIST.md)
- [GitHub Pages setup](GITHUB_PAGES.md)

The replacement addresses are:

- Setup: https://consistencyai.github.io/phasepal_extension/
- Support: https://consistencyai.github.io/phasepal_extension/#support
- Privacy: https://consistencyai.github.io/phasepal_extension/privacy/

Verify the deployed content before entering these as live dashboard links. The
old `www.phasepal.com/browser-extension` proposal has been replaced by this site.

## Remaining submission requirements

The store upload omits the development key. Record the ID and public key Google
assigns to the first draft. The current native host allows development ID
`liinajbmlphpehjkmjdffpjhajdpgfpm`. If the store ID differs, coordinate extension
configuration, both native-host source copies and Phase Pal registration before
building the review app. Do not claim an old binary supports a new identity.

Supply a compatible reviewer-accessible Phase Pal build and verify Windows and
macOS if both are advertised. Finish live Chrome capture, audible playback,
pause/stop/navigation/restart and permission-revocation checks. Local tests do
not establish browser or packaged-player compatibility.

The user chose to skip real screenshot capture during this task. At least one
authentic 1280x800 or 640x400 screenshot remains required for the store. No real
runtime screenshot or invented live connection is supplied with this release.
The 128x128 icon is in `public/icons/icon-128.png`; `store/render-promo.mjs`
produces the 440x280 small promo and 1400x560 marquee tile. Neither is runtime
evidence or a replacement for a real screenshot.

Finally review dashboard data-use definitions, certifications and distribution
settings. No Chrome Web Store item was created or submitted in this preparation.
