import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Message = Record<string, unknown>;
type Listener = (message: Message, sender: chrome.runtime.MessageSender, reply: (value: unknown) => void) => boolean;
const popupUrl = "chrome-extension://test/src/popup.html";
let listener: Listener;
let hostListener: (message: Message) => void;
let updatedListener: (id: number, change: { status?: string; url?: string; discarded?: boolean }) => void;
let nativePost: ReturnType<typeof vi.fn>;
let removedListener: (id: number) => void;
let stored: Record<string, unknown>;
let getStream: ReturnType<typeof vi.fn>;
let offscreenMessage: ReturnType<typeof vi.fn>;

async function send(message: Message, sender: chrome.runtime.MessageSender = { id: "test", url: popupUrl }): Promise<any> {
  const result = await new Promise(resolve => {
    const asynchronous = listener(message, sender, resolve);
    if (!asynchronous) resolve(undefined);
  });
  await Promise.resolve();
  return result;
}
function ready(enabled = true): void {
  hostListener({ type: "host_status", protocolVersion: 1, phasePalConnected: true, danceToMusicEnabled: enabled, errorCode: "none" });
}
async function startCapture() {
  await send({ type: "begin_capture", tabId: 7, streamId: "stream-id" });
}
async function playback(playing = true): Promise<void> {
  await send({ type: "provider_playback", provider: "spotify_web", playing, hasTitle: true, hasArtist: true, hasTimeline: true, emittedAtUnixMs: 100 },
    { id: "test", frameId: 0, tab: { id: 7 } as chrome.tabs.Tab, url: "https://open.spotify.com/" });
}
async function load(saved = false): Promise<void> {
  stored = { autoBeatSync: saved };
  getStream = vi.fn().mockResolvedValue("stream-id");
  offscreenMessage = vi.fn().mockResolvedValue({ ok: true });
  nativePost = vi.fn();
  const port = {
    postMessage: nativePost,
    onMessage: { addListener: (callback: typeof hostListener) => { hostListener = callback; } },
    onDisconnect: { addListener: vi.fn() }
  };
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      getURL: (path: string) => `chrome-extension://test/${path}`,
      getManifest: () => ({ version: "0.1.0" }),
      connectNative: () => port,
      onMessage: { addListener: (callback: Listener) => { listener = callback; } },
      getContexts: vi.fn().mockResolvedValue([{}]),
      ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
      sendMessage: offscreenMessage
    },
    storage: { local: {
      get: vi.fn().mockImplementation(async () => ({ ...stored })),
      set: vi.fn().mockImplementation(async (values: Message) => { Object.assign(stored, values); })
    } },
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ id: 7, url: "https://open.spotify.com/" }),
      query: vi.fn().mockResolvedValue([{ id: 7, url: "https://open.spotify.com/" }]),
      onUpdated: { addListener: (callback: typeof updatedListener) => { updatedListener = callback; } },
      onRemoved: { addListener: (callback: typeof removedListener) => { removedListener = callback; } }
    },
    permissions: { contains: vi.fn().mockResolvedValue(false), onRemoved: { addListener: vi.fn() } },
    scripting: { getRegisteredContentScripts: vi.fn().mockResolvedValue([]), unregisterContentScripts: vi.fn() },
    tabCapture: { getMediaStreamId: getStream },
    offscreen: { createDocument: vi.fn(), Reason: { USER_MEDIA: "USER_MEDIA" } }
  });
  await import("../src/background");
  await Promise.resolve();
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("music message boundaries", () => {
  it.each([
    { url: "https://example.com/", frameId: 0 },
    { url: "https://open.spotify.com/", frameId: 1 },
    { url: "http://open.spotify.com/", frameId: 0 },
  ])("rejects playback from $url frame $frameId", async sender => {
    await load(true); ready(); nativePost.mockClear();
    await send({ type: "provider_playback", provider: "spotify_web", playing: true, hasTitle: true, hasArtist: true, hasTimeline: true, emittedAtUnixMs: 100 },
      { ...sender, id: "test", tab: { id: 7 } as chrome.tabs.Tab });
    expect(nativePost).not.toHaveBeenCalled();
    expect(getStream).not.toHaveBeenCalled();
  });

  it.each([{ playing: "true" }, { provider: "soundcloud" }, { title: "private title" }, { emittedAtUnixMs: NaN }])("rejects invalid playback fields %j", async fields => {
    await load(true); ready(); nativePost.mockClear();
    await send({ type: "provider_playback", provider: "spotify_web", playing: true, hasTitle: true, hasArtist: true, hasTimeline: true, emittedAtUnixMs: 100, ...fields },
      { id: "test", frameId: 0, tab: { id: 7 } as chrome.tabs.Tab, url: "https://open.spotify.com/" });
    expect(nativePost).not.toHaveBeenCalled();
    expect(getStream).not.toHaveBeenCalled();
  });

  it("stops capture on navigation even when no content unload message arrives", async () => {
    await load(true); ready(); await playback(); await startCapture();
    await vi.waitFor(async () => expect((await send({ type: "get_popup_state" })).captureActive).toBe(true));
    updatedListener(7, { status: "loading" });
    await vi.waitFor(async () => expect((await send({ type: "get_popup_state" })).captureActive).toBe(false));
    expect(offscreenMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "offscreen_stop_capture", reason: "unsupported_navigation", captureId: expect.any(String) }));
  });

  it("does not forward private fields from a malformed feature message", async () => {
    await load(true); ready(); await playback(); await startCapture();
    await vi.waitFor(async () => expect((await send({ type: "get_popup_state" })).captureActive).toBe(true));
    nativePost.mockClear();
    const captureId = offscreenMessage.mock.calls.find(([m]) => m.type === "offscreen_start_capture")![0].captureId;
    await send({ type: "offscreen_features", captureId, features: { energy01: 1, beatConfidence01: 1, bpm: 120, beatPhase01: 0, beatPulse: true, onsetDensity01: 1, sectionIntensity: "high", title: "private" } },
      { id: "test", url: "chrome-extension://test/src/offscreen.html" });
    expect(nativePost).not.toHaveBeenCalled();
  });
});


