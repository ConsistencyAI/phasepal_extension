import type { MusicProvider } from "./protocol";

export interface MusicSourceState {
  tabId: number;
  provider: MusicProvider;
  playing: boolean;
  lastStartedAt: number;
}

export function selectMusicSource<T extends MusicSourceState>(
  sources: Iterable<T>,
  capturedTabId?: number
): T | undefined {
  const list = [...sources];
  if (capturedTabId !== undefined) {
    const captured = list.find(source => source.tabId === capturedTabId);
    if (captured) return captured;
  }
  return list
    .filter(source => source.playing)
    .sort((a, b) => b.lastStartedAt - a.lastStartedAt)[0];
}
