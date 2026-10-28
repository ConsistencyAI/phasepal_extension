/** A local, dismissible reminder. Capture still requires invoking the extension. */
export function createBeatSyncPrompt(onNeverShow?: () => Promise<boolean>, logoUrl?: string): { update(show: boolean): void; dispose(): void } {
  let dismissed = false;
  let panel: HTMLElement | undefined;
  const hide = () => { panel?.remove(); panel = undefined; };
  window.addEventListener("pagehide", hide);
  return {
    update(show) {
      if (!show) { hide(); return; }
      if (dismissed || panel) return;
      panel = document.createElement("div");
      panel.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:320px;";
      const shadow = panel.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = ":host{color-scheme:dark}section{font:14px/1.5 system-ui,sans-serif;background:#0d141c;color:#edf1f7;border:1px solid #3082eb;border-radius:12px;padding:16px;box-shadow:0 8px 28px #0006}p{margin:8px 0 12px}button{font:inherit;background:#3082eb;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer}button:focus-visible{outline:2px solid #fff;outline-offset:3px}";
      const section = document.createElement("section");
      style.textContent += ".never-show{background:transparent;transition:background-color 150ms ease}.never-show:hover:not(:disabled){background:rgba(255,255,255,0.1)}@media(prefers-reduced-motion:reduce){.never-show{transition:none}}";
      section.setAttribute("role", "status");
      const header = document.createElement("header");
      header.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px;font-weight:700;";
      if (logoUrl) {
        const logo = document.createElement("img");
        logo.src = logoUrl;
        logo.alt = "";
        logo.width = 32;
        logo.height = 32;
        logo.style.cssText = "display:block;object-fit:contain;border-radius:8px;background:#fff;";
        header.append(logo);
      }
      const name = document.createElement("span");
      name.textContent = "Phase Pal Music Bridge";
      header.append(name);
      const title = document.createElement("strong");
      title.textContent = "Want to enable Beat Sync?";
      const detail = document.createElement("p");
      detail.textContent = "Open the Phase Pal extension in Chrome’s toolbar. Auto Beat Sync starts there when enabled; otherwise choose Enable Beat Sync.";
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.textContent = "Not now";
      dismiss.addEventListener("click", () => { dismissed = true; hide(); });
      const neverShow = document.createElement("button");
      neverShow.type = "button";
      neverShow.className = "never-show";
      neverShow.textContent = "Don’t show again";
      neverShow.style.marginLeft = "8px";
      neverShow.addEventListener("click", async () => {
        neverShow.disabled = true;
        try {
          if (!await onNeverShow?.()) throw new Error("save_failed");
          dismissed = true;
          hide();
        } catch {
          neverShow.disabled = false;
          detail.textContent = "Could not save that choice. Try again, or choose Not now.";
        }
      });
      section.append(header, title, detail, dismiss, neverShow);
      shadow.append(style, section);
      document.documentElement.append(panel);
    },
    dispose() { dismissed = true; hide(); window.removeEventListener("pagehide", hide); }
  };
}
