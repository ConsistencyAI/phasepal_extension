import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, providerForUrl, type PlaybackStateMessage } from "../src/protocol";

describe("providerForUrl", () => {
  it.each([
    ["https://open.spotify.com/album/example", "spotify_web"],
    ["https://music.youtube.com/watch?v=example", "youtube_music"],
    ["https://soundcloud.com/user/song", "soundcloud"],
    ["https://music.apple.com/jp/new", "apple_music"],
    ["https://music.amazon.co.jp/", "amazon_music"],
    ["https://music.amazon.in/", "amazon_music"],
    ["https://music.amazon.com.br/", "amazon_music"],
    ["https://music.amazon.co.uk/", "amazon_music"],
    ["https://www.deezer.com/fr/", "deezer"],
    ["https://listen.tidal.com/", "tidal"],
    ["https://play.qobuz.com/", "qobuz"],
    ["https://www.pandora.com/", "pandora"],
    ["https://music.yandex.ru/", "yandex_music"],
    ["https://music.yandex.com/", "yandex_music"],
    ["https://y.qq.com/portal/player.html", "qq_music"],
    ["https://www.kugou.com/song/", "kugou"],
    ["https://www.jiosaavn.com/", "jiosaavn"],
    ["https://music.line.me/webapp/", "line_music"],
    ["https://music.bugs.co.kr/", "bugs"],
    ["https://www.joox.com/intl", "joox"],
    ["https://play.anghami.com/", "anghami"],
    ["https://audiomack.com/", "audiomack"]
  ])("maps %s", (url, expected) => expect(providerForUrl(url)).toBe(expected));

  it.each([
    "https://youtube.com/watch?v=example",
    "https://example.com/",
    "http://open.spotify.com/",
    "https://open.spotify.com.evil.example/",
    "https://evil.example/?url=https://music.apple.com/",
    "https://music.apple.com@evil.example/",
    "https://someone:secret@music.apple.com/",
    "https://account.deezer.com/",
    "https://www.amazon.com/",
    "https://evil.soundcloud.com/",
    "https://music.qq.com/",
    "https://joox.com.evil.example/",
    "not a URL"
  ])("rejects %s", url => expect(providerForUrl(url)).toBeUndefined());
});

describe("privacy-safe playback protocol", () => {
  it("contains only fixed provider and presence fields", () => {
    const message: PlaybackStateMessage = {
      type: "playback_state",
      protocolVersion: PROTOCOL_VERSION,
      sequence: 1,
      emittedAtUnixMs: 123,
      browserSessionId: "session",
      provider: "spotify_web",
      playing: true,
      hasTitle: true,
      hasArtist: true,
      hasTimeline: true,
      captureActive: false
    };
    expect(Object.keys(message)).not.toEqual(expect.arrayContaining(["url", "title", "artist", "pageText"]));
  });
});
