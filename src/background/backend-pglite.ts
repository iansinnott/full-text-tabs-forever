// Add this polyfill at the top of your file, before any imports

const assetCache = new Map<string, ArrayBuffer>();

async function preloadAssets() {
  const assetUrls = [
    // Add your asset URLs here, e.g.:
    // '/pglite-wasm.wasm',
    chrome.runtime.getURL("/assets/postgres-O2XafnGg.data"),
  ];

  for (const url of assetUrls) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    assetCache.set(url, arrayBuffer);
  }
}

// Simple ProgressEvent polyfill
class ProgressEventPolyfill {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class XMLHttpRequestPolyfill {
  private method: string = "";
  private url: string = "";
  private headers: { [key: string]: string } = {};
  private body: any = null;
  public onload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
  public onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
  public status: number = 0;
  public responseText: string = "";
  public response: any = null;
  public responseType: XMLHttpRequestResponseType = "";

  open(method: string, url: string) {
    console.log("open ::", { method, url });
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    console.log("setRequestHeader ::", { name, value });
    this.headers[name] = value;
  }

  send(body: any = null) {
    console.log("send ::", { body });
    this.body = body;
    if (assetCache.has(this.url)) {
      this.response = assetCache.get(this.url);
      this.status = 200;
      if (this.responseType === "text") {
        this.responseText = new TextDecoder().decode(this.response);
      }
      if (this.onload) {
        this.onload.call(this, new ProgressEventPolyfill("load") as any);
      }
    } else {
      console.error(`Asset not preloaded: ${this.url}`);
      this.status = 404;
      if (this.onerror) {
        this.onerror.call(this, new ProgressEventPolyfill("error") as any);
      }
    }
  }
}

// Replace the global XMLHttpRequest and ProgressEvent with our polyfills
(globalThis as any).XMLHttpRequest = XMLHttpRequestPolyfill;
(globalThis as any).ProgressEvent = ProgressEventPolyfill;

// Preload assets before initializing PGlite
await preloadAssets();

import { PGlite } from "@electric-sql/pglite";

import type { Backend, DetailRow } from "./backend";

export class PgLiteBackend implements Backend {
  private db: PGlite | null = null;
  private dbReady = false;
  private error: Error | null = null;

  constructor() {
    this.init()
      .then(() => {
        console.debug("PgLite DB ready");
      })
      .catch((err) => {
        console.error("Error initializing PgLite db", err);
        this.error = err;
      });
  }

  private async init() {
    try {
      this.db = await PGlite.create({
        dataDir: "memory://",
      });
      this.dbReady = true;
    } catch (err) {
      console.error("Error initializing PgLite db", err);
      this.error = err;
      throw err;
    }
  }

  getStatus: Backend["getStatus"] = async () => {
    if (this.error) {
      return {
        ok: false,
        error: this.error.message,
        detail: {
          stack: this.error.stack,
        },
      };
    }

    if (!this.dbReady) {
      return {
        ok: false,
        error: "PgLite db not ready",
      };
    }

    return {
      ok: true,
    };
  };

  search: Backend["search"] = async (search) => {
    console.log("search ::", search);
    return {
      ok: true,
      results: [],
      count: 0,
      perfMs: 0,
      query: search.query,
    };
  };

  async findOne(query: { where: { url: string } }): Promise<DetailRow | null> {
    console.log("findOne ::", query);
    return null;
  }

  getPageStatus: Backend["getPageStatus"] = async (payload, sender) => {
    console.log("getPageStatus ::", { payload });
    return {
      shouldIndex: false,
    };
  };

  indexPage: Backend["indexPage"] = async (payload, sender) => {
    console.log("indexPage ::", { payload });
    return {
      message: "PgLite backend indexing not implemented",
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    console.log("nothingToIndex ::", { payload });
    return {
      ok: true,
    };
  };
}
