import { providerForUrl, type MusicProvider } from "./providers";
import { startPlaybackMonitor } from "./playback-monitor";
import { createBeatSyncPrompt } from "./beat-sync-prompt";

// Dynamic registration and immediate injection can overlap. Replace the previous owner.
const contentGlobal = globalThis as typeof globalThis & { phasePalMusicCleanup?: () => void };
try { contentGlobal.phasePalMusicCleanup?.(); } catch { /* A previous extension context can be invalid after reload. */ }
let disposed = false;
const beatSyncPrompt = createBeatSyncPrompt(async () => {
  const reply = await chrome.runtime.sendMessage({ type: "hide_beat_sync_prompts" });
  return reply?.ok === true;
}, chrome.runtime.getURL("icons/icon-128.png"));
let stopMonitor: (() => void) | undefined;
let provider: MusicProvider | undefined = providerForUrl(location.href);
function dispose(): void {
  if (disposed) return;
  disposed = true;
  stopMonitor?.();
  beatSyncPrompt.dispose();
  chrome.runtime.onMessage.removeListener(onMessage);
}
function onMessage(message: unknown, sender: chrome.runtime.MessageSender): void {
  if (disposed || sender.id !== chrome.runtime.id || sender.tab ||
    (sender.url !== undefined && sender.url !== chrome.runtime.getURL("assets/background.js"))) return;
  const candidate = message as { type?: string; show?: boolean } | null;
  if (candidate?.type === "custom_site_removed" && provider === "custom_site") dispose();
  if (candidate?.type === "beat_sync_prompt" && provider && typeof candidate.show === "boolean") beatSyncPrompt.update(candidate.show);
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
