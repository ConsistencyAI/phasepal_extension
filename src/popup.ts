import { providerForUrl, type PopupState } from "./protocol";
import { MUSIC_PROVIDERS, providerName } from "./providers";
import { customSiteOrigin, customSitePattern } from "./custom-sites";

const statusDot = requireElement("status-dot");
const statusTitle = requireElement("status-title");
const statusDetail = requireElement("status-detail");
const providerLabel = requireElement("provider");
const metrics = requireElement("metrics");
const bpmLabel = requireElement("bpm");
const confidenceLabel = requireElement("confidence");
const button = requireElement("capture-button") as HTMLButtonElement;
const buttonLabel = requireElement("button-label");
const autoSync = requireElement("auto-beat-sync") as HTMLInputElement;
let preferencePending = false;
autoSync.addEventListener("change", async () => {
  preferencePending = true;
  autoSync.disabled = true;
  try {
    const reply = await chrome.runtime.sendMessage({ type: "set_auto_beat_sync", enabled: autoSync.checked });
    if (!reply?.ok) showTransientError("Could not save Auto Beat Sync. Try again.");
  } catch { showTransientError("Could not save Auto Beat Sync. Try again."); }
  finally { preferencePending = false; autoSync.disabled = false; await refresh(); }
});
requireElement("supported-sites").textContent = MUSIC_PROVIDERS.map(provider => provider.name).join(" · ");
let state: PopupState | undefined;
let actionPending = false;
let autoStartAttempted = false;
let transientError = "";
let transientErrorUntil = 0;
let siteActionPending = false;
let renderedSites = "";
const siteInput = requireElement("site-url") as HTMLInputElement;
const siteFeedback = requireElement("site-feedback");
const addSiteButton = requireElement("add-site") as HTMLButtonElement;

requireElement("site-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (siteActionPending) return;
  const origin = customSiteOrigin(siteInput.value);
  if (!origin) { siteFeedback.textContent = "Enter an HTTP or HTTPS website without a password or custom port."; return; }
  if (providerForUrl(origin)) { siteFeedback.textContent = "This music site is already included."; return; }
  siteActionPending = true;
  addSiteButton.disabled = true;
  try {
    // Keep this request directly in the submit gesture; do not await a background round trip first.
    const granted = await chrome.permissions.request({ origins: [customSitePattern(origin)] });
    if (!granted) { siteFeedback.textContent = "Website access was not granted."; return; }
    const reply = await chrome.runtime.sendMessage({ type: "add_custom_site", origin });
    if (!reply?.ok) { siteFeedback.textContent = String(reply?.error ?? "Could not add this website."); return; }
    siteInput.value = "";
    siteFeedback.textContent = "Website added. Play audio there, then enable Beat Sync. Refresh the tab if needed.";
  } catch { siteFeedback.textContent = "Could not add this website. Check Chrome's site access settings."; }
  finally { siteActionPending = false; addSiteButton.disabled = false; await refresh(); }
});

requireElement("custom-sites").addEventListener("click", async event => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.dataset.origin || siteActionPending) return;
  siteActionPending = true;
  target.disabled = true;
  try {
    const reply = await chrome.runtime.sendMessage({ type: "remove_custom_site", origin: target.dataset.origin });
    siteFeedback.textContent = reply?.ok ? "Website removed. Its playback monitoring and Beat Sync have stopped." : "Could not remove this website.";
  } catch { siteFeedback.textContent = "Could not remove this website."; }
  finally { siteActionPending = false; target.disabled = false; await refresh(); }
});

void refresh();
const refreshTimer = window.setInterval(() => void refresh(), 500);
window.addEventListener("unload", () => clearInterval(refreshTimer), { once: true });

button.addEventListener("click", () => { void toggleCapture(); });

