import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PopupState } from "../src/protocol";

let popupState: PopupState;
let request: ReturnType<typeof vi.fn>;
let sendMessage: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = new DOMParser().parseFromString(readFileSync("src/popup.html", "utf8"), "text/html").body.innerHTML;
  popupState = { autoBeatSync: false, supported: false, customSites: [], phasePalConnected: true, danceToMusicEnabled: true,
    playing: false, captureActive: false, beatConfidence01: 0, bpm: 0, errorCode: "none" };
  request = vi.fn().mockResolvedValue(true);
  sendMessage = vi.fn(async message => {
    if (message.type === "get_popup_state") return { ...popupState };
    if (message.type === "set_auto_beat_sync") popupState.autoBeatSync = message.enabled;
    if (message.type === "begin_capture") popupState.captureActive = true;
    if (message.type === "stop_capture") popupState.captureActive = false;
    if (message.type === "add_custom_site") {
      popupState = { ...popupState, supported: true, provider: "custom_site", customSites: [message.origin] };
    }
    if (message.type === "remove_custom_site") popupState = { ...popupState, supported: false, provider: undefined, customSites: [] };
    return { ok: true };
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage }, permissions: { request },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 4, url: "https://radio.example/live" }]) },
    tabCapture: { getMediaStreamId: vi.fn().mockResolvedValue("stream") } });
  await import("../src/popup");
  await vi.advanceTimersByTimeAsync(0);
});
afterEach(() => { window.dispatchEvent(new Event("unload")); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function addWebsite() {
  (document.getElementById("site-url") as HTMLInputElement).value = "https://radio.example/live?private=token";
  document.getElementById("site-form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await vi.advanceTimersByTimeAsync(0);
}

it("saves Auto Beat Sync and retains its checked state on refresh without capturing", async () => {
  const toggle = document.getElementById("auto-beat-sync") as HTMLInputElement;
  toggle.checked = true;
  toggle.dispatchEvent(new Event("change"));
  await vi.advanceTimersByTimeAsync(500);
  expect(sendMessage).toHaveBeenCalledWith({ type: "set_auto_beat_sync", enabled: true });
  expect(toggle.checked).toBe(true);
  expect(sendMessage.mock.calls.some(([message]) => message.type === "begin_capture")).toBe(false);
});

it("starts saved Auto Beat Sync once and changes Enable to Stop without restarting after Stop", async () => {
  popupState = { ...popupState, autoBeatSync: true, supported: true, provider: "custom_site", customSites: ["https://radio.example"] };
  await vi.advanceTimersByTimeAsync(500);
  expect(document.getElementById("button-label")?.textContent).toBe("Stop Beat Sync");
  expect(sendMessage.mock.calls.filter(([message]) => message.type === "begin_capture")).toHaveLength(1);
  document.getElementById("capture-button")!.click();
  await vi.advanceTimersByTimeAsync(1_000);
  expect(document.getElementById("button-label")?.textContent).toBe("Enable Beat Sync");
  expect(sendMessage.mock.calls.filter(([message]) => message.type === "begin_capture")).toHaveLength(1);
});

it("shows Stop for existing capture and never requests a second stream", async () => {
  popupState = { ...popupState, autoBeatSync: true, captureActive: true };
  await vi.advanceTimersByTimeAsync(1_000);
  expect(document.getElementById("button-label")?.textContent).toBe("Stop Beat Sync");
  expect(chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
});

it("does not repeat a denied automatic capture request on popup polling", async () => {
  vi.mocked(chrome.tabCapture.getMediaStreamId).mockRejectedValue(new Error("Capture needs a new click."));
  popupState = { ...popupState, autoBeatSync: true, supported: true, provider: "custom_site", customSites: ["https://radio.example"] };
  await vi.advanceTimersByTimeAsync(6_000);
  expect(chrome.tabCapture.getMediaStreamId).toHaveBeenCalledOnce();
  expect(sendMessage.mock.calls.some(([message]) => message.type === "begin_capture")).toBe(false);
});

it.each(["no_frames", "suspended"] as const)("explains %s audio instead of displaying a beat-lock wait", async captureAudioState => {
  popupState = { ...popupState, captureActive: true, captureAudioState };
  await vi.advanceTimersByTimeAsync(500);
  expect(document.getElementById("status-title")?.textContent).toBe("Waiting for tab audio");
  expect(document.getElementById("status-detail")?.textContent).toContain("not receiving samples");
  expect((document.getElementById("capture-button") as HTMLButtonElement).disabled).toBe(false);
});

it("adds an exact website, enables explicit capture without DOM playback, then removes it", async () => {
  await addWebsite();
  expect(request).toHaveBeenCalledWith({ origins: ["https://radio.example/*"] });
  expect(sendMessage).toHaveBeenCalledWith({ type: "add_custom_site", origin: "https://radio.example" });
  const remove = document.querySelector<HTMLButtonElement>("#custom-sites button")!;
  expect(remove.getAttribute("aria-label")).toBe("Remove https://radio.example");
  const capture = document.getElementById("capture-button") as HTMLButtonElement;
  expect(capture.disabled).toBe(false);
  capture.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(sendMessage).toHaveBeenCalledWith({ type: "begin_capture", tabId: 4, streamId: "stream" });
  remove.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(sendMessage).toHaveBeenCalledWith({ type: "remove_custom_site", origin: "https://radio.example" });
  expect(document.querySelector("#custom-sites button")).toBeNull();
});

it("does not register a website when the Chrome permission request is denied", async () => {
  request.mockResolvedValue(false);
  await addWebsite();
  expect(sendMessage.mock.calls.some(([message]) => message.type === "add_custom_site")).toBe(false);
  expect(document.getElementById("site-feedback")!.textContent).toBe("Website access was not granted.");
});
