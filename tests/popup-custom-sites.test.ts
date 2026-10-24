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
  popupState = { supported: false, customSites: [], phasePalConnected: true, danceToMusicEnabled: true,
    playing: false, captureActive: false, beatConfidence01: 0, bpm: 0, errorCode: "none" };
  request = vi.fn().mockResolvedValue(true);
  sendMessage = vi.fn(async message => {
    if (message.type === "get_popup_state") return { ...popupState };
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
