export const PROTOCOL_VERSION = 1 as const;
export const NATIVE_HOST_NAME = "app.phasepal.music";

export type MusicProvider = "spotify_web" | "youtube_music" | "soundcloud";
export type SectionIntensity = "unknown" | "low" | "medium" | "high";
export type CaptureStopReason =
  | "user"
  | "tab_closed"
  | "unsupported_navigation"
  | "stream_ended"
  | "capture_error"
  | "replaced";

interface MessageBase {
  protocolVersion: typeof PROTOCOL_VERSION;
  sequence: number;
  emittedAtUnixMs: number;
  browserSessionId: string;
}

export interface HelloMessage extends MessageBase {
  type: "hello";
  extensionVersion: string;
}

export interface PlaybackStateMessage extends MessageBase {
  type: "playback_state";
  provider: MusicProvider;
  playing: boolean;
  hasTitle: boolean;
  hasArtist: boolean;
  hasTimeline: boolean;
  captureActive: boolean;
}

export interface MusicFeaturesMessage extends MessageBase {
  type: "music_features";
  provider: MusicProvider;
  energy01: number;
  beatConfidence01: number;
  bpm: number;
  beatPhase01: number;
  beatPulse: boolean;
  onsetDensity01: number;
  sectionIntensity: SectionIntensity;
}

export interface CaptureStoppedMessage extends MessageBase {
  type: "capture_stopped";
  reason: CaptureStopReason;
}

export type ExtensionToHostMessage =
  | HelloMessage
  | PlaybackStateMessage
  | MusicFeaturesMessage
  | CaptureStoppedMessage;

export interface HostStatusMessage {
  type: "host_status";
  protocolVersion: number;
  phasePalConnected: boolean;
  danceToMusicEnabled: boolean;
  errorCode: "none" | "phasepal_unavailable" | "protocol_mismatch" | "busy" | "invalid_message";
}

export interface ProviderPlaybackUpdate {
  type: "provider_playback";
  provider: MusicProvider;
  playing: boolean;
  hasTitle: boolean;
  hasArtist: boolean;
  hasTimeline: boolean;
  emittedAtUnixMs: number;
}

export interface FeatureSnapshot {
  energy01: number;
  beatConfidence01: number;
  bpm: number;
  beatPhase01: number;
  beatPulse: boolean;
  onsetDensity01: number;
  sectionIntensity: SectionIntensity;
}

export interface PopupState {
  supported: boolean;
  provider?: MusicProvider;
  phasePalConnected: boolean;
  danceToMusicEnabled: boolean;
  playing: boolean;
  captureActive: boolean;
  beatConfidence01: number;
  bpm: number;
  errorCode: string;
}

export function providerForUrl(url: string | undefined): MusicProvider | undefined {
  if (!url) return undefined;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "open.spotify.com") return "spotify_web";
    if (hostname === "music.youtube.com") return "youtube_music";
    if (hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com")) return "soundcloud";
  } catch {
    return undefined;
  }
  return undefined;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}
