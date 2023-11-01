import { defineConfig } from "vite";
import { chromeExtension } from "vite-plugin-chrome-extension";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/manifest.json",
    },
    minify: false,
    emptyOutDir: false,
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "@vlcn.io/crsqlite-wasm"],
  },
  plugins: [
    // @ts-expect-error - vite-plugin-chrome-extension is poorly typed?
    chromeExtension(),
  ],
});
