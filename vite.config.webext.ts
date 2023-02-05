import { defineConfig } from "vite";
import { chromeExtension } from "vite-plugin-chrome-extension";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/manifest.json",
    },

    // Unminified code helps with debug stack traces
    // @ts-ignore - need to add @types/node?
    minify: process.env.NODE_ENV !== "development",

    emptyOutDir: false,
  },
  plugins: [
    // @ts-expect-error - vite-plugin-chrome-extension is poorly typed?
    chromeExtension(),
  ],
});
