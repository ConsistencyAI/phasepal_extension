/** Only exact HTTP(S) origins are saved. Paths, credentials and query strings are not stored. */
export function customSiteOrigin(input: string | undefined): string | undefined {
  if (!input?.trim()) return undefined;
  try {
    const text = input.trim();
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
      !url.hostname || /[*\[\]]/.test(url.hostname) || url.hostname === "chromewebstore.google.com" ||
      url.hostname === "chrome.google.com") return undefined;
    return url.origin;
  } catch { return undefined; }
}

export function customSitePattern(origin: string): string { return `${origin}/*`; }
const PREFIX = "custom-site-";
function scriptId(origin: string): string {
  return PREFIX + Array.from(origin, character => character.charCodeAt(0).toString(16)).join("");
}

/** Chrome's persistent script registrations own the local site list; no sync or remote storage. */
export class CustomSiteRegistry {
  readonly ready: Promise<void>;
  private sites = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor() { this.ready = this.restore(); }
  get origins(): string[] { return [...this.sites].sort(); }

  async allowed(url: string | undefined): Promise<boolean> {
    await this.ready;
    const origin = customSiteOrigin(url);
    if (!origin || !this.sites.has(origin)) return false;
    const allowed = await chrome.permissions.contains({ origins: [customSitePattern(origin)] });
    return allowed && this.sites.has(origin);
  }

  add(origin: string): Promise<void> {
    return this.serialize(async () => {
      if (customSiteOrigin(origin) !== origin) throw new Error("invalid_site");
      if (!await chrome.permissions.contains({ origins: [customSitePattern(origin)] })) throw new Error("permission_required");
      if (this.sites.has(origin)) return;
      if (this.sites.size >= 50) throw new Error("site_limit");
      await chrome.scripting.registerContentScripts([{
        id: scriptId(origin), matches: [customSitePattern(origin)], js: ["assets/content.js"],
        runAt: "document_idle", persistAcrossSessions: true, allFrames: false
      }]);
      this.sites.add(origin);
    });
  }

  remove(origin: string): Promise<void> {
    return this.serialize(async () => {
      if (!this.sites.has(origin)) return;
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId(origin)] });
      this.sites.delete(origin);
      await chrome.permissions.remove({ origins: [customSitePattern(origin)] });
    });
  }

  prune(): Promise<void> {
    return this.serialize(async () => {
      for (const origin of this.origins) {
        if (await chrome.permissions.contains({ origins: [customSitePattern(origin)] })) continue;
        this.sites.delete(origin);
        await chrome.scripting.unregisterContentScripts({ ids: [scriptId(origin)] });
      }
    });
  }

  private async restore(): Promise<void> {
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    for (const script of scripts) {
      if (!script.id.startsWith(PREFIX) || script.matches?.length !== 1) continue;
      const pattern = script.matches[0]!;
      const origin = customSiteOrigin(pattern.replace(/\/\*$/, ""));
      if (!origin || script.id !== scriptId(origin) || script.matches[0] !== customSitePattern(origin)) continue;
      if (await chrome.permissions.contains({ origins: script.matches })) this.sites.add(origin);
      else await chrome.scripting.unregisterContentScripts({ ids: [script.id] });
    }
  }

  private serialize(action: () => Promise<void>): Promise<void> {
    const operation = this.queue.then(() => this.ready).then(action);
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
