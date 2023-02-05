import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      // Vite was not ignoring tmp dir, which is the only reason I added this
      input: ["index.html"],
    },
    minify: process.env.NODE_ENV !== "development",
    emptyOutDir: false,
  },
  plugins: [svelte()],
});
