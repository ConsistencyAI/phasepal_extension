# Chrome Web Store preparation

Updated November 6, 2026.

Phase Pal Music Bridge is prepared in the private company repository
[ConsistencyAI/phasepal_extension](https://github.com/ConsistencyAI/phasepal_extension).
The source is MIT licensed; the company icon has the separate artwork terms in
[NOTICE](../NOTICE). The repository includes contribution, conduct, security, and
privacy documents. No CI workflow is configured.

## Upload candidate

The candidate uses the committed extension source at
`58f3d3afebeb9ad875609002a6b847e8aa4173a0`, with manifest version `0.1.0`.
Uncommitted song-recognition changes in the development checkout are excluded.
The candidate supports playback state, optional local Beat Sync, saved Auto Beat
Sync, site reminders, and custom websites. Its listing and privacy drafts do not
advertise song recognition.

Run `npm run package:store` from this checkout to test, build, and package it.
The ZIP has `manifest.json` at its root and includes the required runtime files
and license notices. The companion native executable is not part of the upload.
Keep the generated package report with the ZIP for its checksum and file hashes.

The candidate passed 116 extension tests, TypeScript checking, and both Vite
production builds on November 6, 2026, using Node.js 22.14.0 on Windows. These
are local automated checks, not installed-app or live Chrome playback checks.

## Store fields and images

- [Listing text](../store/LISTING.md): name, descriptions, language, category,
  homepage, support, and contact.
- [Privacy fields](../store/PRIVACY_FIELDS.md): single purpose, the five API
  permissions, site permissions, remote-code declaration, and data-use review.
- [Reviewer instructions](../store/REVIEWER_INSTRUCTIONS.md): app requirements,
  test steps, and the access details that still need a compatible app build.
- [Release checklist](../store/RELEASE_CHECKLIST.md): upload and review sequence.
- The 128-pixel company icon is in `public/icons/icon-128.png`. The small promo
  renderer is `store/render-promo.mjs`; it creates a 440 by 280 PNG.

At least one real extension screenshot is still needed. Capture the installed
popup and its app connection in a 1280 by 800 or 640 by 400 frame. Do not use a
mock connection or invented BPM values as evidence of live playback. Real
playback and screenshot capture have not been verified for this candidate.

## Remaining submission requirements

The following planned URLs returned HTTP 404 on November 6, 2026:

- Homepage: `https://www.phasepal.com/browser-extension`
- Support: `https://www.phasepal.com/browser-extension#support`
- Privacy: `https://www.phasepal.com/browser-extension/privacy`

Deploy and check those pages before entering them as live store links. The
private GitHub repository is not a public privacy-policy or installation URL.
Publishing a public privacy page does not require publishing the source repository.

The upload omits the development public key. Record the item ID and public key
that Google assigns to the first draft. The development extension ID is
`liinajbmlphpehjkmjdffpjhajdpgfpm`; the native host currently allows that ID.
If the store ID differs, coordinate the extension configuration, both native-host
source copies, and Phase Pal's host registration before building the review app.
Do not claim the existing native binary supports an unverified store identity.

Supply a compatible reviewer-accessible Phase Pal installer, verify the supported
platforms in Chrome, provide the real screenshot, then review the data-use
certifications and distribution choices. These remain release requirements;
local tests do not replace them.

## Current publication state

The GitHub repository remains private. No Chrome Web Store item was created or
submitted during this preparation. The upload and final dashboard setup remain
manual until browser use is requested again. Do not publish the repository or
the extension from these preparation steps alone.
