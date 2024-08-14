import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import path from "node:path";
import fs, { readFileSync, writeFileSync } from "node:fs";
import archiver from "archiver";
import type { Manifest } from "webextension-polyfill";
import vitePluginTopLevelAwait from "vite-plugin-top-level-await";

const TARGET: "chrome" | "firefox" = process.env.TARGET as "chrome" | "firefox";
const FF_ADDON_ID = process.env.FF_ADDON_ID as string;

if (!["chrome", "firefox"].includes(TARGET)) {
  throw new Error(`Invalid TARGET: ${TARGET}. Specify TARGET=chrome or TARGET=firefox`);
}

if (TARGET === "firefox" && !FF_ADDON_ID) {
  throw new Error(`FF_ADDON_ID is required for firefox builds`);
}

const isFirefox = TARGET === "firefox";

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
    vitePluginTopLevelAwait(),
    svelte({
      preprocess: vitePreprocess(),
    }),

    // Watch additional files
    {
      name: "watch-additional-files",
      buildStart() {
        for (const pathName of ["src/manifest.json", `src/manifest-${TARGET}.json`]) {
          if (fs.existsSync(path.resolve(__dirname, pathName))) {
            this.addWatchFile(path.resolve(__dirname, pathName));
          }
        }
      },
    },

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

        try {
          const manifest = JSON.parse(
            readFileSync(path.resolve(__dirname, "src/manifest.json"), "utf8")
          );

          // Mutate the manifest object
          delete manifest["$schema"]; // Schema is just provided for autocomplete but chrome doesn't like it

          // Handle FF special cases
          if (isFirefox) {
            // Case 1: FF doesn't support service_worker, it prefers a background.scripts array
            manifest.background.scripts = [manifest.background.service_worker];
            delete manifest.background.service_worker;

            // Case 2: FF requires an id. See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
            manifest.browser_specific_settings = {
              gecko: {
                id: `{${FF_ADDON_ID}}`, // FF loves those braces
                strict_min_version: "109.0", // When they added (partial) MV3 support. No lover for MV3 here, but since it's a hard req for chrome we use it for FF too
              },
            };
          }

          writeFileSync(
            path.join(__dirname, "dist/manifest.json"),
            JSON.stringify(manifest, null, 2)
          );
          console.log(`[copy-plugin] copied manifest`);
        } catch (err) {
          console.error("Could not build manifest", err);
        }
      },
    },

    // Create zip dist file for upload to chrome web store
    {
      name: "zip-plugin",
      apply: "build",
      enforce: "post",
      writeBundle() {
        const output = fs.createWriteStream(__dirname + `/fttf-${TARGET}.zip`);
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
