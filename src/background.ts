import {
  NATIVE_HOST_NAME,
  PROTOCOL_VERSION,
  type CaptureStopReason,
  type ExtensionToHostMessage,
  type FeatureSnapshot,
  type HostStatusMessage,
  type MusicProvider,
  type PlaybackStateMessage,
  type PopupState,
  type ProviderPlaybackUpdate,
  providerForUrl
} from "./protocol";
import { selectMusicSource } from "./source-selection";
import { CustomSiteRegistry, customSiteOrigin, customSitePattern } from "./custom-sites";

interface TabState {
  tabId: number;
  provider: MusicProvider;
  playing: boolean;
  hasTitle: boolean;
  hasArtist: boolean;
  hasTimeline: boolean;
  lastStartedAt: number;
  siteOrigin?: string;
}

const browserSessionId = crypto.randomUUID();
const tabs = new Map<number, TabState>();
const tabDocuments = new Map<number, object>();
const customSites = new CustomSiteRegistry();
void customSites.ready.catch(() => undefined);
let nativePort: chrome.runtime.Port | undefined;
let sequence = 0;
let capturedTabId: number | undefined;
let pendingTabId: number | undefined;
let captureId: string | undefined;
let capturedProvider: MusicProvider | undefined;
let latestFeatures: FeatureSnapshot = inactiveFeatureState();
let captureAudioState: PopupState["captureAudioState"] = "starting";
let hostStatus: HostStatusMessage = {
  type: "host_status",
  protocolVersion: PROTOCOL_VERSION,
  phasePalConnected: false,
  danceToMusicEnabled: false,
  errorCode: "phasepal_unavailable"
};
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let creatingOffscreenDocument: Promise<void> | undefined;
let captureSiteOrigin: string | undefined;
let lastCustomSoundAt = 0;
let lastCustomPublicationAt = 0;
let lastCustomPlaying = false;
let captureOrigin: string | undefined;
let autoBeatSync = false;
let hideBeatSyncPrompts = false;
let preferencesLoaded = false;
const preferencesReady = chrome.storage.local.get(["autoBeatSync", "hideBeatSyncPrompts"]).then(value => {
  autoBeatSync = value.autoBeatSync === true;
  hideBeatSyncPrompts = value.hideBeatSyncPrompts === true;
  preferencesLoaded = true;
  updatePrompts();
}).catch(() => undefined);
let preferenceQueue: Promise<unknown> = preferencesReady;

