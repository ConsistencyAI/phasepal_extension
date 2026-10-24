import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomSiteRegistry, customSiteOrigin } from "../src/custom-sites";

describe("custom website access", () => {
  let scripts: chrome.scripting.RegisteredContentScript[];
  let granted: Set<string>;
  let register: ReturnType<typeof vi.fn>;
  let removePermission: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scripts = [];
    granted = new Set();
    register = vi.fn(async (items: chrome.scripting.RegisteredContentScript[]) => { scripts.push(...items); });
    removePermission = vi.fn(async ({ origins }: { origins: string[] }) => { origins.forEach(origin => granted.delete(origin)); return true; });
    vi.stubGlobal("chrome", {
      permissions: { contains: vi.fn(async ({ origins }: { origins: string[] }) => origins.every(origin => granted.has(origin))), remove: removePermission },
      scripting: {
        getRegisteredContentScripts: vi.fn(async () => [...scripts]),
        registerContentScripts: register,
        unregisterContentScripts: vi.fn(async ({ ids }: { ids: string[] }) => { scripts = scripts.filter(script => !ids.includes(script.id)); })
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["radio.example/live?token=private#song", "https://radio.example"],
    ["https://RADIO.example:443/private/path", "https://radio.example"],
    ["http://radio.example/live", "http://radio.example"],
    ["https://user:secret@radio.example/", undefined],
    ["https://*.example/", undefined],
    ["file:///secret", undefined],
    ["chrome://extensions", undefined],
    ["https://radio.example:1234/", undefined],
    ["https://chromewebstore.google.com/", undefined],
    ["", undefined]
  ])("normalizes or rejects %s", (input, expected) => expect(customSiteOrigin(input)).toBe(expected));

  it("requires granted access and persists exactly one host across worker restarts", async () => {
    const first = new CustomSiteRegistry();
    await expect(first.add("https://radio.example")).rejects.toThrow("permission_required");
    expect(register).not.toHaveBeenCalled();
    granted.add("https://radio.example/*");
    await first.add("https://radio.example");
    await first.add("https://radio.example");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({ matches: ["https://radio.example/*"], persistAcrossSessions: true, allFrames: false });
    const restarted = new CustomSiteRegistry();
    await expect(restarted.allowed("https://radio.example/live?private=token")).resolves.toBe(true);
    await expect(restarted.allowed("https://other.radio.example/")).resolves.toBe(false);
    await expect(restarted.allowed("http://radio.example/")).resolves.toBe(false);
    expect(restarted.origins).toEqual(["https://radio.example"]);
  });

  it("removal revokes access and removes the persistent monitor", async () => {
    const registry = new CustomSiteRegistry();
    granted.add("https://radio.example/*");
    await registry.add("https://radio.example");
    await registry.remove("https://radio.example");
    expect(registry.origins).toEqual([]);
    expect(scripts).toEqual([]);
    expect(removePermission).toHaveBeenCalledWith({ origins: ["https://radio.example/*"] });
    await expect(new CustomSiteRegistry().allowed("https://radio.example/")).resolves.toBe(false);
  });

  it("Chrome permission removal rejects an existing monitor before cleanup", async () => {
    const registry = new CustomSiteRegistry();
    granted.add("https://radio.example/*");
    await registry.add("https://radio.example");
    granted.clear();
    await expect(registry.allowed("https://radio.example/")).resolves.toBe(false);
    await registry.prune();
    expect(registry.origins).toEqual([]);
    expect(scripts).toEqual([]);
  });
});
