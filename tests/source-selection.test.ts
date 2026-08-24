import { describe, expect, it } from "vitest";
import { selectMusicSource, type MusicSourceState } from "../src/source-selection";

const spotify: MusicSourceState = {
  tabId: 1,
  provider: "spotify_web",
  playing: true,
  lastStartedAt: 100
};
const youtube: MusicSourceState = {
  tabId: 2,
  provider: "youtube_music",
  playing: true,
  lastStartedAt: 200
};

describe("music source selection", () => {
  it("uses the most recently started supported tab", () => {
    expect(selectMusicSource([spotify, youtube])?.tabId).toBe(2);
  });

  it("keeps the captured tab authoritative even after it pauses", () => {
    expect(selectMusicSource([spotify, { ...youtube, playing: false }], 2)?.tabId).toBe(2);
  });

  it("falls back when the captured tab closes", () => {
    expect(selectMusicSource([spotify], 2)?.tabId).toBe(1);
  });
});