ensureNativePort();

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object" || sender.id !== chrome.runtime.id) return false;
  const candidate = message as Record<string, unknown>;
  const popupSender = !sender.tab && sender.url === chrome.runtime.getURL("src/popup.html");
  const offscreenSender = !sender.tab && sender.url === chrome.runtime.getURL("src/offscreen.html");
  if (candidate.type === "hide_beat_sync_prompts" && sender.tab?.id !== undefined && (sender.frameId ?? 0) === 0) {
    const url = sender.url;
    preferenceQueue = preferenceQueue.catch(() => undefined).then(async () => {
      if (!await resolvedProvider(url)) { sendResponse({ ok: false }); return; }
      await chrome.storage.local.set({ hideBeatSyncPrompts: true });
      hideBeatSyncPrompts = true;
      updatePrompts();
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (candidate.type === "set_auto_beat_sync" && popupSender && typeof candidate.enabled === "boolean") {
    const enabled = candidate.enabled;
    preferenceQueue = preferenceQueue.catch(() => undefined).then(async () => {
      await chrome.storage.local.set({ autoBeatSync: enabled });
      autoBeatSync = enabled;
      if (!enabled) await stopCapture("user");
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (candidate.type === "get_site_provider" && sender.tab?.id !== undefined && (sender.frameId ?? 0) === 0) {
    void resolvedProvider(sender.url).then(provider => sendResponse({ provider })).catch(() => sendResponse({}));
    return true;
  }
  if ((candidate.type === "add_custom_site" || candidate.type === "remove_custom_site") && popupSender) {
    if (typeof candidate.origin !== "string") return false;
    void changeCustomSite(candidate.type === "add_custom_site", candidate.origin).then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "Could not update website access." }));
    return true;
  }
  if (candidate.type === "provider_playback" && sender.tab?.id !== undefined) {
    if ((sender.frameId ?? 0) !== 0 ||
      ![candidate.playing, candidate.hasTitle, candidate.hasArtist, candidate.hasTimeline].every(value => typeof value === "boolean") ||
      typeof candidate.emittedAtUnixMs !== "number" || !Number.isFinite(candidate.emittedAtUnixMs)) return false;
    const tabId = sender.tab.id;
    const document = tabDocuments.get(tabId) ?? {};
    tabDocuments.set(tabId, document);
    void resolvedProvider(sender.url).then(provider => {
      if (!provider || candidate.provider !== provider || tabDocuments.get(tabId) !== document) { sendResponse({ ok: false }); return; }
      updateProvider(tabId, candidate as unknown as ProviderPlaybackUpdate, customSiteOrigin(sender.url));
      void preferencesReady.then(() => {
        if (tabDocuments.get(tabId) !== document) return;
        return chrome.tabs.sendMessage(tabId, { type: "beat_sync_prompt", show: shouldShowPrompt() }).catch(() => undefined);
      });
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (candidate.type === "provider_unloaded" && sender.tab?.id !== undefined && (sender.frameId ?? 0) === 0) {
    tabDocuments.delete(sender.tab.id);
    tabs.delete(sender.tab.id);
    if (pendingTabId === sender.tab.id || (capturedTabId === sender.tab.id && !autoBeatSync)) void stopCapture("unsupported_navigation");
    publishSelectedPlayback();
    sendResponse({ ok: true });
    return false;
  }
  if (candidate.type === "begin_capture" && popupSender) {
    if (typeof candidate.tabId !== "number" || typeof candidate.streamId !== "string") return false;
    void beginCapture(Number(candidate.tabId), String(candidate.streamId)).then(sendResponse);
    return true;
  }
  if (candidate.type === "stop_capture" && popupSender) {
    void stopCapture("user").then(() => sendResponse({ ok: true }));
    return true;
  }
  if (candidate.type === "offscreen_features" && offscreenSender && typeof candidate.captureId === "string" && candidate.captureId === captureId) {
    if (isFeatureSnapshot(candidate.features)) {
      if (["starting", "no_frames", "suspended", "silent", "analyzing"].includes(String(candidate.audioState)))
        captureAudioState = candidate.audioState as PopupState["captureAudioState"];
      receiveFeatures(candidate.features);
    }
    return false;
  }
  if (candidate.type === "offscreen_capture_stopped" && offscreenSender && typeof candidate.captureId === "string" && candidate.captureId === captureId) {
    const reason = normalizeStopReason(candidate.reason);
    finishCapture(reason, true);
    return false;
  }
  if (candidate.type === "get_popup_state" && popupSender) {
    sendNative({
      ...baseMessage(),
      type: "hello",
      extensionVersion: chrome.runtime.getManifest().version
    });
    void buildPopupState().then(sendResponse).catch(() => sendResponse({ supported: false, customSites: [], errorCode: "site_access_error" }));
    return true;
  }
  return false;
});

chrome.permissions.onRemoved.addListener(() => {
  void customSites.prune().then(async () => {
    for (const [tabId, tab] of tabs) {
      if (tab.provider !== "custom_site" || (tab.siteOrigin && customSites.origins.includes(tab.siteOrigin))) continue;
      tabs.delete(tabId);
      void chrome.tabs.sendMessage(tabId, { type: "custom_site_removed" }).catch(() => undefined);
    }
    if (captureSiteOrigin && !customSites.origins.includes(captureSiteOrigin)) await stopCapture("unsupported_navigation");
    publishSelectedPlayback();
  }).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabDocuments.delete(tabId);
  tabs.delete(tabId);
  if (capturedTabId === tabId || pendingTabId === tabId) void stopCapture("tab_closed");
  else publishSelectedPlayback();
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== "loading" && change.url === undefined) return;
  tabDocuments.delete(tabId);
  tabs.delete(tabId);
  const url = change.url ?? tab?.url;
  const sameSite = customSiteOrigin(url) === captureOrigin && Boolean(captureOrigin);
  if (pendingTabId === tabId || (capturedTabId === tabId && (!autoBeatSync || !sameSite))) void stopCapture("unsupported_navigation");
  else publishSelectedPlayback();
});

function updateProvider(tabId: number, update: ProviderPlaybackUpdate, siteOrigin?: string): void {
  const previous = tabs.get(tabId);
  tabs.set(tabId, {
    tabId,
    siteOrigin,
    provider: update.provider,
    playing: update.playing,
    hasTitle: update.hasTitle,
    hasArtist: update.hasArtist,
    hasTimeline: update.hasTimeline,
    lastStartedAt: update.playing && !previous?.playing ? update.emittedAtUnixMs : previous?.lastStartedAt ?? 0
  });
  if (capturedTabId === tabId || pendingTabId === tabId) capturedProvider = update.provider;
  publishSelectedPlayback();
}

function selectedTab(): TabState | undefined {
  if (capturedTabId !== undefined && capturedProvider === "custom_site") {
    return { tabId: capturedTabId, provider: "custom_site", playing: lastCustomPlaying,
      hasTitle: false, hasArtist: false, hasTimeline: false, lastStartedAt: lastCustomSoundAt };
  }
  return selectMusicSource(tabs.values(), capturedTabId);
}

function publishSelectedPlayback(): void {
  const selected = selectedTab();
  const fallbackProvider = capturedProvider ?? [...tabs.values()][0]?.provider;
  if (!selected && !fallbackProvider) {
    sendNative({ ...baseMessage(), type: "playback_state", provider: "custom_site", playing: false,
      hasTitle: false, hasArtist: false, hasTimeline: false, captureActive: false });
    return;
  }
  const message: PlaybackStateMessage = {
    ...baseMessage(),
    type: "playback_state",
    provider: selected?.provider ?? fallbackProvider!,
    playing: selected?.playing ?? false,
    hasTitle: selected?.hasTitle ?? false,
    hasArtist: selected?.hasArtist ?? false,
    hasTimeline: selected?.hasTimeline ?? false,
    captureActive: capturedTabId !== undefined && capturedTabId === selected?.tabId
  };
  sendNative(message);
}

async function beginCapture(tabId: number, streamId: string): Promise<{ ok: boolean; error?: string }> {
  if (!bridgeReady()) return { ok: false, error: "phasepal_unavailable" };
  if (!Number.isInteger(tabId) || !streamId) return { ok: false, error: "capture_error" };
  void stopCapture("replaced");
  const id = crypto.randomUUID();
  captureId = id;
  captureAudioState = "starting";
  updatePrompts();
  pendingTabId = tabId;
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    const provider = await resolvedProvider(tab?.url);
    if (captureId !== id) return { ok: false, error: "capture_cancelled" };
    if (!provider) {
      await stopCapture("unsupported_navigation");
      return { ok: false, error: "unsupported_navigation" };
    }
    captureSiteOrigin = provider === "custom_site" ? customSiteOrigin(tab?.url) : undefined;
    captureOrigin = customSiteOrigin(tab?.url);
    await ensureOffscreenDocument();
    if (captureId !== id) return { ok: false, error: "capture_cancelled" };
    const response = await chrome.runtime.sendMessage({ type: "offscreen_start_capture", tabId, streamId, captureId: id });
    if (captureId !== id) return { ok: false, error: "capture_cancelled" };
    if (!response?.ok) {
      await stopCapture("capture_error");
      return { ok: false, error: "capture_error" };
    }
    capturedTabId = tabId;
    pendingTabId = undefined;
    capturedProvider = provider;
    latestFeatures = inactiveFeatureState();
    updatePrompts();
    publishSelectedPlayback();
    return { ok: true };
  } catch {
    if (captureId === id) await stopCapture("capture_error");
    return { ok: false, error: "capture_error" };
  }
}

async function stopCapture(reason: CaptureStopReason): Promise<void> {
  const id = captureId;
  if (!id) return;
  finishCapture(reason, true);
  await chrome.runtime.sendMessage({ type: "offscreen_stop_capture", reason, captureId: id }).catch(() => undefined);
}

function finishCapture(reason: CaptureStopReason, notifyHost: boolean): void {
  if (capturedTabId === undefined && !notifyHost) return;
  captureId = undefined;
  pendingTabId = undefined;
  capturedTabId = undefined;
  capturedProvider = undefined;
  captureSiteOrigin = undefined;
  captureOrigin = undefined;
  lastCustomSoundAt = 0;
  lastCustomPublicationAt = 0;
  lastCustomPlaying = false;
  latestFeatures = inactiveFeatureState();
  updatePrompts();
  if (notifyHost) sendNative({ ...baseMessage(), type: "capture_stopped", reason });
  publishSelectedPlayback();
}

function isFeatureSnapshot(value: unknown): value is FeatureSnapshot {
  if (!value || typeof value !== "object") return false;
  const fields = value as Record<string, unknown>;
  const unitFields = ["energy01", "beatConfidence01", "beatPhase01", "onsetDensity01"];
  const allowed = [...unitFields, "bpm", "beatPulse", "sectionIntensity"];
  return Object.keys(fields).every(key => allowed.includes(key)) &&
    unitFields.every(key => typeof fields[key] === "number" && Number.isFinite(fields[key]) &&
      (fields[key] as number) >= 0 && (fields[key] as number) <= 1) &&
    typeof fields.bpm === "number" && Number.isFinite(fields.bpm) && fields.bpm >= 0 && fields.bpm <= 400 &&
    typeof fields.beatPulse === "boolean" &&
    ["unknown", "low", "medium", "high"].includes(String(fields.sectionIntensity));
}

function receiveFeatures(features: FeatureSnapshot): void {
  if (capturedTabId === undefined || !capturedProvider) return;
  latestFeatures = features;
  if (capturedProvider === "custom_site") {
    const now = Date.now();
    if (features.energy01 >= 0.005) lastCustomSoundAt = now;
    const playing = lastCustomSoundAt > 0 && now - lastCustomSoundAt < 1_000;
    if (playing !== lastCustomPlaying || now - lastCustomPublicationAt >= 2_000) {
      lastCustomPlaying = playing;
      lastCustomPublicationAt = now;
      publishSelectedPlayback();
    }
  }
  sendNative({
    ...baseMessage(),
    type: "music_features",
    provider: capturedProvider,
    ...features
  });
}

function baseMessage() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sequence: ++sequence,
    emittedAtUnixMs: Date.now(),
    browserSessionId
  } as const;
}

