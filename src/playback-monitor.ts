import type { ProviderLyricsUpdate } from "./protocol";
import { shouldPublishPlayback } from "./playback-publication";
import { metadataSelectorsForProvider, type MusicProvider } from "./providers";

/** Observe one document; disposal releases every listener, observer and timer. */
export function startPlaybackMonitor(provider: MusicProvider, onRejected: () => void): (() => void) & { setLyricsRequested(enabled: boolean): void } {
  interface PlaybackUpdate {
    type: "provider_playback";
    provider: MusicProvider;
    playing: boolean;
    hasTitle: boolean;
    hasArtist: boolean;
    hasTimeline: boolean;
    emittedAtUnixMs: number;
  }

  const mediaElements = new Set<HTMLMediaElement>();
  const mediaEvents = ["play", "playing", "pause", "ended", "durationchange", "emptied", "loadedmetadata", "loadeddata", "abort", "error", "seeking", "seeked", "waiting", "stalled", "ratechange"];
  let currentMedia: HTMLMediaElement | undefined;
  let lastFingerprint = "";
  let heartbeat: number | undefined;
  let discoveryPoll: number | undefined;
  let domEvidencePresent = false;
  let mediaSessionBlocked = false;
  let lastMediaSessionState: MediaSessionPlaybackState = "none";
  let usingMediaSession = false;
  const genericProvider = provider !== undefined && metadataSelectorsForProvider(provider) === undefined;
  let active = false;
  let lyricsRequested = false;
  let lyricsRequestGeneration = 0;
  let lyricsHeartbeat: number | undefined;
  let trackFingerprint = "";
  let trackId = crypto.randomUUID();
  const sourceId = crypto.randomUUID();
  const observer = new MutationObserver(records => {
    if (!active) return;
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) collectMedia(node);
    }
    for (const media of mediaElements) if (!media.isConnected) mediaElements.delete(media);
    reconcile(false);
  });

  resume();
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);

  function collectMedia(node: Node): void {
    if (!(node instanceof Element)) return;
    if (node instanceof HTMLMediaElement) mediaElements.add(node);
    for (const media of Array.from(node.querySelectorAll<HTMLMediaElement>("audio, video"))) mediaElements.add(media);
  }

  function resume(): void {
    if (active || !provider) return;
    active = true;
    lastFingerprint = "";
    collectMedia(document.documentElement);
    for (const event of mediaEvents) document.addEventListener(event, onMediaEvent, true);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    reconcile(false);
  }

  function suspend(): void {
    if (!active) return;
    active = false;
    ++lyricsRequestGeneration;
    setLyricsRequested(false);
    observer.disconnect();
    for (const event of mediaEvents) document.removeEventListener(event, onMediaEvent, true);
    stopHeartbeat();
    if (discoveryPoll !== undefined) clearInterval(discoveryPoll);
    discoveryPoll = undefined;
    usingMediaSession = false;
    mediaElements.clear();
    currentMedia = undefined;
    sendMessage({ type: "provider_unloaded", provider });
  }

  function onMediaEvent(event: Event): void {
    if (!active || !(event.target instanceof HTMLMediaElement)) return;
    if (event.target.isConnected) mediaElements.add(event.target);
    reconcile(false);
  }

  function reconcile(force: boolean): void {
    if (!active || !provider) return;
    const candidates = [...mediaElements].filter(media => media.isConnected && media.readyState > 0 && !media.error);
    // Other services use generic media signals. Require metadata before treating video as music evidence.
    const metadata = navigator.mediaSession?.metadata;
    const sessionState = navigator.mediaSession?.playbackState ?? "none";
    if (mediaSessionBlocked && sessionState === "playing" && lastMediaSessionState !== "playing") mediaSessionBlocked = false;
    lastMediaSessionState = sessionState;
    const videoAllowed = provider === "custom_site" || metadataSelectorsForProvider(provider) !== undefined || Boolean(metadata?.title?.trim() || metadata?.artist?.trim());
    const eligible = candidates.filter(media => media.tagName === "AUDIO" || videoAllowed);
    // A DOM source disappearing must not revive stale MediaSession state from that source.
    if (domEvidencePresent && eligible.length === 0) mediaSessionBlocked = true;
    domEvidencePresent = eligible.length > 0;
    const playing = eligible.filter(media => !media.paused && !media.ended);
    currentMedia = playing.find(media => media.tagName === "AUDIO") ?? playing[0] ?? eligible[0];
    usingMediaSession = genericProvider && eligible.length === 0 && !mediaSessionBlocked && sessionState === "playing" &&
      Boolean(metadata?.title?.trim() || metadata?.artist?.trim());
    publishPlayback(force);
    publishLyrics();
  }

  function publishPlayback(force: boolean): void {
    if (!provider || !active) return;
    const playing = usingMediaSession || Boolean(currentMedia && !currentMedia.paused && !currentMedia.ended);
    const metadata = currentMedia || usingMediaSession ? resolveMetadataPresence(provider, navigator.mediaSession?.metadata) : { hasTitle: false, hasArtist: false };
    const hasTimeline = Boolean(currentMedia && Number.isFinite(currentMedia.duration) && currentMedia.duration > 0);
    if (genericProvider) {
      if (discoveryPoll === undefined) discoveryPoll = window.setInterval(() => reconcile(true), 2_000);
    } else if (playing) startHeartbeat(); else stopHeartbeat();
    const fingerprint = [playing, metadata.hasTitle, metadata.hasArtist, hasTimeline].join(":");
    if (!shouldPublishPlayback(lastFingerprint, fingerprint, force && playing)) return;
    lastFingerprint = fingerprint;
    const update: PlaybackUpdate = {
      type: "provider_playback", provider, playing,
      hasTitle: metadata.hasTitle, hasArtist: metadata.hasArtist, hasTimeline,
      emittedAtUnixMs: Date.now()
    };
    sendMessage(update);
  }

  function startHeartbeat(): void {
    if (heartbeat !== undefined) return;
    heartbeat = window.setInterval(() => reconcile(true), 2_000);
  }

  function stopHeartbeat(): void {
    if (heartbeat === undefined) return;
    clearInterval(heartbeat);
    heartbeat = undefined;
  }

  function sendMessage(message: PlaybackUpdate | { type: "provider_unloaded"; provider: MusicProvider | undefined }): void {
    const requestGeneration = lyricsRequestGeneration;
    try { void chrome.runtime.sendMessage(message).then(reply => {
      if (active && message.type === "provider_playback" && requestGeneration === lyricsRequestGeneration && typeof reply?.lyricsRequested === "boolean")
        setLyricsRequested(reply.lyricsRequested);
      if (provider === "custom_site" && reply?.ok === false) onRejected();
    }).catch(() => {
      if (requestGeneration === lyricsRequestGeneration) setLyricsRequested(false);
      if (provider === "custom_site") onRejected();
    }); } catch { /* Extension can reload while a page stays open. */ }
  }

  function resolveMetadataPresence(musicProvider: MusicProvider, metadata: MediaMetadata | null | undefined): { hasTitle: boolean; hasArtist: boolean } {
    if (metadata?.title || metadata?.artist) {
      return { hasTitle: Boolean(metadata.title?.trim()), hasArtist: Boolean(metadata.artist?.trim()) };
    }
    const selectors = metadataSelectorsForProvider(musicProvider);
    if (!selectors) return { hasTitle: false, hasArtist: false };
    return {
      hasTitle: Boolean(document.querySelector(selectors.title)?.textContent?.trim()),
      hasArtist: Boolean(document.querySelector(selectors.artist)?.textContent?.trim())
    };
  }

  function setLyricsRequested(enabled: boolean): void {
    enabled = enabled && active;
    if (lyricsRequested === enabled) return;
    lyricsRequested = enabled;
    if (lyricsHeartbeat !== undefined) window.clearInterval(lyricsHeartbeat);
    lyricsHeartbeat = undefined;
    if (enabled) {
      publishLyrics();
      lyricsHeartbeat = window.setInterval(publishLyrics, 1_000);
    } else { trackFingerprint = ""; trackId = crypto.randomUUID(); }
  }

  function publishLyrics(): void {
    if (!provider || !active || !lyricsRequested) return;
    const metadata = navigator.mediaSession?.metadata;
    const selected = metadataSelectorsForProvider(provider);
    const title = (metadata?.title || (selected ? document.querySelector(selected.title)?.textContent : "") || "").trim().slice(0, 256);
    const artist = (metadata?.artist || (selected ? document.querySelector(selected.artist)?.textContent : "") || "").trim().slice(0, 256);
    const media = currentMedia;
    const durationMs = media && Number.isFinite(media.duration) && media.duration > 0 ? media.duration * 1000 : 0;
    const available = Boolean(title && artist && durationMs > 0 && durationMs <= 86_400_000 && media && Number.isFinite(media.currentTime));
    const fingerprint = [title, artist, durationMs].join("\n");
    if (fingerprint !== trackFingerprint) { trackFingerprint = fingerprint; trackId = crypto.randomUUID(); }
    const update: ProviderLyricsUpdate = {
      type: "provider_lyrics", provider, sourceId, trackId,
      title: available ? title : "", artist: available ? artist : "",
      durationMs: available ? durationMs : 0,
      positionMs: available ? Math.max(0, Math.min(durationMs, media!.currentTime * 1000)) : 0,
      playbackRate: media && Number.isFinite(media.playbackRate) && media.playbackRate >= 0.1 && media.playbackRate <= 16 ? media.playbackRate : 1,
      playing: Boolean(media && !media.paused && !media.ended),
      buffering: Boolean(media && (media.readyState < 3 || media.seeking)),
      available, emittedAtUnixMs: Date.now()
    };
    void chrome.runtime.sendMessage(update).catch(() => undefined);
  }

  const stop = () => {
    suspend();
    window.removeEventListener("pagehide", suspend);
    window.removeEventListener("pageshow", resume);
  };
  return Object.assign(stop, { setLyricsRequested: (enabled: boolean) => {
    ++lyricsRequestGeneration;
    setLyricsRequested(enabled);
  } });
}
