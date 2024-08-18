import { PGlite } from "./pglite/HAX_pglite";

// @ts-expect-error Types are wrong
import { vector } from "@electric-sql/pglite/vector";
// @ts-expect-error Types are wrong
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

import { formatDebuggablePayload, getArticleFragments, shasum } from "../common/utils";
import { ArticleRow, Backend, DetailRow, ResultRow } from "./backend";
import browser from "webextension-polyfill";
import { createEmbedding } from "./embedding/pipeline";
import { JobQueue } from "./pglite/job_queue";

const schemaSql = `
-- make sure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
  updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS document_hostname ON document (hostname);

CREATE TABLE IF NOT EXISTS document_fragment (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_id BIGINT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  attribute TEXT, 
  value TEXT,
  fragment_order INTEGER,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
  search_vector tsvector,
  content_vector vector(384)
);

CREATE OR REPLACE FUNCTION update_document_fragment_fts() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', NEW.value);
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

-- Index for trigram similarity search. Disabled for now
-- CREATE INDEX IF NOT EXISTS trgm_idx_document_fragment_value ON document_fragment USING gin (value gin_trgm_ops);
`;

function prepareFtsQuery(query: string): string {
  return (
    query
      .split(" ")
      .map((word) => word.trim())
      .filter(Boolean)
      .join(" & ") + ":*"
  );
}

const normalizeUrl = (urlOrString: string | URL): URL => {
  const url = new URL(urlOrString);
  url.hash = "";
  const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  paramsToRemove.forEach((param) => url.searchParams.delete(param));
  return url;
};

export class PgLiteBackend implements Backend {
  db: PGlite | null = null;
  private dbReady = false;
  private error: Error | null = null;
  private jobQueue: JobQueue;

  constructor() {
    this.jobQueue = new JobQueue(this);
    const startTime = performance.now();
    this.init()
      .then(async () => {
        const endTime = performance.now();
        console.debug("init :: PgLite DB ready", `took ${endTime - startTime} ms`);
        await this.jobQueue.initialize();
      })
      .catch((err) => {
        console.error("init :: err", err);
        this.error = err;
      });
  }

