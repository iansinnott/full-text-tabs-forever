import { PGlite } from "./pglite/HAX_pglite";

// @ts-expect-error Types are wrong
import { vector } from "@electric-sql/pglite/vector";
// @ts-expect-error Types are wrong
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
// @ts-expect-error Types are wrong
import { btree_gin } from "@electric-sql/pglite/contrib/btree_gin";

import { formatDebuggablePayload, getArticleFragments, segment } from "../common/utils";
import { ArticleRow, Backend, DetailRow, ResultRow } from "./backend";
import browser from "webextension-polyfill";
import { createEmbedding } from "./embedding/pipeline";
import { JobQueue } from "./pglite/job_queue";
import { type QueryOptions, Transaction } from "@electric-sql/pglite";
import { defaultBlacklistRules } from "./pglite/defaultBlacklistRules";
import { z } from "zod";

import { MigrationManager, type Migration } from "./pglite/migration-manager";
import { migration as init_migration } from "./pglite/migrations/001_init";

// List of migrations to apply
const migrations = [init_migration];

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
  const paramsToRemove = [
    // UTM stuff
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];
  paramsToRemove.forEach((param) => url.searchParams.delete(param));
  return url;
};

export class PgLiteBackend implements Backend {
  db: PGlite | null = null;
  private dbReady = false;
  private error: Error | null = null;
  private jobQueue: JobQueue | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor() {
    const startTime = performance.now();
    this.readyPromise = this.init()
      .then(async () => {
        const endTime = performance.now();
        console.debug("init :: PgLite DB ready", `took ${endTime - startTime} ms`);
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
        extensions: { vector, pg_trgm, btree_gin },
        relaxedDurability: true,
      });

      await this.applyMigrations();
      await this.initializeDefaultBlacklistRules();

      // Initialize job queue
      this.jobQueue = new JobQueue(this.db, undefined, 100);
      await this.jobQueue.initialize();

      this.dbReady = true;
    } catch (err) {
      console.error("Error initializing PgLite db", err);
      this.error = err;
      throw err;
    }
  }

  private async applyMigrations() {
    try {
      const migrationManager = new MigrationManager(this.db!);

      for (const migration of migrations) {
        migrationManager.registerMigration(migration as Migration);
      }

      const status = await migrationManager.applyMigrations();

      if (!status.ok) {
        console.error("Migration failed");
        throw new Error(`Migration failed`);
      }

      console.log(`Database migrated to version ${status.currentVersion}`);
      return status;
    } catch (error) {
      console.error("Error applying migrations:", error);
      throw error;
    }
  }

  private async initializeDefaultBlacklistRules() {
    const count = await this.db!.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM blacklist_rule"
    );

    if (count.rows[0].count === 0) {
      await this.addDefaultBlacklistRules();
    }
  }

  getStatus: Backend["getStatus"] = async () => {
    await this.readyPromise;

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
    let indexLevel: "full" | "url_only" | "no_index" = "full";

    let url: URL;

    try {
      url = normalizeUrl(tab?.url || "");

      if (url.hostname === "localhost") indexLevel = "no_index";
      if (url.hostname.endsWith(".local")) indexLevel = "no_index";

      const blacklistRule = await this.getMatchingBlacklistRule(url.href);
      if (blacklistRule) {
        indexLevel = blacklistRule.level === "no_index" ? "no_index" : "url_only";
      }

      const existing = await this.findOne({ where: { url: url.href } });

      if (existing) {
        await this.touchDocument({
          id: existing.id,
          updated_at: Date.now(),
          last_visit: Date.now(),
          last_visit_date: new Date().toISOString().split("T")[0],
        });
      }

      /**
       * - if indexLevel is no_index then don't index it
       * - if indexLevel is url_only then do not index the full text, just the url, title, etc
       * - if the page doesn't already exist, then index it
       * - if the page exists but has no md_content, then index it
       *   This is important, because it allows us to add URLs through some
       *   means, say from existing browser history, and incrementally add the
       *   full text as visits happen or through some bulk visiting of those URLs
       *
       * Future work: allow reindex logic, so that a URL will be reindexed on every visit (comment threads for example)
       */
      shouldIndex =
        indexLevel !== "no_index" &&
        (!existing || !existing.md_content || (indexLevel === "full" && !existing.md_content));
    } catch (err) {
      return {
        shouldIndex: false,
        error: err.message,
      };
    }

    console.debug(
      `%c${"getPageStatus"}`,
      "color:lime;",
      { shouldIndex, indexLevel, url: tab?.url, normalizedUrl: url?.href },
      payload
    );

    return {
      shouldIndex,
      indexLevel,
    };
  };

  indexPage: Backend["indexPage"] = async (
    { date, text_content, md_content, ...payload },
    sender
  ) => {
    const { tab } = sender;
    const u = normalizeUrl(tab?.url || "");
    const { indexLevel } = await this.getPageStatus(payload, sender);
    const document: Partial<ArticleRow> = {
      ...payload,
      md_content: indexLevel === "full" ? md_content : undefined,
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
        text_content,
        siteName: document.siteName,
      })
    );

    const inserted = await this.upsertDocument(document);

    if (inserted && indexLevel === "full") {
      console.debug(
        `%c  ${"new insertion"}`,
        "color:gray;",
        `indexed doc:${inserted.id}, url:${u.href}`
      );

      // Enqueue downstream tasks
      await this.jobQueue?.enqueue("generate_fragments", { document_id: inserted.id });

      // For now we can handle embeddings manually if desired. Let's get the standard FTS working well first.
      //await this.enqueueAllEmbeddings();

      // Fire up the queue processor. Generally this will be pretty quick, but
      // if you just imported a database it will take a while
      this.processJobQueue();
    }

    return {
      ok: true,
      message: `indexed url:${u.href}`,
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    const { tab } = sender;
    console.debug(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return { ok: true };
  };

  async semanticSearch({
    query,
    limit = 100,
    threshold = 0.37, // This value comes from "eyeballing" some of the output
  }: {
    query: string;
    limit?: number;
    /** Results are only returned if the cosine similarity is greater than this threshold. Since there will always be some results with cosine similarity it's useful to only pay attention to results above a certain threshold. Pass zero for all results. */
    threshold?: number;
  }) {
    const queryEmbedding = await createEmbedding(query);

    const sql = `
    SELECT df.id, df.attribute, df.value, d.title, d.url,
           1 - (df.content_vector <=> $1) AS cosine_similarity
    FROM document_fragment df
    JOIN document d ON df.entity_id = d.id
    WHERE 1 - (df.content_vector <=> $1) > $3
    ORDER BY df.content_vector <=> $1
    LIMIT $2
    `;

    const results = await this.db!.query(sql, [JSON.stringify(queryEmbedding), limit, threshold]);

    return results.rows;
  }

  search: Backend["search"] = async (payload) => {
    let {
      query,
      limit = 100,
      offset = 0,
      orderBy = "last_visit",
      preprocessQuery = true,
    } = payload;
    console.debug(`%c${"search"}`, "color:lime;", query);

    if (preprocessQuery) {
      query = prepareFtsQuery(query);
    }

    const startTime = performance.now();

    const orderByMap = {
      updated_at: "d.updated_at",
      created_at: "d.created_at",
      rank: "ts_rank(df.search_vector, to_tsquery('simple', $1))",
      last_visit: "d.last_visit",
    };

    const orderByColumn = orderByMap[orderBy];

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
          ${orderByColumn} DESC
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

  async trigramSearch({ query, limit = 100 }: { query: string; limit?: number }) {
    const sql = `
    SELECT df.id, df.attribute, df.value, d.title, d.url,
           similarity(df.value, $1) AS similarity_score
    FROM document_fragment df
    JOIN document d ON df.entity_id = d.id
    WHERE df.value % $1
    ORDER BY similarity_score DESC
    LIMIT $2
    `;

    const results = await this.db!.query(sql, [query, limit]);

    return results.rows;
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
            md_content_hash = MD5($3),
            last_visit = $4,
            last_visit_date = $5
        WHERE id = $6`,
        [
          Date.now(),
          document.excerpt,
          document.md_content,
          document.last_visit,
          document.last_visit_date,
          existingDoc.id,
        ]
      );
      return;
    }

    await this.db!.query<{ id: number }>(
      `INSERT INTO document (
        title, url, excerpt, md_content, md_content_hash, publication_date,
        hostname, last_visit, last_visit_date, extractor, updated_at, created_at
      ) VALUES (
        $1, $2, $3, $4, MD5($4), $5, $6, $7, $8, $9, $10, $11
      ) RETURNING id`,
      [
        document.title,
        document.url,
        document.excerpt || null,
        document.md_content || null,
        document.publication_date || null,
        document.hostname,
        document.last_visit,
        document.last_visit_date,
        document.extractor || null,
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
   * Query the db via RPC, initially created for debugging, but now also used by
   * the database REPL.
   */
  async [`pg.query`]({
    sql,
    params,
    options,
  }: {
    sql: string;
    params: any[];
    options?: QueryOptions;
  }) {
    try {
      return await this.db!.query(sql, params, options);
    } catch (error) {
      console.error("Error executing query:", error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Execute a SQL statement via RPC, initially created for debugging, but now
   * also used by the database REPL.
   */
  async [`pg.exec`]({ sql, options }: { sql: string; options?: QueryOptions }) {
    try {
      return await this.db!.exec(sql, options);
    } catch (error) {
      console.error("Error executing SQL statement:", error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Expose to rpc
  async createEmbedding(s: string) {
    return createEmbedding(s);
  }

  async processJobQueue() {
    await this.jobQueue?.processPendingTasks();
  }

  /**
   * Enqueue all document fragments for embedding generation. Does NOT run the queue.
   */
  async enqueueAllEmbeddings() {
    await this.db!.transaction(async (tx) => {
      const fragments = (
        await tx.query<{ id: number }>(
          `SELECT id FROM document_fragment where content_vector is null;`
        )
      ).rows;

      for (const fragment of fragments) {
        await this.jobQueue?.enqueue("generate_vector", { fragment_id: fragment.id }, tx);
      }
    });
  }

  async enqueueAllFragments() {
    await this.db!.transaction(async (tx) => {
      const documents = (
        await tx.query<{ id: number }>(
          `SELECT d.id
           FROM document d
           LEFT JOIN document_fragment df ON d.id = df.entity_id
           WHERE df.id IS NULL;`
        )
      ).rows;

      for (const document of documents) {
        await this.jobQueue?.enqueue("generate_fragments", { document_id: document.id }, tx);
      }
    });
  }

  async exportJson() {
    const result = await this.db!.query(`SELECT * FROM document;`, [], {
      rowMode: "array",
    });
    const str = JSON.stringify({ document: result.rows });
    const blob = new Blob([str], { type: "application/json" });
    const blobUrl = await this.createObjectURL(blob);

    await browser.downloads.download({
      url: blobUrl,
      filename: `fttf-${Date.now()}.json`,
      saveAs: true,
    });
  }

  /**
   * Get a batch of documents for streaming export
   * @param payload The batch options including offset and limit
   * @returns A batch of documents
   */
  async getDocumentBatch({ offset = 0, limit = 100 }: { offset: number; limit: number }) {
    try {
      const result = await this.db!.query(
        `SELECT * FROM document ORDER BY id LIMIT $1 OFFSET $2;`,
        [limit, offset],
        { rowMode: "array" }
      );

      return {
        rows: result.rows,
        success: true,
      };
    } catch (error) {
      console.error("Error fetching document batch:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      };
    }
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

  private async getMatchingBlacklistRule(
    url: string
  ): Promise<{ level: "no_index" | "url_only" } | null> {
    const result = await this.db!.query<{ level: "no_index" | "url_only" }>(
      `SELECT level FROM blacklist_rule WHERE $1 LIKE pattern ORDER BY created_at DESC LIMIT 1`,
      [url]
    );
    return result.rows[0] || null;
  }

  /**
   * Will add (or re-add) the default blacklist rules.
   */
  async addDefaultBlacklistRules() {
    console.log("blaclist :: init");
    await this.db!.transaction(async (tx) => {
      for (const [pattern, level] of defaultBlacklistRules) {
        await tx.query(
          "INSERT INTO blacklist_rule (pattern, level) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [pattern, level]
        );
      }
    });
  }

  /**
   * Add a blacklist rule. If the rule already exists, the level will be updated.
   */
  async addBlacklistRule(payload: {
    pattern: string;
    level: "no_index" | "url_only";
  }): Promise<number> {
    const { pattern, level } = z
      .object({
        pattern: z.string(),
        level: z.enum(["no_index", "url_only"]),
      })
      .parse(payload);

    console.debug("addBlacklistRule :: pattern", pattern, level);

    const result = await this.db!.query<{ id: number }>(
      `INSERT INTO blacklist_rule (pattern, level) VALUES ($1, $2) 
      ON CONFLICT (pattern) 
      DO UPDATE 
        SET level = $2 
      RETURNING id`,
      [pattern, level]
    );

    return result.rows[0].id;
  }

  async removeBlacklistRule(id: number) {
    const result = await this.db!.query<{ id: number }>(
      `DELETE FROM blacklist_rule WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0]?.id;
  }

  async getBlacklistRules(): Promise<
    Array<{ id: number; pattern: string; level: "no_index" | "url_only" }>
  > {
    const result = await this.db!.query<{
      id: number;
      pattern: string;
      level: "no_index" | "url_only";
    }>(`SELECT id, pattern, level FROM blacklist_rule ORDER BY created_at DESC`);
    return result.rows;
  }

  async importDocumentsJSONv1(payload: { document: any[][] }) {
    console.log("importDocumentsJSONv1 :: documents", payload.document.length);

    const documentColumns = [
      "id",
      "title",
      "url",
      "excerpt",
      "md_content",
      "md_content_hash",
      "publication_date",
      "hostname",
      "last_visit",
      "last_visit_date",
      "extractor",
      "created_at",
      "updated_at",
    ];

    let importedCount = 0;
    let batchSize = 50; // Process in smaller batches to provide progress updates

    // Process documents in batches
    for (let i = 0; i < payload.document.length; i += batchSize) {
      const batch = payload.document.slice(i, i + batchSize);

      await this.db!.transaction(async (tx) => {
        for (const row of batch) {
          const document = Object.fromEntries(documentColumns.map((col, i) => [col, row[i]]));

          try {
            // NOTE: We want a string here, not a URL object
            const url = normalizeUrl(document.url).href;

            const result = await tx.query<{ id: number }>(
              `INSERT INTO document (
                title, url, excerpt, md_content, md_content_hash, publication_date,
                hostname, last_visit, last_visit_date, extractor, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, MD5($4), $5, $6, $7, $8, $9, $10, $11
              ) ON CONFLICT (url) DO NOTHING
              RETURNING id;`,
              [
                document.title,
                url,
                document.excerpt,
                document.md_content,
                document.publication_date,
                document.hostname,
                document.last_visit,
                document.last_visit_date,
                document.extractor,
                document.created_at,
                document.updated_at,
              ]
            );

            if (result.rows.length > 0) {
              const documentId = result.rows[0].id;
              console.log("importDocuments :: inserted", documentId);
              importedCount++;
              await this.jobQueue?.enqueue("generate_fragments", { document_id: documentId }, tx);
            } else {
              const u = url.toString();
              console.log(
                "importDocuments :: duplicate",
                u.length > 100 ? u.slice(0, 100) + "..." : u
              );
            }
          } catch (err) {
            console.error("Error importing document", err, document.url);
            // Continue with other documents even if one fails
          }
        }
      });

      // Send progress update after each batch
      chrome.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "progress",
        current: Math.min(i + batchSize, payload.document.length),
        total: payload.document.length,
        message: `Processed ${Math.min(i + batchSize, payload.document.length)} of ${
          payload.document.length
        } documents...`,
      });
    }

    console.log("importDocuments :: complete", importedCount);

    // Trigger generating the fragments
    this.processJobQueue();

    // Create the embeddings tasks but do not yet run the queue
    //await this.enqueueAllEmbeddings();

    return {
      imported: importedCount,
      duplicates: payload.document.length - importedCount,
    };
  }
}
