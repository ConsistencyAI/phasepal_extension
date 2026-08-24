import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, providerForUrl, type PlaybackStateMessage } from "../src/protocol";

describe("providerForUrl", () => {
  it.each([
    ["https://open.spotify.com/album/example", "spotify_web"],
    ["https://music.youtube.com/watch?v=example", "youtube_music"],
    ["https://soundcloud.com/user/song", "soundcloud"]
  ])("maps %s", (url, expected) => expect(providerForUrl(url)).toBe(expected));

  it.each([
    "https://youtube.com/watch?v=example",
    "https://example.com/",
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
