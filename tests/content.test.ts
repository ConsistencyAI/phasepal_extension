import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { (globalThis as any).phasePalMusicCleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); document.body.innerHTML = ""; });

describe("restored music document", () => {
  it("resumes its playback heartbeat after each Back/Forward restore", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("location", new URL("https://open.spotify.com/"));
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", { runtime: { id: "test", getURL: (p: string) => `chrome-extension://test/${p}`, sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
    const media = document.createElement("audio");
    Object.defineProperties(media, { paused: { value: false }, ended: { value: false }, readyState: { value: 4 }, duration: { value: 60 } });
    document.body.append(media);
    await import("../src/content");
    for (let cycle = 0; cycle < 2; cycle++) {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      sendMessage.mockClear();
      await vi.advanceTimersByTimeAsync(4000);
      expect(sendMessage).not.toHaveBeenCalled();
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "provider_playback", playing: true }));
      sendMessage.mockClear();
      await vi.advanceTimersByTimeAsync(2000);
      expect(sendMessage).toHaveBeenCalledOnce();
    }
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
});

describe("optional lyric metadata", () => {
  async function loadLyrics(url = "https://music.youtube.com/", custom = false) {
    vi.useFakeTimers();
    vi.stubGlobal("location", new URL(url));
    let request: (message: unknown, sender: unknown) => void = () => undefined;
    const sendMessage = vi.fn().mockImplementation(async (message: { type: string }) => message.type === "get_site_provider" && custom ? { provider: "custom_site" } : undefined);
    vi.stubGlobal("chrome", { runtime: { id: "test", getURL: (p: string) => `chrome-extension://test/${p}`, sendMessage,
      onMessage: { addListener: (handler: typeof request) => { request = handler; }, removeListener: vi.fn() } } });
    const media = document.createElement("audio");
    let paused = false, seeking = false, time = 12, speed = 1, readiness = 4;
    Object.defineProperties(media, {
      paused: { get: () => paused }, ended: { value: false }, duration: { value: 60, configurable: true },
      currentTime: { get: () => time }, readyState: { get: () => readiness },
      playbackRate: { get: () => speed }, seeking: { get: () => seeking }
    });
    document.body.innerHTML = '<ytmusic-player-bar><span class="title">Test Song</span><span class="byline">Test Artist</span></ytmusic-player-bar>';
    document.body.append(media);
    await import("../src/content");
    await Promise.resolve();
    return { sendMessage, media, request: (enabled: boolean) => request({ type: "lyrics_requested", enabled }, { id: "test" }),
      set: (values: { paused?: boolean; time?: number; speed?: number; readiness?: number; seeking?: boolean }) => {
        paused = values.paused ?? paused; time = values.time ?? time; speed = values.speed ?? speed;
        readiness = values.readiness ?? readiness; seeking = values.seeking ?? seeking;
      } };
  }

  it.each([
    ["https://music.apple.com/", "apple_music", false],
    ["https://example.com/", "custom_site", true]
  ] as const)("uses MediaSession metadata with real timing on %s", async (url, provider, custom) => {
    vi.stubGlobal("navigator", { mediaSession: { metadata: { title: "Session song", artist: "Session artist" } } });
    const test = await loadLyrics(url, custom);
    test.request(true);
    expect(test.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "provider_lyrics", provider, title: "Session song", artist: "Session artist", available: true, positionMs: 12000
    }));
  });

  it("reports unavailable when the player has no reliable timeline", async () => {
    const test = await loadLyrics();
    Object.defineProperty(test.media, "duration", { value: Infinity, configurable: true });
    test.request(true);
    expect(test.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "provider_lyrics", available: false, title: "", artist: "", durationMs: 0, positionMs: 0
    }));
  });

  it("sends song text only after a request and stops immediately on opt-out", async () => {
    const test = await loadLyrics();
    expect(test.sendMessage.mock.calls.some(([m]) => m.type === "provider_lyrics")).toBe(false);
    test.request(true);
    expect(test.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "provider_lyrics", title: "Test Song", artist: "Test Artist", positionMs: 12000 }));
    test.request(false); test.sendMessage.mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(test.sendMessage.mock.calls.some(([m]) => m.type === "provider_lyrics")).toBe(false);
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });

  it("reports seek, buffering, pause, speed and track changes with stable document identity", async () => {
    const test = await loadLyrics(); test.request(true);
    const initial = test.sendMessage.mock.calls.map(([m]) => m).find(m => m.type === "provider_lyrics");
    for (const [event, values, expected] of [
      ["seeking", { time: 30, seeking: true }, { positionMs: 30000, buffering: true }],
      ["seeked", { seeking: false }, { buffering: false }],
      ["pause", { paused: true }, { playing: false }],
      ["ratechange", { speed: 1.5 }, { playbackRate: 1.5 }],
      ["waiting", { readiness: 2 }, { buffering: true }]
    ] as const) {
      test.set(values); test.media.dispatchEvent(new Event(event));
      expect(test.sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: "provider_lyrics", ...expected }));
    }
    document.querySelector(".title")!.textContent = "Next Song";
    await vi.advanceTimersByTimeAsync(1000);
    const latest = test.sendMessage.mock.calls.map(([m]) => m).filter(m => m.type === "provider_lyrics").at(-1);
    expect(latest.sourceId).toBe(initial.sourceId); expect(latest.trackId).not.toBe(initial.trackId);
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });
  it("does not let a late playback reply restart lyric reports after opt-out", async () => {
    const test = await loadLyrics();
    let complete!: (value: unknown) => void;
    test.sendMessage.mockImplementation((message: { type: string }) => message.type === "provider_playback"
      ? new Promise(resolve => { complete = resolve; }) : Promise.resolve(undefined));
    test.media.dispatchEvent(new Event("pause"));
    // Force a fresh publication, rather than the unchanged playback fingerprint.
    test.set({ paused: true }); test.media.dispatchEvent(new Event("pause"));
    test.request(false);
    complete({ lyricsRequested: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(test.sendMessage.mock.calls.some(([m]) => m.type === "provider_lyrics")).toBe(false);
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });

});
