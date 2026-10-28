import { afterEach, expect, it, vi } from "vitest";
import { createBeatSyncPrompt } from "../src/beat-sync-prompt";

afterEach(() => document.documentElement.querySelectorAll("div").forEach(element => {
  if (element.shadowRoot) element.remove();
}));

function panel() {
  return Array.from(document.documentElement.children).find(element => element.shadowRoot)?.shadowRoot;
}

it("shows a local reminder, hides during capture, and respects dismissal for the document", () => {
  const prompt = createBeatSyncPrompt(undefined, "chrome-extension://extension/icons/icon-128.png");
  prompt.update(false);
  expect(panel()).toBeUndefined();
  prompt.update(true);
  expect(panel()?.textContent).toContain("Want to enable Beat Sync?");
  expect(panel()?.textContent).toContain("Phase Pal Music Bridge");
  expect(panel()?.querySelector("img")?.getAttribute("src")).toBe("chrome-extension://extension/icons/icon-128.png");
  prompt.update(false);
  expect(panel()).toBeUndefined();
  prompt.update(true);
  panel()!.querySelector<HTMLButtonElement>("button")!.click();
  prompt.update(true);
  expect(panel()).toBeUndefined();
  prompt.dispose();
});

it("removes a prompt on navigation and releases it permanently on disposal", () => {
  const prompt = createBeatSyncPrompt();
  prompt.update(true);
  window.dispatchEvent(new Event("pagehide"));
  expect(panel()).toBeUndefined();
  prompt.update(true);
  expect(panel()).toBeDefined();
  prompt.dispose();
  prompt.update(true);
  expect(panel()).toBeUndefined();
});

it.each([true, false])("saves Don't show again and handles persistence success=%s", async success => {
  const save = vi.fn().mockResolvedValue(success);
  const prompt = createBeatSyncPrompt(save);
  prompt.update(true);
  const button = Array.from(panel()!.querySelectorAll("button")).find(button => button.textContent === "Don’t show again")!;
  button.click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  if (success) {
    expect(panel()).toBeUndefined();
    prompt.update(true);
    expect(panel()).toBeUndefined();
  } else {
    expect(panel()?.textContent).toContain("Could not save");
    expect(button.disabled).toBe(false);
  }
  prompt.dispose();
});