function ensureNativePort(): void {
  if (nativePort) return;
  try {
    const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    nativePort = port;
    port.onMessage.addListener(message => {
      if (nativePort !== port) return;
      if ((message as HostStatusMessage).type === "host_status") {
        const wasReady = bridgeReady();
        hostStatus = message as HostStatusMessage;
        if (!bridgeReady()) void stopCapture("user");
        if (wasReady !== bridgeReady()) updatePrompts();
      }
    });
    port.onDisconnect.addListener(() => {
      if (nativePort !== port) return;
      nativePort = undefined;
      hostStatus = { ...hostStatus, phasePalConnected: false, errorCode: "phasepal_unavailable" };
      void stopCapture("user");
      updatePrompts();
      scheduleReconnect();
    });
    sendNative({
      ...baseMessage(),
      type: "hello",
      extensionVersion: chrome.runtime.getManifest().version
    });
    publishSelectedPlayback();
  } catch {
    nativePort = undefined;
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    ensureNativePort();
  }, 1_500);
}

function sendNative(message: ExtensionToHostMessage): void {
  ensureNativePort();
  try { nativePort?.postMessage(message); } catch { nativePort = undefined; scheduleReconnect(); }
}

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL("src/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl]
  });
  if (contexts.length > 0) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: "src/offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Analyze a user-approved tab audio stream and keep the tab audible."
    }).finally(() => {
      creatingOffscreenDocument = undefined;
    });
  }
  await creatingOffscreenDocument;
}

