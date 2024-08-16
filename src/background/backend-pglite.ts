const assetCache = new Map<string, ArrayBuffer>();

async function preloadAssets() {
  const assetUrls = [
    // NOTE: The wasm file exists in the pglite package but does not seem to be used. preloading the data file was enough
    // '/pglite-wasm.wasm',
    chrome.runtime.getURL("/assets/postgres-O2XafnGg.data"),
  ];

  for (const url of assetUrls) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    assetCache.set(url, arrayBuffer);
  }
}

// As with XMLHttpRequest, this is not supported in the service worker context.
class ProgressEventPolyfill {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

// A partial polyfill for XMLHttpRequest to support the loading of pglite in a service worker
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

// @ts-expect-error Types are wrong
import { vector } from "@electric-sql/pglite/vector";

import type { Backend, DetailRow } from "./backend";

const schemaSql = `
-- make sure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT, 
  url TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  md_content TEXT,
  md_content_hash TEXT,
  publication_date BIGINT,
  hostname TEXT,
  last_visit BIGINT,
  last_visit_date TEXT,
  extractor TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS document_hostname ON document (hostname);

CREATE TABLE IF NOT EXISTS document_fragment (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_id BIGINT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  attribute TEXT, 
  value TEXT,
  fragment_order INTEGER,
  created_at BIGINT,
  search_vector tsvector,
  content_vector vector(384)
);

CREATE OR REPLACE FUNCTION update_document_fragment_fts() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.attribute, '') || ' ' || COALESCE(NEW.value, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search vector
DROP TRIGGER IF EXISTS update_document_fragment_fts_trigger ON document_fragment;
CREATE TRIGGER update_document_fragment_fts_trigger
BEFORE INSERT OR UPDATE ON document_fragment
FOR EACH ROW EXECUTE FUNCTION update_document_fragment_fts();

-- Index for full-text search
CREATE INDEX IF NOT EXISTS idx_document_fragment_search_vector ON document_fragment USING GIN(search_vector);
`;

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
        dataDir: "idb://my-database",
        extensions: { vector },
        relaxedDurability: true,
      });
      await this.db.exec(schemaSql);
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
    return { ok: true };
  };

  async getStats() {
    if (!this.db) {
      throw new Error("PgLite db not ready");
    }

    const [document, document_fragment, db_size] = await Promise.all([
      this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM document;`),
      this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM document_fragment;`),
      this.db.query<{ size: number }>(`SELECT pg_database_size(current_database()) as size;`),
    ]);

    return {
      document: {
        count: document.rows[0]?.count,
      },
      document_fragment: {
        count: document_fragment.rows[0]?.count,
      },
      db: {
        size_bytes: db_size.rows[0]?.size,
      },
    };
  }
}
