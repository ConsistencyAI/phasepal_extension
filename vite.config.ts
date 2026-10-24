import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { musicSitePatterns } from "./src/providers";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => ({
  publicDir: mode === "content" ? false : "public",
  plugins: mode === "content" ? [] : [{
    name: "music-site-permissions",
    generateBundle() {
      const manifest = JSON.parse(readFileSync(resolve(projectDirectory, "public/manifest.json"), "utf8"));
      const patterns = musicSitePatterns();
      manifest.host_permissions = patterns;
      manifest.content_scripts[0].matches = patterns;
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify(manifest, null, 2) + "\n" });
    }
  }],
  build: mode === "content" ? {
    // Chrome content scripts are classic scripts; shared provider imports must be inlined.
    outDir: "dist/assets",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(projectDirectory, "src/content.ts"),
      name: "PhasePalMusicContent",
      formats: ["iife"],
      fileName: () => "content.js"
    }
  } : {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(projectDirectory, "src/background.ts"),
        popup: resolve(projectDirectory, "src/popup.html"),
        offscreen: resolve(projectDirectory, "src/offscreen.html"),
        "audio-worklet": resolve(projectDirectory, "src/audio-worklet.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"]
  }
}));
