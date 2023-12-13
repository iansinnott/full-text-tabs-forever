import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";
import archiver from "archiver";

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

    // Copy assets to dist
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

    // Create zip dist file for upload to chrome web store
    {
      name: "zip-plugin",
      apply: "build",
      enforce: "post",
      writeBundle() {
        const output = fs.createWriteStream(__dirname + "/fttf.zip");
        const archive = archiver("zip", {
          zlib: { level: 9 },
        });

        // listen for all archive data to be processed
        output.on("close", function () {
          console.log(archive.pointer() + " total bytes");
          console.log("Archiver has been finalized and the output file descriptor has closed.");
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on("warning", function (err) {
          if (err.code === "ENOENT") {
            console.warn("no file", err);
          } else {
            // throw error
            throw err;
          }
        });

        // good practice to catch this error explicitly
        archive.on("error", function (err) {
          throw err;
        });

        // pipe archive data to the file
        archive.pipe(output);

        // append files from a directory
        archive.directory(__dirname + "/dist/", false);

        // finalize the archive (ie we are done appending files but streams have to finish yet)
        archive.finalize();
      },
    },
  ],
});