async function buildPopupState(): Promise<PopupState> {
  await preferenceQueue;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeProvider = await resolvedProvider(active?.url);
  const tabState = active?.id !== undefined ? tabs.get(active.id) : undefined;
  return {
    autoBeatSync,
    captureAudioState,
    supported: Boolean(activeProvider),
    customSites: customSites.origins,
    provider: activeProvider ?? capturedProvider,
    phasePalConnected: hostStatus.phasePalConnected,
    danceToMusicEnabled: hostStatus.danceToMusicEnabled,
    playing: tabState?.playing ?? false,
    captureActive: captureId !== undefined,
    beatConfidence01: latestFeatures.beatConfidence01,
    bpm: latestFeatures.bpm,
    errorCode: hostStatus.errorCode
  };
}

function bridgeReady(): boolean {
  return hostStatus.phasePalConnected === true && hostStatus.danceToMusicEnabled === true && hostStatus.errorCode === "none";
}

function updatePrompts(): void {
  for (const tabId of tabs.keys()) {
    void chrome.tabs.sendMessage(tabId, { type: "beat_sync_prompt", show: shouldShowPrompt() }).catch(() => undefined);
  }
}

function shouldShowPrompt(): boolean {
  return preferencesLoaded && !hideBeatSyncPrompts && bridgeReady() && captureId === undefined;
}

