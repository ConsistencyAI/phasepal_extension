import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MediaState { paused: boolean; ended: boolean; readyState: number; duration: number; error: MediaError | null; }
let sendMessage: ReturnType<typeof vi.fn>;
let metadata: { metadata: { title: string; artist: string } | null; playbackState: MediaSessionPlaybackState };
let windowListeners: ReturnType<typeof vi.spyOn>;

function media(tag: "audio" | "video" = "audio", options: Partial<MediaState> = {}) {
  const element = document.createElement(tag);
  const state: MediaState = { paused: true, ended: false, readyState: 4, duration: 180, error: null, ...options };
  for (const key of Object.keys(state) as (keyof MediaState)[]) Object.defineProperty(element, key, { configurable: true, get: () => state[key] });
  document.body.append(element);
  return { element, state };
}
function playback() { return sendMessage.mock.calls.map(([message]) => message).filter(message => message.type === "provider_playback"); }
function lastPlayback() { return playback().at(-1); }
async function flush() { await vi.advanceTimersByTimeAsync(0); }
async function load(url = "https://open.spotify.com/") {
  vi.stubGlobal("location", new URL(url));
  await import("../src/content");
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.replaceChildren();
  document.title = "Private page title";
  sendMessage = vi.fn().mockResolvedValue(undefined);
  metadata = { metadata: null, playbackState: "none" };
  vi.stubGlobal("chrome", { runtime: { id: "extension", getURL: (path: string) => `chrome-extension://extension/${path}`,
    sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
  vi.stubGlobal("navigator", { mediaSession: metadata });
  windowListeners = vi.spyOn(window, "addEventListener");
});

afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  for (const [event, listener] of windowListeners.mock.calls) {
    if (event === "pagehide" || event === "pageshow") window.removeEventListener(event, listener as EventListener);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("content playback ownership", () => {
  it("accepts reminder control only from the owning extension and removes it on cleanup", async () => {
    await load();
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls.at(-1)![0];
    const prompt = () => Array.from(document.documentElement.children).find(element => element.shadowRoot);
    listener({ type: "beat_sync_prompt", show: true }, { id: "foreign" }, vi.fn());
    expect(prompt()).toBeUndefined();
    listener({ type: "beat_sync_prompt", show: true }, { id: "extension", tab: { id: 4 } } as chrome.runtime.MessageSender, vi.fn());
    expect(prompt()).toBeUndefined();
    listener({ type: "beat_sync_prompt", show: true }, { id: "extension", url: "chrome-extension://extension/assets/background.js" }, vi.fn());
    expect(prompt()?.shadowRoot?.textContent).toContain("Want to enable Beat Sync?");
    window.dispatchEvent(new Event("pagehide"));
    expect(prompt()).toBeUndefined();
  });

  it("detects playback from a second media element without a DOM mutation", async () => {
    const first = media();
    const second = media();
    await load();
    expect(lastPlayback().playing).toBe(false);
    second.state.paused = false;
    second.element.dispatchEvent(new Event("playing"));
    expect(lastPlayback().playing).toBe(true);
    first.element.dispatchEvent(new Event("pause"));
    expect(lastPlayback().playing).toBe(true);
    second.state.paused = true;
    second.element.dispatchEvent(new Event("pause"));
    expect(lastPlayback().playing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removal clears playback and metadata even when MediaSession remains stale", async () => {
    const current = media("audio", { paused: false });
    metadata.metadata = { title: "Private song", artist: "Private artist" };
    await load();
    expect(lastPlayback()).toMatchObject({ playing: true, hasTitle: true, hasArtist: true });
    current.element.remove();
    await flush();
    expect(lastPlayback()).toMatchObject({ playing: false, hasTitle: false, hasArtist: false, hasTimeline: false });
    expect(vi.getTimerCount()).toBe(0);
    const replacement = media("audio", { paused: false });
    await flush();
    expect(lastPlayback().playing).toBe(true);
    replacement.state.ended = true;
    replacement.element.dispatchEvent(new Event("ended"));
    expect(lastPlayback().playing).toBe(false);
  });

  it("empty media and decoder errors clear a formerly playing element", async () => {
    const current = media("audio", { paused: false });
    await load();
    current.state.readyState = 0;
    current.element.dispatchEvent(new Event("emptied"));
    expect(lastPlayback()).toMatchObject({ playing: false, hasTimeline: false });
    current.state.readyState = 4;
    current.element.dispatchEvent(new Event("playing"));
    expect(lastPlayback().playing).toBe(true);
    current.state.error = {} as MediaError;
    current.element.dispatchEvent(new Event("error"));
    expect(lastPlayback().playing).toBe(false);
  });

  it("uses a two-second heartbeat only while playback is active", async () => {
    const current = media("audio", { paused: false });
    await load();
    const initial = playback().length;
    document.body.append(document.createElement("p"));
    await flush();
    expect(playback()).toHaveLength(initial);
    await vi.advanceTimersByTimeAsync(1999);
    expect(playback()).toHaveLength(initial);
    await vi.advanceTimersByTimeAsync(1);
    expect(playback()).toHaveLength(initial + 1);
    current.state.paused = true;
    current.element.dispatchEvent(new Event("pause"));
    const pausedCount = playback().length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(playback()).toHaveLength(pausedCount);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restores monitoring after repeated back-forward cache visits", async () => {
    const current = media("audio", { paused: false });
    await load();
    for (let visit = 0; visit < 2; visit++) {
      window.dispatchEvent(new Event("pagehide"));
      expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: "provider_unloaded" }));
      expect(vi.getTimerCount()).toBe(0);
      current.state.paused = visit === 0;
      current.element.dispatchEvent(new Event("pause"));
      window.dispatchEvent(new Event("pageshow"));
      expect(lastPlayback().playing).toBe(!current.state.paused);
      expect(vi.getTimerCount()).toBe(current.state.paused ? 0 : 1);
    }
  });
});

describe("provider metadata privacy", () => {
  it.each([
    ["https://open.spotify.com/", "<a data-testid='context-item-link'>Private song</a><span data-testid='context-item-info-artist'>Private artist</span>"],
    ["https://music.youtube.com/", "<ytmusic-player-bar><span class='title'>Private song</span><span class='byline'>Private artist</span></ytmusic-player-bar>"],
    ["https://soundcloud.com/", "<span class='playbackSoundBadge__title'>Private song</span><span class='playbackSoundBadge__lightLink'>Private artist</span>"]
  ])("keeps the existing presence-only selector fallback for %s", async (url, html) => {
    document.body.innerHTML = html;
    media("video", { paused: false });
    await load(url);
    expect(lastPlayback()).toEqual({ type: "provider_playback", provider: expect.any(String), playing: true,
      hasTitle: true, hasArtist: true, hasTimeline: true, emittedAtUnixMs: expect.any(Number) });
  });

  it("new providers ignore page text and require metadata for video playback", async () => {
    document.body.innerHTML = "<h1>Private page content</h1><span class='title'>Private title</span>";
    media("video", { paused: false, duration: Infinity });
    await load("https://music.apple.com/");
    expect(lastPlayback()).toMatchObject({ playing: false, hasTitle: false, hasArtist: false, hasTimeline: false });
    metadata.metadata = { title: "Private media title", artist: "Private media artist" };
    document.querySelector("video")!.dispatchEvent(new Event("playing"));
    expect(lastPlayback()).toMatchObject({ playing: true, hasTitle: true, hasArtist: true, hasTimeline: false });
    const audio = media("audio", { paused: false, duration: 100 });
    await flush();
    expect(lastPlayback().hasTimeline).toBe(true);
    metadata.metadata = null;
    audio.element.dispatchEvent(new Event("durationchange"));
    expect(lastPlayback()).toEqual({ type: "provider_playback", provider: expect.any(String), playing: true,
      hasTitle: false, hasArtist: false, hasTimeline: true, emittedAtUnixMs: expect.any(Number) });
    expect(JSON.stringify(sendMessage.mock.calls)).not.toContain("Private");
  });
});


describe("generic MediaSession fallback", () => {
  it("custom sites require authorization and can observe video without music metadata", async () => {
    sendMessage.mockImplementation(message => Promise.resolve(message.type === "get_site_provider" ? { provider: "custom_site" } : { ok: true }));
    media("video", { paused: false });
    await load("https://radio.example/");
    await flush();
    expect(lastPlayback()).toMatchObject({ provider: "custom_site", playing: true, hasTitle: false, hasArtist: false });
    const before = playback().length;
    sendMessage.mockResolvedValue({ ok: false });
    await vi.advanceTimersByTimeAsync(2000);
    const stopped = playback().length;
    expect(stopped).toBeGreaterThan(before);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(6000);
    expect(playback()).toHaveLength(stopped);
  });

  it("an unapproved custom website does not start a playback monitor", async () => {
    sendMessage.mockResolvedValue({});
    media("audio", { paused: false });
    await load("https://radio.example/");
    await flush();
    expect(playback()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("requires explicit playing state and metadata, then clears paused and none", async () => {
    metadata.metadata = { title: "Private song", artist: "Private artist" };
    await load("https://music.apple.com/");
    expect(lastPlayback().playing).toBe(false);
    const initial = playback().length;
    await vi.advanceTimersByTimeAsync(4000);
    expect(playback()).toHaveLength(initial);
    metadata.playbackState = "playing";
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastPlayback()).toMatchObject({ playing: true, hasTitle: true, hasArtist: true, hasTimeline: false });
    const active = playback().length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(playback()).toHaveLength(active + 1);
    metadata.playbackState = "paused";
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastPlayback().playing).toBe(false);
    const paused = playback().length;
    await vi.advanceTimersByTimeAsync(4000);
    expect(playback()).toHaveLength(paused);
    metadata.playbackState = "none";
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastPlayback().playing).toBe(false);
    metadata.playbackState = "playing";
    metadata.metadata = null;
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastPlayback().playing).toBe(false);
    window.dispatchEvent(new Event("pagehide"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a real DOM pause authoritative over stale MediaSession playing", async () => {
    const current = media("audio", { paused: false });
    metadata.metadata = { title: "Private song", artist: "Private artist" };
    metadata.playbackState = "playing";
    await load("https://music.apple.com/");
    current.state.paused = true;
    current.element.dispatchEvent(new Event("pause"));
    expect(lastPlayback().playing).toBe(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(lastPlayback().playing).toBe(false);
    current.element.remove();
    await flush();
    await vi.advanceTimersByTimeAsync(4000);
    expect(lastPlayback().playing).toBe(false);
    metadata.playbackState = "paused";
    await vi.advanceTimersByTimeAsync(2000);
    metadata.playbackState = "playing";
    await vi.advanceTimersByTimeAsync(2000);
    expect(lastPlayback().playing).toBe(true);
  });

  it("does not revive stale session playback after removing an active DOM source", async () => {
    const current = media("audio", { paused: false });
    metadata.metadata = { title: "Private song", artist: "Private artist" };
    metadata.playbackState = "playing";
    await load("https://music.apple.com/");
    current.element.remove();
    await flush();
    expect(lastPlayback()).toMatchObject({ playing: false, hasTitle: false, hasArtist: false });
    await vi.advanceTimersByTimeAsync(6000);
    expect(lastPlayback().playing).toBe(false);
  });

  it("does not add discovery polling or fallback to the original three sites", async () => {
    metadata.metadata = { title: "Private song", artist: "Private artist" };
    metadata.playbackState = "playing";
    await load();
    expect(lastPlayback().playing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