  private async init() {
    /** for debugging. renaming dbs in order to simulate starting fresh */
    const dbNameHistory = ["idb://my-database", "idb://my-database-2"];
    try {
      this.db = await PGlite.create({
        dataDir: dbNameHistory.at(-1),
        extensions: { vector, pg_trgm },
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

  getPageStatus: Backend["getPageStatus"] = async (payload, sender) => {
    const { tab } = sender;
    let shouldIndex = tab?.url?.startsWith("http");

    let url: URL;

    try {
      url = normalizeUrl(tab?.url || "");

      if (url.hostname === "localhost") shouldIndex = false;
      if (url.hostname.endsWith(".local")) shouldIndex = false;
      const existing = await this.findOne({ where: { url: url.href } });
      shouldIndex = !existing || !existing.md_content;
      if (existing) {
        await this.touchDocument({
          id: existing.id,
          updated_at: Date.now(),
          last_visit: Date.now(),
          last_visit_date: new Date().toISOString().split("T")[0],
        });
      }
    } catch (err) {
      return {
        shouldIndex: false,
        error: err.message,
      };
    }

    console.debug(
      `%c${"getPageStatus"}`,
      "color:lime;",
      { shouldIndex, url: tab?.url, normalizedUrl: url?.href },
      payload
    );

    return {
      shouldIndex,
    };
  };

  indexPage: Backend["indexPage"] = async (
    { date, textContent, mdContent, ...payload },
    sender
  ) => {
    const { tab } = sender;

    let mdContentHash: string | undefined = undefined;
    if (mdContent) {
      try {
        mdContentHash = await shasum(mdContent);
      } catch (err) {
        console.warn("shasum failed", err);
      }
    }

    const u = new URL(tab?.url || "");
    const document: Partial<ArticleRow> = {
      ...payload,
      md_content: mdContent,
      md_content_hash: mdContentHash,
      publication_date: date ? new Date(date).getTime() : undefined,
      url: u.href,
      hostname: u.hostname,
      last_visit: Date.now(),
      last_visit_date: new Date().toISOString().split("T")[0],
    };

    console.debug(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.debug(
      formatDebuggablePayload({
        title: document.title,
        textContent,
        siteName: document.siteName,
      })
    );

    const inserted = await this.upsertDocument(document);

    if (inserted) {
      console.debug(
        `%c  ${"new insertion"}`,
        "color:gray;",
        `indexed doc:${inserted.id}, url:${u.href}`
      );

      await this.upsertFragments(inserted.id, {
        title: document.title,
        url: u.href,
        excerpt: document.excerpt,
        textContent,
      });
    }

    return {
      ok: true,
      message: `indexed doc:${mdContentHash}, url:${u.href}`,
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    const { tab } = sender;
    console.debug(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return { ok: true };
  };

  async similaritySearch({ query, limit = 10 }: { query: string; limit?: number }) {
    const queryEmbedding = await createEmbedding(query);

    const results = await this.db!.query(
      `
    SELECT df.id, df.attribute, df.value, d.title, d.url,
           1 - (df.content_vector <=> $1) AS cosine_similarity
    FROM document_fragment df
    JOIN document d ON df.entity_id = d.id
    ORDER BY df.content_vector <=> $1
    LIMIT $2
  `,
      [queryEmbedding, limit]
    );

    return results.rows;
  }

  search: Backend["search"] = async (payload) => {
    let {
      query,
      limit = 100,
      offset = 0,
      orderBy = "updated_at",
      preprocessQuery = true,
    } = payload;
    console.debug(`%c${"search"}`, "color:lime;", query);

    if (preprocessQuery) {
      query = prepareFtsQuery(query);
    }

    const startTime = performance.now();
    const _orderBy =
      orderBy === "rank" ? "ts_rank(df.search_vector, to_tsquery('simple', $1))" : "d.updated_at";

    const [count, results] = await Promise.all([
      this.db!.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM document_fragment df WHERE df.search_vector @@ to_tsquery('simple', $1)`,
        [query]
      ),
      this.db!.query<ResultRow>(
        `SELECT 
          df.id as rowid,
          d.id as "entityId",
          df.attribute,
          ts_headline('simple', df.value, to_tsquery('simple', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=10, MinWords=5') AS snippet,
          d.url,
          d.hostname,
          d.title,
          d.excerpt,
          d.last_visit as "lastVisit",
          d.last_visit_date as "lastVisitDate",
          d.md_content_hash as "mdContentHash",
          d.updated_at as "updatedAt",
          d.created_at as "createdAt",
          ts_rank(df.search_vector, to_tsquery('simple', $1)) as rank,
          CASE 
            WHEN d.hostname IN ('localhost') THEN -50
            WHEN d.hostname IN ('google.com', 'www.google.com', 'kagi.com', 'duckduckgo.com', 'bing.com') THEN -10 
            WHEN d.hostname IN ('amazon.com', 'www.amazon.com') THEN -5
            ELSE 0 
          END AS rank_modifier
        FROM document_fragment df
          INNER JOIN document d ON d.id = df.entity_id
        WHERE df.search_vector @@ to_tsquery('simple', $1)
        ORDER BY 
          rank_modifier DESC,
          ${_orderBy} DESC
        LIMIT $2
        OFFSET $3`,
        [query, limit, offset]
      ),
    ]);
    const endTime = performance.now();

    return {
      ok: true,
      results: results.rows,
      count: count.rows[0]?.count,
      perfMs: endTime - startTime,
      query,
    };
  };

  private async upsertFragments(
    entityId: number,
    document: Partial<{
      url: string;
      title: string;
      excerpt: string;
      textContent: string;
    }>
  ) {
    const fragments = getArticleFragments(document.textContent || "");

    const sql = `
      INSERT INTO document_fragment (
        entity_id,
        attribute,
        value,
        fragment_order
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING;
    `;

    let triples: [e: number, a: string, v: string, o: number][] = [];
    if (document.title) triples.push([entityId, "title", document.title, 0]);
    if (document.excerpt) triples.push([entityId, "excerpt", document.excerpt, 0]);
    if (document.url) triples.push([entityId, "url", document.url, 0]);
    triples = triples.concat(
      fragments
        .filter((x) => x.trim())
        .map((fragment, i) => {
          return [entityId, "content", fragment, i];
        })
    );

    console.debug("upsertFragments :: triples", triples);
    await this.db!.transaction(async (tx) => {
      for (const param of triples) {
        await tx.query(sql, param);
      }
    });
  }

  private async touchDocument(document: Partial<ArticleRow> & { id: number }) {
    await this.db!.query(
      `UPDATE document 
      SET updated_at = $1,
          last_visit = $2,
          last_visit_date = $3
      WHERE id = $4`,
      [document.updated_at, document.last_visit, document.last_visit_date, document.id]
    );
  }

  private async upsertDocument(document: Partial<ArticleRow>) {
    const existingDoc = await this.findOne({ where: { url: document.url! } });

    if (existingDoc) {
      await this.db!.query(
        `UPDATE document 
        SET updated_at = $1,
            excerpt = $2,
            md_content = $3,
            md_content_hash = $4,
            last_visit = $5,
            last_visit_date = $6
        WHERE id = $7`,
        [
          Date.now(),
          document.excerpt,
          document.md_content,
          document.md_content_hash,
          document.last_visit,
          document.last_visit_date,
          existingDoc.id,
        ]
      );
      return;
    }

    const result = await this.db!.query<{ id: number }>(
      `INSERT INTO document (
        title, url, excerpt, md_content, md_content_hash, publication_date,
        hostname, last_visit, last_visit_date, extractor, updated_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING id`,
      [
        document.title,
        document.url,
        document.excerpt,
        document.md_content,
        document.md_content_hash,
        document.publication_date,
        document.hostname,
        document.last_visit,
        document.last_visit_date,
        document.extractor,
        document.updated_at || Date.now(),
        document.created_at || Date.now(),
      ]
    );

    return this.findOne({ where: { url: document.url! } });
  }

  async findOne({ where }: { where: { url: string } }): Promise<DetailRow | null> {
    const result = await this.db!.query<DetailRow>(
      `SELECT * FROM document WHERE url = $1 LIMIT 1`,
      [where.url]
    );
    return result.rows[0] || null;
  }

  async reindex() {
    await this.db!.query(`
      UPDATE document_fragment
      SET search_vector = to_tsvector('simple', COALESCE(attribute, '') || ' ' || COALESCE(value, ''))
    `);
  }

  async getStats() {
    const [document, document_fragment, db_size] = await Promise.all([
      this.db!.query<{ count: number }>(`SELECT COUNT(*) as count FROM document;`),
      this.db!.query<{ count: number }>(`SELECT COUNT(*) as count FROM document_fragment;`),
      this.db!.query<{ size: number }>(`SELECT pg_database_size(current_database()) as size;`),
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

  /**
   * Query the db via RPC, initially created for debugging
   */
  async query({ sql, params }: { sql: string; params: any[] }) {
    return this.db!.query(sql, params);
  }

  // Expose to rpc
  async createEmbedding(s: string) {
    return createEmbedding(s);
  }

  async processJobQueue() {
    await this.jobQueue.processPendingTasks();
  }

  async exportJson() {
    const data = {
      document: (await this.db!.query(`SELECT * FROM document;`)).rows,
      document_fragment: (await this.db!.query(`SELECT * FROM document_fragment;`)).rows,
    };
    const str = JSON.stringify(data);
    const blob = new Blob([str], { type: "application/json" });
    const blobUrl = await this.createObjectURL(blob);

    await browser.downloads.download({
      url: blobUrl,
      filename: `fttf-${Date.now()}.json`,
      saveAs: true,
    });
  }

  async importJson(json: Record<string, any[][]>) {
    console.log("importJson :: documents", json.document.length);
    console.log("importJson :: fragments", json.document_fragment.length);

    await this.db!.transaction(async (tx) => {
      for (const row of json.document) {
        await tx.query(
          `INSERT INTO document (${Object.keys(row).join(", ")})
           VALUES (${Object.keys(row)
             .map((_, i) => `$${i + 1}`)
             .join(", ")})
           ON CONFLICT (url) DO NOTHING;`,
          Object.values(row)
        );
      }
      for (const row of json.document_fragment) {
        await tx.query(
          `INSERT INTO document_fragment (${Object.keys(row).join(", ")})
           VALUES (${Object.keys(row)
             .map((_, i) => `$${i + 1}`)
             .join(", ")})
           ON CONFLICT (id) DO NOTHING;`,
          Object.values(row)
        );
      }
    });

    console.log("importJson :: complete");
  }

  private async createObjectURL(blob: Blob): Promise<string> {
    if (URL && typeof URL.createObjectURL === "function") {
      return URL.createObjectURL(blob);
    }

    return await new Promise<string>((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = function () {
        let buffer = reader.result;
        if (buffer) {
          resolve(
            `data:${blob.type};base64,${btoa(
              new Uint8Array(buffer as ArrayBufferLike).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            )}`
          );
        } else {
          reject("Buffer is null");
        }
      };
      reader.onerror = function () {
        reject("Error reading blob as ArrayBuffer");
      };
      reader.readAsArrayBuffer(blob);
    });
  }
}
