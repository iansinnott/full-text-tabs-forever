/**
 * HAX: Load PGlite in a service worker
 *
 * This is a temporary solution to allow PGlite to work in a service worker.
 * Hopefully in future versions this will not be necessary. The core issue here
 * is that PGlite, perhaps via some internal emscripted logic, is using the
 * _synchronous_ XMLHttpRequest API to load assets. This poses two issues:
 *
 * - chrome does not support XMLHttpRequest AT ALL in service workers
 * - we cannot create a full polyfill for XMLHttpRequest because we cannot mimic the synchronous behavior
 *
 * Thus this script simply loads the relevant bytes into memory and hands them
 * back if requested via the correct URL.
 *
 * @todo Not sure if vite grabs the relevant asset and puts in the the build,
 * might need to create a plugin for that. works for the `dev` comamnd but might
 * not wokr for `build`.
 */

const assetCache = new Map<string, ArrayBuffer>();

async function preloadAssets() {
  // NOTE: The wasm file exists in the pglite package but does not seem to be used. preloading the data file was enough
  const assetUrls = [
    chrome.runtime.getURL("/assets/postgres-CkP7QCDB.data"), // 0.2.17
  ];

  for (const url of assetUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`failed to fetch asset :: ${url}`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      assetCache.set(url, arrayBuffer);
    } catch (error) {
      console.error(`failed to preload asset :: ${url}`, error);
    }
  }
}

// As with XMLHttpRequest, this is not supported in the service worker context.
class ProgressEventPolyfill {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

// A partial polyfill for XMLHttpRequest to support the loading of pglite in a
// service worker
class XMLHttpRequestPolyfill {
  private url: string = "";
  public onload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
  public onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
  public status: number = 0;
  public responseText: string = "";
  public response: any = null;

  open(method: string, url: string) {
    console.log("open ::", { method, url });
    this.url = url;
  }

  send(body: any = null) {
    console.log("send ::", { body });
    if (assetCache.has(this.url)) {
      this.response = assetCache.get(this.url);
      this.status = 200;
      if (this.onload) {
        // @ts-expect-error
        this.onload.call(this, new ProgressEventPolyfill("load") as any);
      }
    } else {
      console.error(`asset not preloaded :: ${this.url}`);
      this.status = 404;
      if (this.onerror) {
        // @ts-expect-error
        this.onerror.call(this, new ProgressEventPolyfill("error") as any);
      }
    }
  }
}

(globalThis as any).XMLHttpRequest = XMLHttpRequestPolyfill;
(globalThis as any).ProgressEvent = ProgressEventPolyfill;

// Preload assets BEFORE importing PGlite
//
// NOTE: This will require vite-plugin-top-level-await. Chrome will not allow
// top level await in service workers even if supported by the browser in other
// context.
await preloadAssets();

import { PGlite } from "@electric-sql/pglite";

export { PGlite };
