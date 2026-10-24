# Custom websites

Custom websites use audio for Dance to Music and Beat Sync. This feature does
not transcribe speech or send spoken words to chat.

## Use a custom website

1. Open the extension popup and expand **Custom websites**.
2. Enter a website address and select **Add website**.
3. Approve Chrome's site access request. Denying it leaves the website disabled.
4. Open that website and play audio or video. Refresh an already open tab if needed.
5. With Phase Pal open and Dance to Music on, open the popup on that tab and select
   **Enable Beat Sync**. Select **Stop Beat Sync** to stop tab audio analysis.
6. Select **Remove** beside a saved website to stop its monitoring, cancel its
   pending or active capture, and remove its optional site access.

The site list is saved locally by Chrome's persistent content-script registrations.
It survives extension service-worker restarts and is not synced or uploaded.
There is a limit of 50 custom websites. HTTP and HTTPS are accepted. An address
without a scheme uses HTTPS. A saved entry covers one exact scheme and hostname;
subdomains require separate entries. Paths, query strings and fragments are
discarded. Credentials, custom ports, wildcard hosts, Chrome internal pages and
the Chrome Web Store are not accepted.

## Audio behavior and limits

Adding a website permits automatic observation of audio/video playback there.
That playback is treated as music, including podcasts, speech, videos, and ads.
Optional Beat Sync still requires a separate popup action for the active tab.
While custom-site capture is active, playback uses captured audio energy with a
short silence hold. This also covers tab audio whose player cannot be queried
from the main document. Silence does not count as playing audio. Beat confidence
can stay low when the audio has no clear rhythm.

Chrome can block capture of protected content and restricted pages. Region,
subscription and login requirements still apply. No microphone access is used.
No site-specific compatibility or protected-audio bypass is promised.

## Permission and protocol boundary

The manifest declares HTTP(S) hosts as **optional**. The popup requests one exact
site from its Add website action, then registers one top-frame content script.
The extension does not request all-site access when adding a website. Chrome
permission removal is also handled, and unauthorized content messages are rejected.
See [Chrome's optional permission API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
and [dynamic content-script API](https://developer.chrome.com/docs/extensions/reference/api/scripting).

Saved origins stay inside the extension. The native bridge and Phase Pal receive
only the fixed `custom_site` provider ID, booleans, timing, and rhythm values.
They receive no custom URL, song text, raw audio, or transcript. An updated
Phase Pal app and native host must accept that provider ID. The 18 built-in
services remain a separate fixed list.

## Verification

Managed browser-API tests cover exact-site permission requirements, persistent
registration, permission rejection/removal, popup add/remove controls, unauthorized
messages, capture cancellation, video playback without metadata, energy-based
capture playback and silence, and exclusion of site addresses from native frames.
These tests use fake Chrome/audio APIs. Real Chrome permission prompts, browser
restart persistence and protected-audio behavior still need manual checks on
Windows and macOS. No Unity player was built for this change.
