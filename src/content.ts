import { providerForUrl, type MusicProvider } from "./providers";
import { startPlaybackMonitor } from "./playback-monitor";

// Dynamic registration and immediate injection can overlap. Replace the previous owner.
const contentGlobal = globalThis as typeof globalThis & { phasePalMusicCleanup?: () => void };
try { contentGlobal.phasePalMusicCleanup?.(); } catch { /* A previous extension context can be invalid after reload. */ }
let disposed = false;
let stopMonitor: (() => void) | undefined;
let provider: MusicProvider | undefined = providerForUrl(location.href);
function dispose(): void {
  if (disposed) return;
  disposed = true;
  stopMonitor?.();
  chrome.runtime.onMessage.removeListener(onMessage);
}
function onMessage(message: unknown, sender: chrome.runtime.MessageSender): void {
  if (sender.id !== chrome.runtime.id || sender.tab || provider !== "custom_site") return;
  if ((message as { type?: string } | null)?.type === "custom_site_removed") dispose();
}
contentGlobal.phasePalMusicCleanup = dispose;
chrome.runtime.onMessage.addListener(onMessage);
if (provider) stopMonitor = startPlaybackMonitor(provider, dispose);
else {
  void chrome.runtime.sendMessage({ type: "get_site_provider" }).then(reply => {
    if (disposed || reply?.provider !== "custom_site") return;
    provider = "custom_site";
    stopMonitor = startPlaybackMonitor(provider, dispose);
  }).catch(dispose);
}
