import { providerForUrl, type ProviderPlaybackUpdate, type FeatureSnapshot, type HostStatusMessage } from "./protocol";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function finiteRange(value: unknown, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

export function isExtensionPage(sender: chrome.runtime.MessageSender, path: string): boolean {
  return sender.id === chrome.runtime.id && !sender.tab && sender.url === chrome.runtime.getURL(path);
}

export function isBackground(sender: chrome.runtime.MessageSender): boolean {
  return isExtensionPage(sender, "assets/background.js");
}

function isProviderSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined || (sender.frameId ?? 0) !== 0 || !sender.url) return false;
  try { return !sender.origin || sender.origin === new URL(sender.url).origin; } catch { return false; }
}

export function providerFromSender(sender: chrome.runtime.MessageSender) {
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined || (sender.frameId ?? 0) !== 0) return undefined;
  const provider = providerForUrl(sender.url);
  if (!provider || (sender.origin && sender.origin !== new URL(sender.url!).origin)) return undefined;
  return provider;
}

export function isPlaybackUpdate(value: Record<string, unknown>, sender: chrome.runtime.MessageSender, resolvedProvider = providerFromSender(sender)): value is ProviderPlaybackUpdate & Record<string, unknown> {
  return exactKeys(value, ["type", "provider", "playing", "hasTitle", "hasArtist", "hasTimeline", "emittedAtUnixMs"])
    && value.type === "provider_playback" && value.provider === resolvedProvider
    && resolvedProvider !== undefined && isProviderSender(sender)
    && [value.playing, value.hasTitle, value.hasArtist, value.hasTimeline].every(v => typeof v === "boolean")
    && finiteRange(value.emittedAtUnixMs, Number.MAX_SAFE_INTEGER);
}

export function isFeatureSnapshot(value: unknown): value is FeatureSnapshot {
  return isRecord(value) && exactKeys(value, ["energy01", "beatConfidence01", "bpm", "beatPhase01", "beatPulse", "onsetDensity01", "sectionIntensity"])
    && [value.energy01, value.beatConfidence01, value.beatPhase01, value.onsetDensity01].every(v => finiteRange(v, 1))
    && finiteRange(value.bpm, 400) && typeof value.beatPulse === "boolean"
    && ["unknown", "low", "medium", "high"].includes(String(value.sectionIntensity));
}

export function isHostStatus(value: unknown): value is HostStatusMessage {
  return isRecord(value) && exactKeys(value, value.protocolVersion === 2 ? ["type", "protocolVersion", "phasePalConnected", "danceToMusicEnabled", "errorCode", "lyricsRequested"] : ["type", "protocolVersion", "phasePalConnected", "danceToMusicEnabled", "errorCode"])
    && value.type === "host_status" && (value.protocolVersion === 1 || value.protocolVersion === 2)
    && (value.protocolVersion !== 2 || typeof value.lyricsRequested === "boolean")
    && typeof value.phasePalConnected === "boolean" && typeof value.danceToMusicEnabled === "boolean"
    && ["none", "phasepal_unavailable", "protocol_mismatch", "busy", "invalid_message"].includes(String(value.errorCode));
}

export function isLyricsUpdate(value: Record<string, unknown>, sender: chrome.runtime.MessageSender, resolvedProvider = providerFromSender(sender)): boolean {
  const fields = ["type", "provider", "sourceId", "trackId", "title", "artist", "durationMs", "positionMs", "playbackRate", "playing", "buffering", "available", "emittedAtUnixMs"];
  return exactKeys(value, fields) && value.type === "provider_lyrics"
    && resolvedProvider !== undefined && isProviderSender(sender) && value.provider === resolvedProvider
    && [value.sourceId, value.trackId].every(v => typeof v === "string" && v.length > 0 && v.length <= 128)
    && [value.title, value.artist].every(v => typeof v === "string" && v.length <= 256)
    && [value.durationMs, value.positionMs].every(v => finiteRange(v, 86_400_000))
    && Number(value.positionMs) <= Number(value.durationMs)
    && typeof value.playbackRate === "number" && value.playbackRate >= 0.1 && value.playbackRate <= 16
    && [value.playing, value.buffering, value.available].every(v => typeof v === "boolean")
    && (value.available !== true || (Number(value.durationMs) > 0 && String(value.title).trim().length > 0 && String(value.artist).trim().length > 0))
    && finiteRange(value.emittedAtUnixMs, Number.MAX_SAFE_INTEGER);
}
