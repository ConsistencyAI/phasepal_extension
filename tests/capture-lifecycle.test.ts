import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("offscreen capture ownership", () => {
  let listener: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  const sender = { id: "extension", url: "chrome-extension://extension/assets/background.js" };
  let getUserMedia: ReturnType<typeof vi.fn>;
  let addModule: ReturnType<typeof vi.fn>;
  let contexts: { close: ReturnType<typeof vi.fn> }[];

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    contexts = [];
    getUserMedia = vi.fn();
    addModule = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("chrome", { runtime: {
      id: "extension",
      getURL: (path: string) => `chrome-extension://extension/${path}`,
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
      sendMessage: vi.fn().mockResolvedValue(undefined)
    } });
    vi.stubGlobal("AudioContext", class {
      audioWorklet = { addModule };
      destination = {};
      state = "running";
      close = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      constructor() { contexts.push(this); }
    });
    vi.stubGlobal("AudioWorkletNode", class { port = {}; });
    await import("../src/offscreen");
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  function stream() {
    const track = { stop: vi.fn(), addEventListener: vi.fn() };
    return { track, value: { getTracks: () => [track] } as unknown as MediaStream };
  }

  function start(id: string) {
    const reply = vi.fn();
    listener({ type: "offscreen_start_capture", captureId: id, streamId: id }, sender, reply);
    return reply;
  }

  it.each(["getUserMedia", "addModule"])("stop cancels pending %s and closes its resources", async stage => {
    const media = stream();
    const pending = deferred<any>();
    getUserMedia.mockReturnValue(stage === "getUserMedia" ? pending.promise : Promise.resolve(media.value));
    if (stage === "addModule") addModule.mockReturnValue(pending.promise);
    const reply = start("a");
    await vi.advanceTimersByTimeAsync(0);
    listener({ type: "offscreen_stop_capture", captureId: "a" }, sender, vi.fn());
    pending.resolve(stage === "getUserMedia" ? media.value : undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(reply).toHaveBeenCalledWith({ ok: false, error: "capture_cancelled" });
    expect(media.track.stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    if (stage === "addModule") expect(contexts[0]?.close).toHaveBeenCalled();
  });

  it("late first start cannot replace or stop the newer capture", async () => {
    const first = stream();
    const second = stream();
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(second.value);
    const firstReply = start("a");
    const secondReply = start("b");
    await vi.advanceTimersByTimeAsync(0);
    expect(secondReply).toHaveBeenCalledWith({ ok: true });
    pending.resolve(first.value);
    await vi.advanceTimersByTimeAsync(0);
    listener({ type: "offscreen_stop_capture", captureId: "a" }, sender, vi.fn());
    expect(firstReply).toHaveBeenCalledWith({ ok: false, error: "capture_cancelled" });
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    listener({ type: "offscreen_stop_capture", captureId: "b" }, sender, vi.fn());
    expect(second.track.stop).toHaveBeenCalled();
  });
});


describe("background pending capture", () => {
  let listener: (message: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  let removed: (id: number) => void;
  let updated: (id: number, change: unknown) => void;
  let tab: ReturnType<typeof deferred<{ url: string }>>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let getContexts: ReturnType<typeof vi.fn>;
  let createDocument: ReturnType<typeof vi.fn>;
  let nativePost: ReturnType<typeof vi.fn>;
  let permissionRemoved: () => void;
  let granted: boolean;
  let registered: chrome.scripting.RegisteredContentScript[];
  let containsPermission: ReturnType<typeof vi.fn>;
  const popup = { id: "extension", url: "chrome-extension://extension/src/popup.html" };

  beforeEach(async () => {
    vi.resetModules();
    let nextId = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `session-${++nextId}` });
    tab = deferred();
    sendMessage = vi.fn().mockResolvedValue({ ok: true });
    getContexts = vi.fn().mockResolvedValue([{}]);
    createDocument = vi.fn().mockResolvedValue(undefined);
    nativePost = vi.fn();
    granted = false;
    registered = [];
    containsPermission = vi.fn(async () => granted);
    const port = { postMessage: nativePost, onMessage: { addListener: vi.fn() }, onDisconnect: { addListener: vi.fn() } };
    vi.stubGlobal("chrome", {
      runtime: {
        id: "extension", connectNative: () => port,
        getManifest: () => ({ version: "0.1.0" }),
        getURL: (path: string) => `chrome-extension://extension/${path}`,
        getContexts,
        ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
        onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
        sendMessage
      },
      offscreen: { createDocument, Reason: { USER_MEDIA: "USER_MEDIA" } },
      permissions: {
        contains: containsPermission, remove: vi.fn(async () => { granted = false; return true; }),
        onRemoved: { addListener: (callback: () => void) => { permissionRemoved = callback; } }
      },
      scripting: {
        getRegisteredContentScripts: vi.fn(async () => registered),
        registerContentScripts: vi.fn(async (scripts: chrome.scripting.RegisteredContentScript[]) => { registered.push(...scripts); }),
        unregisterContentScripts: vi.fn(async () => { registered = []; }),
        executeScript: vi.fn().mockResolvedValue([])
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 4, url: "https://open.spotify.com/" }]),
        get: () => tab.promise,
        sendMessage: vi.fn().mockResolvedValue(undefined),
        onRemoved: { addListener: (callback: typeof removed) => { removed = callback; } },
        onUpdated: { addListener: (callback: typeof updated) => { updated = callback; } }
      }
    });
    await import("../src/background");
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it.each(["stop", "close", "navigation"])("%s cancels capture before the tab lookup completes", async action => {
    const reply = vi.fn();
    listener({ type: "begin_capture", tabId: 4, streamId: "stream" }, popup, reply);
    if (action === "stop") listener({ type: "stop_capture" }, popup, vi.fn());
    if (action === "close") removed(4);
    if (action === "navigation") updated(4, { status: "loading" });
    tab.resolve({ url: "https://open.spotify.com/" });
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: false, error: "capture_cancelled" }));
    expect(sendMessage.mock.calls.some(([message]) => message.type === "offscreen_start_capture")).toBe(false);
  });

  it("rejects capture commands from a content script and malformed payloads", () => {
    const reply = vi.fn();
    expect(listener({ type: "begin_capture", tabId: 4, streamId: "stream" },
      { id: "extension", url: "https://open.spotify.com/", tab: { id: 4 } }, reply)).toBe(false);
    expect(listener(null, popup, reply)).toBe(false);
    expect(listener({ type: "begin_capture", tabId: "4", streamId: "stream" }, popup, reply)).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it("stop cancels capture while offscreen document creation is pending", async () => {
    const pending = deferred<void>();
    getContexts.mockResolvedValue([]);
    createDocument.mockReturnValue(pending.promise);
    tab.resolve({ url: "https://open.spotify.com/" });
    const reply = vi.fn();
    listener({ type: "begin_capture", tabId: 4, streamId: "stream" }, popup, reply);
    await vi.waitFor(() => expect(createDocument).toHaveBeenCalled());
    listener({ type: "stop_capture" }, popup, vi.fn());
    pending.resolve();
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: false, error: "capture_cancelled" }));
    expect(sendMessage.mock.calls.some(([message]) => message.type === "offscreen_start_capture")).toBe(false);
  });

  it("stale start replies, stop events and features cannot replace the newer capture", async () => {
    const firstResponse = deferred<{ ok: boolean }>();
    sendMessage.mockImplementation(message => message.type === "offscreen_start_capture" && message.streamId === "first"
      ? firstResponse.promise : Promise.resolve({ ok: true }));
    tab.resolve({ url: "https://open.spotify.com/" });
    const firstReply = vi.fn();
    listener({ type: "begin_capture", tabId: 4, streamId: "first" }, popup, firstReply);
    await vi.waitFor(() => expect(sendMessage.mock.calls.some(([message]) => message.type === "offscreen_start_capture")).toBe(true));
    const firstId = sendMessage.mock.calls.find(([message]) => message.streamId === "first")![0].captureId;
    const secondReply = vi.fn();
    listener({ type: "begin_capture", tabId: 4, streamId: "second" }, popup, secondReply);
    await vi.waitFor(() => expect(secondReply).toHaveBeenCalledWith({ ok: true }));
    const secondId = sendMessage.mock.calls.find(([message]) => message.streamId === "second")![0].captureId;
    firstResponse.resolve({ ok: true });
    await vi.waitFor(() => expect(firstReply).toHaveBeenCalledWith({ ok: false, error: "capture_cancelled" }));
    const offscreen = { id: "extension", url: "chrome-extension://extension/src/offscreen.html" };
    const features = { energy01: 0.4, beatConfidence01: 0.9, bpm: 120, beatPhase01: 0.5,
      beatPulse: true, onsetDensity01: 0.3, sectionIntensity: "medium" };
    listener({ type: "offscreen_capture_stopped", captureId: firstId, reason: "stream_ended" }, offscreen, vi.fn());
    listener({ type: "offscreen_features", captureId: firstId, features }, offscreen, vi.fn());
    listener({ type: "offscreen_features", captureId: secondId, features: null }, offscreen, vi.fn());
    listener({ type: "offscreen_features", captureId: secondId, features: { ...features, bpm: 500 } }, offscreen, vi.fn());
    listener({ type: "offscreen_features", captureId: secondId, features: { ...features, title: "private" } }, offscreen, vi.fn());
    expect(nativePost.mock.calls.some(([message]) => message.type === "music_features")).toBe(false);
    listener({ type: "offscreen_features", captureId: secondId, features }, offscreen, vi.fn());
    expect(nativePost).toHaveBeenCalledWith(expect.objectContaining({ type: "music_features", bpm: 120 }));
    const stateReply = vi.fn();
    listener({ type: "get_popup_state" }, popup, stateReply);
    await vi.waitFor(() => expect(stateReply).toHaveBeenCalledWith(expect.objectContaining({ captureActive: true, bpm: 120 })));
    listener({ type: "stop_capture" }, popup, vi.fn());
  });

  async function addCustomSite() {
    granted = true;
    const reply = vi.fn();
    listener({ type: "add_custom_site", origin: "https://radio.example" }, popup, reply);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true }));
  }

  it("custom capture uses audio energy when the page has no detectable media element", async () => {
    await addCustomSite();
    tab.resolve({ url: "https://radio.example/live?secret=private" });
    const reply = vi.fn();
    listener({ type: "begin_capture", tabId: 4, streamId: "custom" }, popup, reply);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true }));
    const id = sendMessage.mock.calls.find(([message]) => message.streamId === "custom")![0].captureId;
    let now = 10_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const offscreen = { id: "extension", url: "chrome-extension://extension/src/offscreen.html" };
    const features = { energy01: 0.3, beatConfidence01: 0.9, bpm: 120, beatPhase01: 0.5, beatPulse: false, onsetDensity01: 0.3, sectionIntensity: "medium" };
    try {
      listener({ type: "offscreen_features", captureId: id, features }, offscreen, vi.fn());
      expect(nativePost).toHaveBeenCalledWith(expect.objectContaining({ type: "playback_state", provider: "custom_site", playing: true, captureActive: true }));
      now += 1100;
      listener({ type: "offscreen_features", captureId: id, features: { ...features, energy01: 0 } }, offscreen, vi.fn());
      expect(nativePost).toHaveBeenCalledWith(expect.objectContaining({ type: "playback_state", provider: "custom_site", playing: false }));
      expect(JSON.stringify(nativePost.mock.calls)).not.toMatch(/radio\.example|secret|private/);
    } finally { clock.mockRestore(); }
    const removed = vi.fn();
    listener({ type: "remove_custom_site", origin: "https://radio.example" }, popup, removed);
    await vi.waitFor(() => expect(removed).toHaveBeenCalledWith({ ok: true }));
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "offscreen_stop_capture", captureId: id }));
  });

  it("revoking site access cancels a pending custom capture", async () => {
    await addCustomSite();
    const pending = deferred<void>();
    getContexts.mockResolvedValue([]);
    createDocument.mockReturnValue(pending.promise);
    tab.resolve({ url: "https://radio.example/" });
    const reply = vi.fn();
    listener({ type: "begin_capture", tabId: 4, streamId: "custom" }, popup, reply);
    await vi.waitFor(() => expect(createDocument).toHaveBeenCalled());
    granted = false;
    permissionRemoved();
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "offscreen_stop_capture" })));
    pending.resolve();
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: false, error: "capture_cancelled" }));
    expect(sendMessage.mock.calls.some(([message]) => message.type === "offscreen_start_capture")).toBe(false);
  });

  it("rejects custom registration and playback without a grant or from a website sender", async () => {
    const content = { id: "extension", url: "https://radio.example/", tab: { id: 4 } };
    const reply = vi.fn();
    expect(listener({ type: "add_custom_site", origin: "https://radio.example" }, content, reply)).toBe(false);
    listener({ type: "provider_playback", provider: "custom_site", playing: true, hasTitle: false, hasArtist: false, hasTimeline: false, emittedAtUnixMs: 1 }, content, reply);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: false }));
    expect(nativePost.mock.calls.some(([message]) => message.playing === true)).toBe(false);
  });

  it("navigation rejects playback whose custom-site permission lookup finishes late", async () => {
    await addCustomSite();
    const permission = deferred<boolean>();
    containsPermission.mockReturnValueOnce(permission.promise);
    const reply = vi.fn();
    listener({ type: "provider_playback", provider: "custom_site", playing: true, hasTitle: false, hasArtist: false,
      hasTimeline: false, emittedAtUnixMs: 1 }, { id: "extension", url: "https://radio.example/", tab: { id: 4 } }, reply);
    await vi.waitFor(() => expect(chrome.permissions.contains).toHaveBeenCalledWith({ origins: ["https://radio.example/*"] }));
    updated(4, { status: "loading" });
    permission.resolve(true);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: false }));
    expect(nativePost.mock.calls.some(([message]) => message.playing === true)).toBe(false);
  });

});
