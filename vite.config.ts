import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { chromeExtension } from "vite-plugin-chrome-extension";

// A vite plugin that logs every file that is being bundled
const logPlugin = () => {
  return {
    name: "log-plugin",
    resolveId(id) {
      console.log('resolve id:', id);
      return id
    },
    load(id) {
      console.log('load:', id);
      return null
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/manifest.json",
    },

    // Unminified code helps with debug stack traces
    // @ts-ignore - need to add @types/node? 
    minify: process.env.NODE_ENV !== "development",
  },
  plugins: [
    svelte(),
    // @ts-expect-error - vite-plugin-chrome-extension is poorly typed?
    chromeExtension(),
    // logPlugin(),
  ],
});
