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

The draft's assigned ID is `depmepnaojmbbjgogihalfgeajkfkbjj`. On November 6,
its public key was read from the developer dashboard screenshot and verified to
hash to that exact ID. The development manifest now uses that key. The store ZIP
still omits the key. Fallback installers, metadata and Phase Pal registration
must use the same ID. The former development ID was
`liinajbmlphpehjkmjdffpjhajdpgfpm`; old installed binaries and registrations do
not become compatible from a documentation update.

Identity coordination checks on November 6: 116 extension tests and both
production builds passed; the packager rejects a key/config mismatch before
writing a ZIP. The standalone native host passed 13 Rust tests. The Windows
app's bundled host passed 16 unit tests, one session-lifetime test and five
package checks, then was rebuilt and staged through its normal producer with
current provenance. The app registration/lifecycle harness passed 334 checks,
including migration from an owned old-ID registration to the store ID while
preserving foreign registrations. The migration test failed before the fix.

The Phase Pal app source and Windows staging changes are local in its separate
checkout. No Unity player was rebuilt or run, no live Chrome connection was
verified, and macOS was not rebuilt. The app must be built from these coordinated
sources before claiming installed-player support for the store ID. The old
GitHub preview remains a historical artifact; use the identity-aligned preview.

Compared with the first preview's store ZIP, all extension runtime files and
the store manifest are byte-identical; only NOTICE gained promotional-artwork
terms. Changing the unpacked development key does not itself require a new
Chrome Web Store upload.

The maintainer selected Windows for reviewer instructions. Use the normal app
installation route; a separate reviewer-only installer is not a store requirement.
Verify the Windows app/host combination, and macOS if advertised. Finish live Chrome capture, audible playback,
pause/stop/navigation/restart and permission-revocation checks. Local tests do
not establish browser or packaged-player compatibility.

The user chose to skip real screenshot capture during this task. At least one
authentic 1280x800 or 640x400 screenshot remains required for the store. No real
runtime screenshot or invented live connection is supplied with this release.
The 128x128 icon is in `public/icons/icon-128.png`; `store/render-promo.mjs`
produces the 440x280 small promo and 1400x560 marquee tile. Neither is runtime
evidence or a replacement for a real screenshot.

Finally review dashboard data-use definitions, certifications and distribution
settings. The user has created a draft Chrome Web Store item with version 0.1.0;
the provided screenshot shows Draft, not a submitted or published item.