async function toggleCapture(): Promise<void> {
  if (!state || actionPending) return;
  autoStartAttempted = true;
  actionPending = true;
  try {
    transientError = "";
    transientErrorUntil = 0;
    button.disabled = true;
    if (state.captureActive) {
      await chrome.runtime.sendMessage({ type: "stop_capture" });
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const origin = customSiteOrigin(tab?.url);
      if (tab?.id === undefined || (!providerForUrl(tab.url) && (!origin || !state.customSites?.includes(origin)))) return;
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
  } catch {
    showTransientError("The extension service is not ready.");
  } finally {
    actionPending = false;
    await refresh();
  }
}

async function refresh(): Promise<void> {
  try {
    state = await chrome.runtime.sendMessage({ type: "get_popup_state" }) as PopupState;
    if (transientError && Date.now() < transientErrorUntil) {
      renderError(transientError);
      return;
    }
    render(state);
    // Opening the extension is the Chrome invocation. Never retry capture from
    // polling, a page message, or after a user Stop in this popup session.
    if (!autoStartAttempted && !actionPending && state.autoBeatSync && !state.captureActive
      && state.supported && state.phasePalConnected && state.danceToMusicEnabled
      && state.errorCode === "none" && (state.playing || state.provider === "custom_site")) {
      void toggleCapture();
    }
  } catch {
    renderError("The extension service is not ready.");
  } finally {
    if (actionPending) button.disabled = true;
  }
}

function showTransientError(detail: string): void {
  transientError = detail;
  transientErrorUntil = Date.now() + 5_000;
  renderError(detail);
}

function render(next: PopupState): void {
  if (!preferencePending) autoSync.checked = next.autoBeatSync === true;
  renderCustomSites(next.customSites ?? []);
  statusDot.className = "status-dot";
  providerLabel.textContent = providerName(next.provider);
  button.classList.toggle("stopping", next.captureActive);
  buttonLabel.textContent = next.captureActive ? "Stop Beat Sync" : "Enable Beat Sync";
  metrics.hidden = !next.captureActive;
  bpmLabel.textContent = next.bpm >= 1 ? Math.round(next.bpm).toString() : "—";
  confidenceLabel.textContent = next.captureActive ? `${Math.round(next.beatConfidence01 * 100)}%` : "—";

  if (next.captureActive) {
    if (next.captureAudioState === "no_frames" || next.captureAudioState === "suspended") {
      statusDot.classList.add("warning");
      statusTitle.textContent = "Waiting for tab audio";
      statusDetail.textContent = "Audio analysis is not receiving samples. Stop Beat Sync, then enable it again on the playing tab.";
      button.disabled = false;
      return;
    }
    if (next.captureAudioState === "silent") {
      statusDot.classList.add("warning");
      statusTitle.textContent = next.playing ? "Captured audio is silent" : "Paused — Beat Sync stays ready";
      statusDetail.textContent = "Play music in the captured tab. BPM and beat lock need audible rhythm.";
      button.disabled = false;
      return;
    }
    statusDot.classList.add(next.beatConfidence01 >= 0.55 ? "active" : "warning");
    statusTitle.textContent = next.beatConfidence01 >= 0.55 ? "Beat sync active" : "Listening for the beat";
    statusDetail.textContent = next.beatConfidence01 >= 0.55
      ? "The avatar can now match tempo and beat phase."
      : "Keep the music playing while the rhythm locks.";
    button.disabled = false;
    return;
  }
  if (!next.supported) {
    statusTitle.textContent = "Choose a music website";
    statusDetail.textContent = "Use a music site below, or add a custom website.";
    button.disabled = true;
    return;
  }
  if (!next.phasePalConnected) {
    statusDot.classList.add("warning");
    statusTitle.textContent = "Phase Pal is unavailable";
    statusDetail.textContent = "Open Phase Pal and enable Dance to Music in Settings → Avatar → Behavior.";
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
  if (next.provider === "custom_site") {
    statusTitle.textContent = next.playing ? "Website audio detected" : "Custom website ready";
    statusDetail.textContent = "Play audio, then enable Beat Sync. Speech and ads can also trigger dancing.";
  }
  button.disabled = !next.playing && next.provider !== "custom_site";
}

function renderCustomSites(origins: string[]): void {
  const fingerprint = JSON.stringify(origins);
  if (fingerprint === renderedSites) return;
  renderedSites = fingerprint;
  const list = requireElement("custom-sites");
  list.replaceChildren();
  for (const origin of origins) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = origin;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${origin}`);
    remove.dataset.origin = origin;
    item.append(name, remove);
    list.append(item);
  }
}

function renderError(detail: string): void {
  statusDot.className = "status-dot warning";
  statusTitle.textContent = "Beat sync could not start";
  statusDetail.textContent = detail;
  button.disabled = false;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element;
}
