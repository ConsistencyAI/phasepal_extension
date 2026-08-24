import { shouldPublishPlayback } from "./playback-publication";

type Provider = "spotify_web" | "youtube_music" | "soundcloud";

interface PlaybackUpdate {
  type: "provider_playback";
  provider: Provider;
  playing: boolean;
  hasTitle: boolean;
  hasArtist: boolean;
  hasTimeline: boolean;
  emittedAtUnixMs: number;
}

const provider = resolveProvider(location.hostname);
let currentMedia: HTMLMediaElement | null = null;
let lastFingerprint = "";
let heartbeat: number | undefined;

if (provider) {
  bindMedia();
  const observer = new MutationObserver(() => bindMedia());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => {
    stopHeartbeat();
    void chrome.runtime.sendMessage({ type: "provider_unloaded", provider });
  }, { once: true });
}

function resolveProvider(hostname: string): Provider | undefined {
  const normalized = hostname.toLowerCase();
  if (normalized === "open.spotify.com") return "spotify_web";
  if (normalized === "music.youtube.com") return "youtube_music";
  if (normalized === "soundcloud.com" || normalized.endsWith(".soundcloud.com")) return "soundcloud";
  return undefined;
}

function bindMedia(): void {
  const media = chooseMedia();
  if (media !== currentMedia) {
    detachMedia(currentMedia);
    currentMedia = media;
    attachMedia(currentMedia);
  }
  publish();
}

function chooseMedia(): HTMLMediaElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video"));
  return candidates.find(media => !media.paused && !media.ended)
    ?? candidates.find(media => media.readyState > 0)
    ?? null;
}

function attachMedia(media: HTMLMediaElement | null): void {
  if (!media) return;
  for (const event of ["play", "playing", "pause", "ended", "durationchange", "emptied"]) {
    media.addEventListener(event, publish);
  }
}

function detachMedia(media: HTMLMediaElement | null): void {
  if (!media) return;
  for (const event of ["play", "playing", "pause", "ended", "durationchange", "emptied"]) {
    media.removeEventListener(event, publish);
  }
}

function publish(): void {
  publishPlayback(false);
}

function publishPlayback(force: boolean): void {
  if (!provider) return;
  const playing = Boolean(currentMedia && !currentMedia.paused && !currentMedia.ended);
  const mediaMetadata = navigator.mediaSession?.metadata;
  const metadata = resolveMetadataPresence(provider, mediaMetadata);
  const hasTimeline = Boolean(
    currentMedia && Number.isFinite(currentMedia.duration) && currentMedia.duration > 0
  );
  const fingerprint = [playing, metadata.hasTitle, metadata.hasArtist, hasTimeline].join(":");
  if (!shouldPublishPlayback(lastFingerprint, fingerprint, force)) return;
  lastFingerprint = fingerprint;
  const update: PlaybackUpdate = {
    type: "provider_playback",
    provider,
    playing,
    hasTitle: metadata.hasTitle,
    hasArtist: metadata.hasArtist,
    hasTimeline,
    emittedAtUnixMs: Date.now()
  };
  void chrome.runtime.sendMessage(update).catch(() => undefined);
  if (playing) startHeartbeat(); else stopHeartbeat();
}

function startHeartbeat(): void {
  if (heartbeat !== undefined) return;
  heartbeat = window.setInterval(() => {
    publishPlayback(true);
  }, 2_000);
}

function stopHeartbeat(): void {
  if (heartbeat === undefined) return;
  clearInterval(heartbeat);
  heartbeat = undefined;
}

function resolveMetadataPresence(
  musicProvider: Provider,
  metadata: MediaMetadata | null | undefined
): { hasTitle: boolean; hasArtist: boolean } {
  if (metadata?.title || metadata?.artist) {
    return { hasTitle: Boolean(metadata.title?.trim()), hasArtist: Boolean(metadata.artist?.trim()) };
  }
  const selectors: Record<Provider, { title: string; artist: string }> = {
    spotify_web: {
      title: "[data-testid='context-item-link']",
      artist: "[data-testid='context-item-info-artist']"
    },
    youtube_music: {
      title: "ytmusic-player-bar .title",
      artist: "ytmusic-player-bar .byline"
    },
    soundcloud: {
      title: ".playbackSoundBadge__title",
      artist: ".playbackSoundBadge__lightLink"
    }
  };
  const selected = selectors[musicProvider];
  return {
    hasTitle: Boolean(document.querySelector(selected.title)?.textContent?.trim()),
    hasArtist: Boolean(document.querySelector(selected.artist)?.textContent?.trim())
  };
}
