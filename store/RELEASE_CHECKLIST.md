# Submission handoff

Status: prepared for a draft upload, not approved for publication.

## Files and command

Run `npm run package:store` with the supported Node.js version, installed npm
dependencies, and Python 3 available as `python`. On hosts using `python3`, run
`npm run check` then `python3 scripts/package-store.py`.

Upload only `BuildArtifacts/chrome-web-store/0.1.0/phasepal-music-bridge-0.1.0.zip`.
Its manifest is at the ZIP root. Source maps, tests, native executables, credentials,
dependency caches and development scripts are excluded. Source/license notices
and the Vite build-runtime license text are included. The checksum and per-file
hashes are in the adjacent `package-report.json`. The upload ZIP omits the local
development `key`; the unpacked development build retains it.

Listing, privacy and reviewer documents beside the ZIP are copy/paste material;
they are not themselves extension runtime files. Keep all local paths out of the
public listing and review instructions.

## Required before submission for review

1. Confirm the intended company publisher in the supplied developer dashboard.
2. Upload as a draft and record the actual item ID and Package > View public key.
   Do not assume the manifest development key forces a matching store ID. If IDs
   differ, update both native-host source copies, app allowlists/registration,
   sidecar identity, extension development key, scripts, tests, and documentation;
   rebuild the native payload and compatible app. Keep the draft unpublished.
3. Enable GitHub Pages from `main` and `/docs`. Check public homepage, support and privacy URLs from
   a signed-out browser. They must be live and must not require preview access.
4. Review all listing text and data-usage fields against the actual current
   dashboard definitions, then confirm the limited-use certifications.
5. Supply a compatible reviewer-accessible desktop build and finish the access
   section of REVIEWER_INSTRUCTIONS.md. Do not invent a download or account.
6. Capture real Chrome/runtime screenshots: at least one 1280x800 or 640x400 full
   frame. Screenshot capture was skipped at the user's request on November 6;
   no real runtime screenshot is included in the preview release. Promotional
   artwork is not evidence of live playback.
7. Provide a 128x128 store icon and a 440x280 small promotional image. The bunny
   icon is company artwork; retain its NOTICE. Preview all images at store size.
8. Complete Windows installed-app/Chrome playback, pause, stop, navigation, restart,
   permission revocation, and capture checks. Qualify macOS if advertised for it.
9. Select intended distribution and region settings, save the draft, and review
   the dashboard's remaining errors. No publication has been authorized by this
   checklist. The user makes the final release decision from the concrete draft.

## Official references

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/extensions/reference/manifest/key

Do not add CI. Source publication was authorized on November 6, 2026; it does not
authorize Chrome Web Store submission or extension publication.