it("acknowledges Stop without waiting for Chrome to finish a capture request", async () => {
  await load(true);
  let complete!: (value: unknown) => void;
  offscreenMessage.mockImplementation((message: Message) => message.type === "offscreen_start_capture"
    ? new Promise(resolve => { complete = resolve; }) : Promise.resolve({ ok: true }));
  ready(); await playback();
  const pending = startCapture();
  await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
  expect(await send({ type: "stop_capture" })).toEqual({ ok: true });
  expect(offscreenMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "offscreen_stop_capture", reason: "user", captureId: expect.any(String) }));
  complete({ ok: true });
  await pending;
  expect((await send({ type: "get_popup_state" })).captureActive).toBe(false);
});

describe("lyric bridge negotiation", () => {
  const sender = { id: "test", frameId: 0, tab: { id: 7 } as chrome.tabs.Tab, url: "https://open.spotify.com/" };
  const sample = () => ({ type: "provider_lyrics", provider: "spotify_web", sourceId: "document", trackId: "track",
    title: "Example", artist: "Artist", durationMs: 60000, positionMs: 12000, playbackRate: 1,
    playing: true, buffering: false, available: true, emittedAtUnixMs: Date.now() });
  function lyricStatus(enabled: boolean) {
    hostListener({ type: "host_status", protocolVersion: 2, phasePalConnected: true, danceToMusicEnabled: true, lyricsRequested: enabled, errorCode: "none" });
  }
  it("keeps v1 dancing when the host or app rejects v2", async () => {
    await load();
    hostListener({ type: "host_status", protocolVersion: 1, phasePalConnected: true, danceToMusicEnabled: true, errorCode: "protocol_mismatch" });
    expect(nativePost).toHaveBeenLastCalledWith(expect.objectContaining({ type: "hello", protocolVersion: 1 }));
    await playback(); await send(sample(), sender);
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
    expect(nativePost.mock.calls.some(([m]) => m.type === "playback_state" && m.protocolVersion === 1)).toBe(true);
  });
  it("requires app opt-in and clears metadata on opt-out", async () => {
    await load(); await playback(); await send(sample(), sender);
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
    lyricStatus(true); await send(sample(), sender);
    expect(nativePost).toHaveBeenLastCalledWith(expect.objectContaining({ type: "lyrics_playback", title: "Example", protocolVersion: 2 }));
    lyricStatus(false); nativePost.mockClear(); await send(sample(), sender); await playback();
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
    lyricStatus(true); await playback();
    expect(nativePost.mock.calls.filter(([m]) => m.type === "lyrics_playback").every(([m]) => m.available === false)).toBe(true);
  });
  it("uses the selected source and does not replay a duplicate position sample", async () => {
    await load(); await playback(); lyricStatus(true); await send(sample(), sender);
    nativePost.mockClear(); await playback();
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
    await send({ ...sample(), sourceId: "other", provider: "youtube_music" },
      { ...sender, tab: { id: 8 } as chrome.tabs.Tab, url: "https://music.youtube.com/" });
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
  });
  it("changes lyrics when the selected music source changes", async () => {
    await load(); await playback(); lyricStatus(true); await send(sample(), sender);
    const nextSender = { ...sender, tab: { id: 8 } as chrome.tabs.Tab, url: "https://music.apple.com/" };
    await send({ type: "provider_playback", provider: "apple_music", playing: true,
      hasTitle: true, hasArtist: true, hasTimeline: true, emittedAtUnixMs: 200 }, nextSender);
    await send({ ...sample(), sourceId: "apple-document", provider: "apple_music", title: "Next song" }, nextSender);
    expect(nativePost).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "lyrics_playback", provider: "apple_music", sourceId: "apple-document", title: "Next song"
    }));
    nativePost.mockClear();
    await send(sample(), sender);
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
  });

  it("rejects lyric reports after the document is removed", async () => {
    await load(); await playback(); lyricStatus(true); await send(sample(), sender);
    removedListener(7); nativePost.mockClear();
    await send({ ...sample(), title: "Removed song" }, sender);
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
  });

  it("drops a pending lyric report when opt-out is followed by a new request", async () => {
    await load(); await playback(); lyricStatus(true); nativePost.mockClear();
    listener(sample(), sender, vi.fn());
    lyricStatus(false); lyricStatus(true);
    await Promise.resolve();
    expect(nativePost.mock.calls.some(([m]) => m.type === "lyrics_playback")).toBe(false);
  });

});
