import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      // Vite was not ignoring tmp dir, which is the only reason I added this
      input: {
        "content-scripts/content-script": "src/content-scripts/content-script.ts",
      },
      output: {
        inlineDynamicImports: true,
        entryFileNames: "[name].js",
      },
    },
    minify: false,
    emptyOutDir: false,
  },
  plugins: [
    svelte({
      preprocess: vitePreprocess(),
      onwarn: (warning, handler) => {
        // Ignore all a11y warnings
        if (warning.code?.startsWith('a11y-')) {
          return;
        }
        handler(warning);
      }
    }),
  ],
});
