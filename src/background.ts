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

interface TabState {
  tabId: number;
  provider: MusicProvider;
  playing: boolean;
  hasTitle: boolean;
  hasArtist: boolean;
  hasTimeline: boolean;
  lastStartedAt: number;
}

const browserSessionId = crypto.randomUUID();
const tabs = new Map<number, TabState>();
let nativePort: chrome.runtime.Port | undefined;
let sequence = 0;
let capturedTabId: number | undefined;
let capturedProvider: MusicProvider | undefined;
let latestFeatures: FeatureSnapshot = inactiveFeatureState();
let hostStatus: HostStatusMessage = {
  type: "host_status",
  protocolVersion: PROTOCOL_VERSION,
  phasePalConnected: false,
  danceToMusicEnabled: false,
  errorCode: "phasepal_unavailable"
};
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let creatingOffscreenDocument: Promise<void> | undefined;

ensureNativePort();

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const candidate = message as Record<string, unknown>;
  if (candidate.type === "provider_playback" && sender.tab?.id !== undefined) {
    updateProvider(sender.tab.id, candidate as unknown as ProviderPlaybackUpdate);
    sendResponse({ ok: true });
    return false;
  }
  if (candidate.type === "provider_unloaded" && sender.tab?.id !== undefined) {
    tabs.delete(sender.tab.id);
    if (capturedTabId === sender.tab.id) void stopCapture("unsupported_navigation");
    publishSelectedPlayback();
    sendResponse({ ok: true });
    return false;
  }
  if (candidate.type === "begin_capture") {
    void beginCapture(Number(candidate.tabId), String(candidate.streamId)).then(sendResponse);
    return true;
  }
  if (candidate.type === "stop_capture") {
    void stopCapture("user").then(() => sendResponse({ ok: true }));
    return true;
  }
  if (candidate.type === "offscreen_features") {
    receiveFeatures(candidate.features as FeatureSnapshot);
    return false;
  }
  if (candidate.type === "offscreen_capture_stopped") {
    const reason = normalizeStopReason(candidate.reason);
    finishCapture(reason, true);
    return false;
  }
  if (candidate.type === "get_popup_state") {
    sendNative({
      ...baseMessage(),
      type: "hello",
      extensionVersion: chrome.runtime.getManifest().version
    });
    void buildPopupState().then(sendResponse);
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabs.delete(tabId);
  if (capturedTabId === tabId) void stopCapture("tab_closed");
  else publishSelectedPlayback();
});

function updateProvider(tabId: number, update: ProviderPlaybackUpdate): void {
  const previous = tabs.get(tabId);
  tabs.set(tabId, {
    tabId,
    provider: update.provider,
    playing: update.playing,
    hasTitle: update.hasTitle,
    hasArtist: update.hasArtist,
    hasTimeline: update.hasTimeline,
    lastStartedAt: update.playing && !previous?.playing ? update.emittedAtUnixMs : previous?.lastStartedAt ?? 0
  });
  if (capturedTabId === tabId) capturedProvider = update.provider;
  publishSelectedPlayback();
}

function selectedTab(): TabState | undefined {
  return selectMusicSource(tabs.values(), capturedTabId);
}

function publishSelectedPlayback(): void {
  const selected = selectedTab();
  const fallbackProvider = capturedProvider ?? [...tabs.values()][0]?.provider;
  if (!selected && !fallbackProvider) return;
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
  if (!Number.isInteger(tabId) || !streamId) return { ok: false, error: "capture_error" };
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  const provider = providerForUrl(tab?.url);
  if (!provider) return { ok: false, error: "unsupported_navigation" };
  if (capturedTabId !== undefined) await stopCapture("replaced");
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ type: "offscreen_start_capture", tabId, streamId });
  if (!response?.ok) return { ok: false, error: String(response?.error ?? "capture_error") };
  capturedTabId = tabId;
  capturedProvider = provider;
  latestFeatures = inactiveFeatureState();
  publishSelectedPlayback();
  return { ok: true };
}

async function stopCapture(reason: CaptureStopReason): Promise<void> {
  if (capturedTabId === undefined) return;
  await chrome.runtime.sendMessage({ type: "offscreen_stop_capture", reason }).catch(() => undefined);
  finishCapture(reason, true);
}

function finishCapture(reason: CaptureStopReason, notifyHost: boolean): void {
  if (capturedTabId === undefined && !notifyHost) return;
  capturedTabId = undefined;
  capturedProvider = undefined;
  latestFeatures = inactiveFeatureState();
  if (notifyHost) sendNative({ ...baseMessage(), type: "capture_stopped", reason });
  publishSelectedPlayback();
}

function receiveFeatures(features: FeatureSnapshot): void {
  if (capturedTabId === undefined || !capturedProvider) return;
  latestFeatures = features;
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
      if ((message as HostStatusMessage).type === "host_status") {
        hostStatus = message as HostStatusMessage;
      }
    });
    port.onDisconnect.addListener(() => {
      if (nativePort !== port) return;
      nativePort = undefined;
      hostStatus = { ...hostStatus, phasePalConnected: false, errorCode: "phasepal_unavailable" };
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
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeProvider = providerForUrl(active?.url);
  const tabState = active?.id !== undefined ? tabs.get(active.id) : undefined;
  return {
    supported: Boolean(activeProvider),
    provider: activeProvider ?? capturedProvider,
    phasePalConnected: hostStatus.phasePalConnected,
    danceToMusicEnabled: hostStatus.danceToMusicEnabled,
    playing: tabState?.playing ?? false,
    captureActive: capturedTabId !== undefined,
    beatConfidence01: latestFeatures.beatConfidence01,
    bpm: latestFeatures.bpm,
    errorCode: hostStatus.errorCode
  };
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
