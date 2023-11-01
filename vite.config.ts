import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        background: "src/background.ts",
      },
      output: {
        entryFileNames: "[name].js",
      },
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
    svelte({
      preprocess: vitePreprocess(),
    }),
    {
      name: "copy-plugin",
      apply: "build",
      enforce: "post",
      generateBundle() {
        const sourceDir = path.resolve(__dirname, "src/assets");
        const destinationDir = path.resolve(__dirname, "dist/assets");

        fs.mkdirSync(destinationDir, { recursive: true });

        const files = fs.readdirSync(sourceDir);

        for (const filepath of files) {
          const sourcePath = path.join(sourceDir, filepath);
          const destinationPath = path.join(destinationDir, filepath);

          fs.copyFileSync(sourcePath, destinationPath);
          console.log(`[copy-plugin] ${sourcePath} -> ${destinationPath}`);
        }
      },
    },
  ],
});