async function resolvedProvider(url: string | undefined): Promise<MusicProvider | undefined> {
  const builtin = providerForUrl(url);
  if (builtin) return builtin;
  return await customSites.allowed(url) ? "custom_site" : undefined;
}

async function changeCustomSite(add: boolean, input: string): Promise<{ ok: boolean; error?: string }> {
  const origin = customSiteOrigin(input);
  if (!origin) return { ok: false, error: "Enter an HTTP or HTTPS website without a password or custom port." };
  if (providerForUrl(origin)) return { ok: false, error: "This music site is already included." };
  if (add) {
    await customSites.add(origin);
    const openTabs = await chrome.tabs.query({ url: customSitePattern(origin) });
    await Promise.allSettled(openTabs.filter(tab => tab.id !== undefined).map(tab =>
      chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ["assets/content.js"] })));
  } else {
    if (captureSiteOrigin === origin) await stopCapture("unsupported_navigation");
    await customSites.remove(origin);
    for (const [tabId, tab] of tabs) {
      if (tab.provider !== "custom_site" || tab.siteOrigin !== origin) continue;
      tabs.delete(tabId);
      void chrome.tabs.sendMessage(tabId, { type: "custom_site_removed" }).catch(() => undefined);
    }
    publishSelectedPlayback();
  }
  return { ok: true };
}

function normalizeStopReason(value: unknown): CaptureStopReason {
  const known: CaptureStopReason[] = ["user", "tab_closed", "unsupported_navigation", "stream_ended", "capture_error", "replaced"];
  return known.includes(value as CaptureStopReason) ? value as CaptureStopReason : "capture_error";
}

function inactiveFeatureState(): FeatureSnapshot {
  return {
    energy01: 0,
    beatConfidence01: 0,
    bpm: 0,
    beatPhase01: 0,
    beatPulse: false,
    onsetDensity01: 0,
    sectionIntensity: "unknown"
  };
}
