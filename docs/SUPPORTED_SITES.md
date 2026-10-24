# Music site integrations

Updated: 2026-10-18. The extension recognizes 18 services on 35 exact HTTPS hosts.
This is the implemented site list, not a claim that every account, country,
subscription, or player version has passed live testing.
Users can also [add a custom website](CUSTOM_SITES.md) with optional site access.
Custom websites use the fixed `custom_site` ID and do not change this built-in list.

| Service | Exact hosts | Official player or reference |
| --- | --- | --- |
| Spotify Web | `open.spotify.com` | [Player](https://open.spotify.com/) |
| YouTube Music | `music.youtube.com` | [Player](https://music.youtube.com/) |
| SoundCloud | `soundcloud.com`, `www.soundcloud.com` | [Player](https://soundcloud.com/) |
| Apple Music | `music.apple.com` | [Player](https://music.apple.com/) |
| Amazon Music | See regional hosts below | [Player](https://music.amazon.com/) |
| Deezer | `www.deezer.com`, `deezer.com` | [Service and music catalog](https://www.deezer.com/) |
| TIDAL | `listen.tidal.com` | [Official web-player help](https://support.tidal.com/hc/en-us/sections/115001636665-Web-Player) |
| Qobuz | `play.qobuz.com` | [Official app/web-player help](https://help.qobuz.com/en/articles/10153-qobuz-apps) |
| Pandora | `www.pandora.com`, `pandora.com` | [Official browser requirements](https://help.pandora.com/s/article/Minimum-Specifications-to-Run-Pandora-1519949299360?language=en_US) |
| Yandex Music | `music.yandex.com`, `music.yandex.ru` | [Service](https://music.yandex.com/) |
| QQ Music | `y.qq.com` | [Official web player](https://y.qq.com/portal/player.html) |
| KuGou | `www.kugou.com` | [Official song player](https://www.kugou.com/song/) |
| JioSaavn | `www.jiosaavn.com` | [Official web player](https://www.jiosaavn.com/) |
| LINE MUSIC | `music.line.me` | [Official browser help](https://help.line.me/LINEMusic/web/categoryId/200000224/3/pc?lang=en) |
| Bugs | `music.bugs.co.kr` | [Official site and web-player entry](https://music.bugs.co.kr/) |
| JOOX | `www.joox.com`, `joox.com` | [Official service](https://www.joox.com/intl) |
| Anghami | `play.anghami.com` | [Official player](https://play.anghami.com/) |
| Audiomack | `audiomack.com`, `www.audiomack.com` | [Official website-listening description](https://audiomack.com/about) |

Amazon regional hosts are `music.amazon.com`, `music.amazon.co.uk`,
`music.amazon.de`, `music.amazon.fr`, `music.amazon.it`, `music.amazon.es`,
`music.amazon.co.jp`, `music.amazon.in`, `music.amazon.com.au`,
`music.amazon.com.br`, `music.amazon.ca`, and `music.amazon.com.mx`.

The selection includes music services used in China, India, Japan, Korea,
Southeast Asia, Africa, the Middle East, Europe and the Americas. It is not an
exhaustive list of all music services. Availability and catalog rights are set
by each service. This extension does not bypass login, DRM, region blocks,
subscriptions, or a service's listening limits.

## Detection and privacy

The extension observes media playback in the active document. The original
Spotify, YouTube Music and SoundCloud metadata-presence selectors remain.
New providers use media elements and MediaSession presence/state signals;
they do not scrape song names from page text. A playing audio element has
priority. New-provider video playback needs MediaSession metadata presence.
Metadata presence alone never starts playback detection.

New providers also check explicit MediaSession playback state every two seconds
for detached, shadow, or WebAudio players. Fallback requires `playing` plus title
or artist presence. A usable DOM player, including a paused one, takes priority.
If a DOM player disappears, stale MediaSession `playing` is blocked until an
observed paused/none state followed by a new playing state.

Playback can include previews, advertisements, podcasts or speech. Site identity
and rhythm analysis do not prove that a song is playing. Song text, URLs and raw
audio stay out of the native protocol. Only fixed provider IDs, booleans, timing,
and optional numeric beat features are sent locally.

Beat Sync still requires the extension popup action and Chrome tab-capture
permission. Adding a site does not grant automatic capture authority. If a
service opens a separate player window, use the popup on that player tab.
Cross-origin child frames and inaccessible player implementations can need a
separate adapter; blanket frame injection was not enabled.

## Verification and release limits

Research checked official player entries and help pages. The JioSaavn web player
UI was also inspected in Chrome without starting playback or logging in. Some
official sites require an account or block the current region. Site research
does not establish extension-to-app playback or beat-sync accuracy.

NetEase, KKBOX, Kuwo, Boomplay and Gaana were not enabled in this update: their
current browser playback could not be established in this review. In particular,
the browser site-safety policy blocked NetEase page inspection; no workaround was
used. This does not establish that those services are invalid or retired.
Regular YouTube and unrelated websites are not built-in integrations. Users may
enable an individual website through the separate custom-site permission flow.

All 18 provider IDs must be accepted by the extension, native host and Phase Pal.
The updated source includes those allowlists. Older apps or hosts accept only
the original three; use an updated app/sidecar for the new services. Protocol 1
is unchanged; the expansion does not grant any new tool or capture authority.

`src/providers.ts` owns names and exact hosts. The build derives Chrome host
permissions and content-script matches from that catalog. The content script is
built as a separate classic IIFE so it can share the catalog without emitting
unsupported module imports in Chrome's content-script entry.

Before a store/runtime release, verify each site in a permitted account and
region: play, pause, track changes, navigation, back/forward restore, tab close,
and optional capture start/stop. Check both Windows and macOS with the updated
app. No site-wide live playback certification is claimed here.
