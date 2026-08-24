import { providerForUrl, type PopupState } from "./protocol";

const statusDot = requireElement("status-dot");
const statusTitle = requireElement("status-title");
const statusDetail = requireElement("status-detail");
const providerLabel = requireElement("provider");
const metrics = requireElement("metrics");
const bpmLabel = requireElement("bpm");
const confidenceLabel = requireElement("confidence");
const button = requireElement("capture-button") as HTMLButtonElement;
const buttonLabel = requireElement("button-label");
let state: PopupState | undefined;
let transientError = "";
let transientErrorUntil = 0;

void refresh();
const refreshTimer = window.setInterval(() => void refresh(), 500);
window.addEventListener("unload", () => clearInterval(refreshTimer), { once: true });

button.addEventListener("click", async () => {
  if (!state) return;
  transientError = "";
  transientErrorUntil = 0;
  button.disabled = true;
  if (state.captureActive) {
    await chrome.runtime.sendMessage({ type: "stop_capture" });
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined || !providerForUrl(tab.url)) return;
    try {
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      const response = await chrome.runtime.sendMessage({ type: "begin_capture", tabId: tab.id, streamId });
      if (!response?.ok) {
        showTransientError(String(response?.error ?? "Chrome could not start tab capture."));
        return;
      }
    } catch (error) {
      showTransientError(error instanceof Error ? error.message : "Chrome could not start tab capture.");
      return;
    }
  }
  await refresh();
});

async function refresh(): Promise<void> {
  try {
    state = await chrome.runtime.sendMessage({ type: "get_popup_state" }) as PopupState;
    if (transientError && Date.now() < transientErrorUntil) {
      renderError(transientError);
      return;
    }
    render(state);
  } catch {
    renderError("The extension service is not ready.");
  }
}

function showTransientError(detail: string): void {
  transientError = detail;
  transientErrorUntil = Date.now() + 5_000;
  renderError(detail);
}

function render(next: PopupState): void {
  statusDot.className = "status-dot";
  providerLabel.textContent = providerName(next.provider);
  button.classList.toggle("stopping", next.captureActive);
  buttonLabel.textContent = next.captureActive ? "Stop Beat Sync" : "Enable Beat Sync";
  metrics.hidden = !next.captureActive;
  bpmLabel.textContent = next.bpm >= 1 ? Math.round(next.bpm).toString() : "—";
  confidenceLabel.textContent = next.captureActive ? `${Math.round(next.beatConfidence01 * 100)}%` : "—";

  if (next.captureActive) {
    statusDot.classList.add(next.beatConfidence01 >= 0.55 ? "active" : "warning");
    statusTitle.textContent = next.beatConfidence01 >= 0.55 ? "Beat sync active" : "Listening for the beat";
    statusDetail.textContent = next.beatConfidence01 >= 0.55
      ? "The avatar can now match tempo and beat phase."
      : "Keep the music playing while the rhythm locks.";
    button.disabled = false;
    return;
  }
  if (!next.supported) {
    statusTitle.textContent = "Open a supported music site";
    statusDetail.textContent = "Use Spotify Web, YouTube Music, or SoundCloud.";
    button.disabled = true;
    return;
  }
  if (!next.phasePalConnected) {
    statusDot.classList.add("warning");
    statusTitle.textContent = "Phase Pal is unavailable";
    statusDetail.textContent = "Open Phase Pal and check the native host setup.";
    button.disabled = true;
    return;
  }
  if (!next.danceToMusicEnabled) {
    statusDot.classList.add("warning");
    statusTitle.textContent = "Dance to Music is off";
    statusDetail.textContent = "Turn it on in Phase Pal settings.";
    button.disabled = true;
    return;
  }
  statusDot.classList.add("ready");
  statusTitle.textContent = next.playing ? "Music detected" : "Ready for music";
  statusDetail.textContent = next.playing
    ? "The avatar can dance now. Enable sync for beat timing."
    : "Start playback, then enable beat sync.";
  button.disabled = !next.playing;
}

function renderError(detail: string): void {
  statusDot.className = "status-dot warning";
  statusTitle.textContent = "Beat sync could not start";
  statusDetail.textContent = detail;
  button.disabled = false;
}

function providerName(provider: PopupState["provider"]): string {
  if (provider === "spotify_web") return "Spotify Web";
  if (provider === "youtube_music") return "YouTube Music";
  if (provider === "soundcloud") return "SoundCloud";
  return "Phase Pal browser bridge";
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element;
}
