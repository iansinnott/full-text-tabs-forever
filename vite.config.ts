import { defineConfig } from "vite";
import { chromeExtension } from "vite-plugin-chrome-extension";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/manifest.json",
    },
  },
  plugins: [chromeExtension()],
});
