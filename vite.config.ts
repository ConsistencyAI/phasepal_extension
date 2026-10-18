import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(projectDirectory, "src/background.ts"),
        content: resolve(projectDirectory, "src/content.ts"),
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
});
