# Privacy practices draft

## Single purpose

Connect browser playback and user-approved tab rhythm analysis to Dance to Music
in a compatible local Phase Pal desktop app.

## Permission justifications

### nativeMessaging

Exchange fixed playback flags and optional numeric rhythm features with the
installed Phase Pal native host, which forwards them to the authenticated local
desktop app. The app is required for the extension's single purpose. Optional
version 2 lyric reports, off by default in Phase Pal, also send title, artist,
duration, position, speed, playback flags, and random source/track IDs only while
the app requests them. The app sends title and artist to KuGou for timed lyrics
and caches successful results locally. No URLs, unrelated page text, raw audio or
transcripts are sent through this protocol. See docs/LYRICS.md.

### tabCapture

After the user selects Enable Beat Sync for the active tab, obtain that tab's
audio stream for local energy, tempo and beat analysis. Stop Beat Sync, tab close,
leaving the site, stream end, or access removal stops the capture. Disabling Dance
to Music, losing the app connection, or opting out of Auto Beat Sync also stops it.
With saved Auto Beat Sync enabled, pauses and same-site track changes preserve the
user-approved stream. New streams still require a user action. No microphone access
or remote audio upload is used.

### offscreen

Run the user-approved audio stream and AudioWorklet outside the short-lived popup,
keep the tab audible, and publish numeric rhythm features while capture is active.
The document is packaged with the extension and loads no remote executable code.

### storage

Save the Auto Beat Sync and Don't show again booleans in Chrome local storage.
They are not synced or sent to the app. Auto Beat Sync is off by default. Not now
uses document-local memory; Don't show again suppresses reminders across sites and
browser restarts. Opening the extension with Auto Beat Sync saved attempts capture
once on a ready supported tab. Failure or Stop does not trigger repeated retries.

### scripting

Register and inject the packaged playback monitor on custom websites added by the
user after Chrome grants optional access to that exact site. Persistent script
registrations also store the local site list. Removal unregisters the monitor.

### Built-in host permissions

Read media playing/paused state and metadata-presence booleans on the 35 named
HTTPS music-player hosts. This provides automatic playback reporting to the local
app without requiring audio capture. Host access also lets the popup identify the
active supported player. Default detection sends fixed provider IDs and booleans.
When the app requests lyrics, it also receives the song details listed above.
Account credentials and unrelated page text do not leave through this protocol.

### Optional HTTP(S) host permissions

Let a user add a music/audio website that is not in the built-in list. The broad
optional manifest patterns allow future sites to be requested at runtime; the
Add website action requests one exact scheme and hostname, not all-site access.
Paths, query strings, fragments and credentials are not saved. A separate popup
action is still required to capture tab audio for Beat Sync.

## Remote code

No, the extension does not execute remotely hosted code. The service worker,
content scripts, offscreen document and AudioWorklet are bundled in the ZIP.
The companion native host is installed with the separate desktop app; it is not
downloaded or executed as extension JavaScript.

## Data usage: review the live field definitions before certifying

Do not equate local processing with no data access. The extension accesses:

- Website content: selected-tab audio, media playback, metadata presence, and optional song details.
- Browsing-related information: active tab addresses for provider recognition and
  user-entered custom origins saved locally. It does not read the history database.
- User activity: media play/pause and the user's capture controls.

There is no extension analytics endpoint or off-device upload path. Only the
disclosed playback, numeric features, and optional lyric fields go to the local
desktop app. The app separately contacts KuGou when lyrics are enabled.
No personal contact, health, payment, financial, precise-location, authentication,
or private message data is requested by the extension feature. A random local
service-session ID is not an advertising identifier.

Choose the current dashboard categories that cover these accesses under its
definitions (typically Website content, Web history/URL activity, and User activity
if local access is included). Verify those definitions in the actual form; this
draft does not silently certify unchecked categories or assert a publisher's
legal compliance on their behalf.

Limited-use statements to confirm against the final uploaded version:

- User data is not sold or transferred for unrelated purposes.
- User data is not used for purposes unrelated to the extension's single purpose.
- User data is not used for creditworthiness or lending decisions.

Policy URL after deployment:
https://www.phasepal.com/browser-extension/privacy

Sources:
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/limited-use
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
