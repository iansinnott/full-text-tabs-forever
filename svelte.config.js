import preprocess from "svelte-preprocess";
import adapter from "sveltekit-adapter-chrome-extension";
import { vitePreprocess } from "@sveltejs/kit/vite";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(),
    preprocess({
      postcss: true,
    }),
  ],

  kit: {
    // See https://github.com/michmich112/sveltekit-adapter-chrome-extension
    adapter: adapter(),
  },

  appDir: "app",
};

export default config;
