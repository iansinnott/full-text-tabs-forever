import initWasm, { SQLite3, type DB } from "@vlcn.io/crsqlite-wasm";
// @ts-expect-error TS doesn't understand this?
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import {} from "@vlcn.io/wa-sqlite";
import { formatDebuggablePayload, getArticleFragments, shasum } from "../common/utils";
import {
  Article,
  ArticleRow,
  Backend,
  DetailRow,
  RemoteProcWithSender,
  ResultRow,
} from "./backend";
import browser from "webextension-polyfill";

function prepareFtsQuery(query: string): string {
  return (
    query
      .split(" ")
      .map((word) => {
        // Escape double quotes in the query
        const escapedWord = word.trim().replace(/"/g, '""');
        // Wrap the query in double quotes to treat it as a literal string
        return `"${escapedWord}"`;
      })
      .join(" ") + "*"
  ); // The logic here is to wrap the final word with a wildcard. Might need some experimentation
}
type SQLiteArg = NonNullable<Parameters<DB["execO"]>[1]>[number];
const argToSqlite = (v: unknown): SQLiteArg | undefined => {
  switch (typeof v) {
    case "string":
    case "number":
    case "bigint":
      return v;

    case "boolean":
      return Number(v);

    case "symbol":
      return v.toString();

    case "function":
    default:
      if (Array.isArray(v)) {
        return v;
      } else if (v === null) {
        return v;
      } else if (typeof v === "object" && v !== null) {
        return JSON.stringify(v);
      } else {
        return undefined;
      }
  }
};

const validate = (values: Record<string, unknown>) => {
  const keys: string[] = [];
  const vals: SQLiteArg[] = [];
  let invalid: Record<string, any> | undefined = undefined;

  for (const [k, v] of Object.entries(values)) {
    const x = argToSqlite(v);
    if (x !== undefined) {
      keys.push(k);
      vals.push(x);
    } else {
      if (!invalid) invalid = {};
      invalid[k] = v;
    }
  }

  return { keys, vals, invalid };
};

const SQLFormat = {
  /**
   * A template literal to make querying easier. Unlike the others this one just
   * takes a template string and tries to extract the variables into positoinal
   * args.
   */
  format: (strings: TemplateStringsArray, ...values: any[]) => {
    let str = "";
    const args: SQLiteArg[] = [];
    let invalid: Record<number, any> | undefined = undefined;

    strings.forEach((string, i) => {
      const v = argToSqlite(values[i]);
      if (v !== undefined) {
        str += string + "?";
        args.push(v);
      } else {
        if (!invalid) invalid = {};
        invalid[i] = values[i];
        str += string;
      }
    });

    return [str, args] as const;
  },

  insert: (table: string, values: Record<string, unknown>) => {
    const { keys, vals, invalid } = validate(values);
    const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys
      .map(() => "?")
      .join(", ")})`;

    return [sql, vals, invalid] as const;
  },
  update: (table: string, values: Record<string, unknown>, condition: string) => {
    const { keys, vals, invalid } = validate(values);
    const sql = `UPDATE ${table} SET ${keys
      .map((key) => `${key} = ?`)
      .join(", ")} WHERE ${condition}`;

    return [sql, vals, invalid] as const;
  },
};

// @note In order to avoid duplication, since we're indexing every URL the user
// visits, a document has a 1:n relationship with a URL. Multiple URLs can have
// the same document, for example text that says '404 not found'.
const migrations = [
  `
CREATE TABLE IF NOT EXISTS "document" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "title" TEXT, 
  "url" TEXT UNIQUE NOT NULL,
  "excerpt" TEXT,
  "mdContent" TEXT,
  "mdContentHash" TEXT,
  "publicationDate" INTEGER,
  "hostname" TEXT,
  "lastVisit" INTEGER,
  "lastVisitDate" TEXT,
  "extractor" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER
);
  `,

  `CREATE INDEX IF NOT EXISTS "document_hostname" ON "document" ("hostname");`,

  `
CREATE TABLE IF NOT EXISTS "document_fragment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "entityId" INTEGER NOT NULL REFERENCES "document" ("id") ON DELETE CASCADE,
  "attribute" TEXT, 
  "value" TEXT,
  "order" INTEGER,
  "createdAt" INTEGER
);
  `,
];

// NOTE: This is unused until this lands: https://github.com/vlcn-io/js/issues/31
const ftsMigrations = [
  `
CREATE VIRTUAL TABLE "fts" USING fts5(
  entityId,
  attribute,
  value,
  tokenize='porter unicode61 remove_diacritics 1'
);
`,

  `
  CREATE TRIGGER "fts_ai" AFTER INSERT ON "document_fragment" BEGIN
    INSERT INTO "fts" ("rowid", "entityId", "attribute", "value") VALUES (new."id", new."entityId", new."attribute", new."value");
  END;
  `,

  `
  CREATE TRIGGER "fts_ad" AFTER DELETE ON "document_fragment" BEGIN
    DELETE FROM "fts" WHERE rowid=old."id";
  END;
  `,

  `
  CREATE TRIGGER IF NOT EXISTS "fts_au" AFTER UPDATE ON "document_fragment" BEGIN
    DELETE FROM "fts" WHERE rowid=old."id";
    INSERT INTO "fts" ("rowid", "entityId", "attribute", "value") VALUES (new."id", new."entityId", new."attribute", new."value");
  END;
    `,
];

/**
 * Run migrations against a database
 */
const migrate = async ({ migrations, db }: { migrations: string[]; db: DB }) => {
  for (let sql of [...migrations, ...ftsMigrations]) {
    sql = sql.trim(); // @note We really should also strip leading whitespace. this is to help avoid sql differing due to formatting

    const exists = await db.execO<{ id: number }>(
      `SELECT * FROM internal_migrations WHERE sql = ? LIMIT 1`,
      [sql]
    );

    if (exists.length) {
      console.debug("migration already run, skipping ::", exists[0].id);
      continue;
    }

    await db.exec(sql);
    await db.exec(`INSERT INTO internal_migrations (sql, date) VALUES (?, ?)`, [
      sql,
      new Date().toISOString(),
    ]);
  }
};

export class VLCN implements Backend {
  error: Error | null = null;

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

    if (!this._dbReady) {
      return {
        ok: false,
        error: "db not ready",
      };
    }

    return {
      ok: true,
    };
  };

  getPageStatus: Backend["getPageStatus"] = async (payload, sender) => {
    const { tab } = sender;
    let shouldIndex = tab?.url?.startsWith("http"); // ignore chrome extensions, about:blank, etc

    try {
      const url = new URL(tab?.url || "");
      if (url.hostname === "localhost") shouldIndex = false;
      if (url.hostname.endsWith(".local")) shouldIndex = false;
      const existing = await this.findOne({ where: { url: url.href } });
      shouldIndex = !existing || !existing.mdContent; // Try to index if there is not yet any content
      if (existing) {
        this.touchDocument({
          id: existing.id,
          updatedAt: Date.now(),
          lastVisit: Date.now(),
          lastVisitDate: new Date().toISOString().split("T")[0],
        });
      }
    } catch (err) {
      // should not happen
      return {
        shouldIndex: false,
        error: err.message,
      };
    }

    console.debug(`%c${"getPageStatus"}`, "color:lime;", { shouldIndex, url: tab?.url }, payload);

    return {
      shouldIndex,
    };
  };

  indexPage: Backend["indexPage"] = async (
    { /* htmlContent, */ date, textContent, mdContent, ...payload },
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
      mdContent,
      mdContentHash,
      publicationDate: date ? new Date(date).getTime() : undefined,
      url: u.href,
      hostname: u.hostname,
      lastVisit: Date.now(),
      lastVisitDate: new Date().toISOString().split("T")[0],
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

  search: Backend["search"] = async (payload) => {
    let { query, limit = 100, offset = 0, orderBy = "updatedAt", preprocessQuery = true } = payload;
    console.debug(`%c${"search"}`, "color:lime;", query);

    if (preprocessQuery) {
      query = prepareFtsQuery(query);
    }

    const startTime = performance.now();
    const _orderBy = orderBy === "rank" ? "fts.rank" : "d.updatedAt";

    const [count, results] = await Promise.all([
      this.findOneRaw<{ count: number }>(`SELECT COUNT(*) as count FROM fts WHERE fts MATCH ?;`, [
        query,
      ]),
      // @note Ordering by date as a rasonable sorting mechanism. would be good
      // to support dynamically sorting by fts.rank also. Also, downranking
      // search engine results (check hostname for google, duckduckgo, kagi,
      // etc)
      this.sql<ResultRow>`
      SELECT 
        fts.rowid,
        d.id as entityId,
        fts.attribute,
        SNIPPET(fts, -1, '<mark>', '</mark>', '…', 63) AS snippet,
        d.url,
        d.hostname,
        d.title,
        d.excerpt,
        d.lastVisit,
        d.lastVisitDate,
        d.mdContentHash,
        d.updatedAt,
        d.createdAt,
        fts.rank,
        CASE 
          WHEN d.hostname IN ('localhost') THEN -50
          WHEN d.hostname IN ('google.com', 'www.google.com', 'kagi.com', 'duckduckgo.com', 'bing.com') THEN -10 
          WHEN d.hostname IN ('amazon.com', 'www.amazon.com') THEN -5
          ELSE 0 
        END AS rank_modifier
      FROM fts
        INNER JOIN "document" d ON d.id = fts.entityId
      WHERE fts MATCH ${query}
      ORDER BY 
        rank_modifier DESC,
        ${_orderBy} DESC
      LIMIT ${limit}
      OFFSET ${offset};`,
    ]);
    const endTime = performance.now();

    return {
      ok: true,
      results,
      count: count?.count,
      perfMs: endTime - startTime,
      query,
    };
  };

  // ------------------------------------------------------
  // implementation details
  //

  private upsertFragments = async (
    entityId: number,
    document: Partial<{
      url: string;
      title: string;
      excerpt: string;
      textContent: string;
    }>
  ) => {
    const fragments = getArticleFragments(document.textContent || "");

    // @note we NEED the 'OR IGNORE' as opposed to 'OR REPLACE' for now. The on
    // create trigger kept on firing so there were duplicate recors in the fts
    // table. might be solved by figuring out how to get FTS to use a text
    // primary key instead of rowid
    // Update: I think it's becuase insert or replace causes a new ROWID to be
    // written (also a new autoincrement id if that's what you used). This
    // causes the insert trigger on sqlite.
    const sql = `
      INSERT OR IGNORE INTO "document_fragment" (
        "entityId",
        "attribute",
        "value",
        "order"
      ) VALUES (
        ?,
        ?,
        ?,
        ?
      );
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

    await this._db.tx(async (tx) => {
      for (const param of triples) {
        await tx.exec(sql, param);
      }
    });

    return;
  };

  private touchDocument = async (document: Partial<ArticleRow> & { id: number }) => {
    // update the document updatedAt time
    await this.sql`
        UPDATE "document" 
        SET updatedAt = ${document.updatedAt},
            lastVisit = ${document.lastVisit},
            lastVisitDate = ${document.lastVisitDate}
        WHERE id = ${document.id};
      `;
  };

  private upsertDocument = async (document: Partial<ArticleRow>) => {
    const doc = await this.findOneRaw<ArticleRow>(
      `
      SELECT id FROM "document" WHERE url = ?;
    `,
      [document.url]
    );

    if (doc) {
      // update the document updatedAt time
      const [sql, args, invalid] = SQLFormat.update(
        `document`,
        {
          updatedAt: Date.now(),
          excerpt: document.excerpt,
          mdContent: document.mdContent,
          mdContentHash: document.mdContentHash,
          lastVisit: document.lastVisit,
          lastVisitDate: document.lastVisitDate,
        },
        `id = ${doc.id}`
      );

      console.debug("upsertDocument ::", sql, args, invalid);

      // Return nothing to indicate that nothing was inserted
      return;
    }

    const [sql, args, invalid] = SQLFormat.insert(`document`, {
      title: document.title,
      url: document.url,
      excerpt: document.excerpt,
      mdContent: document.mdContent,
      mdContentHash: document.mdContentHash,
      publicationDate: document.publicationDate,
      hostname: document.hostname,
      lastVisit: document.lastVisit,
      lastVisitDate: document.lastVisitDate,
      extractor: document.extractor,
      updatedAt: document.updatedAt || Date.now(),
      createdAt: document.createdAt || Date.now(),
    });

    console.debug("upsertDocument ::", sql, args, invalid);

    await this._db.exec(sql, args);

    return this.findOne({ where: { url: document.url } });
  };

  // @ts-expect-error TS rightly thinks this is not initialized, however, the
  // rest of the code won't run until it is so I find it helpful to not
  // constantly have to null-check this
  private _db: DB;

  private _dbReady = false;

  // @todo How much more/less efficient would it be to run turndown in the
  // backend? This way it would only be loaded/parsed once. The only reason I
  // moved this to the frontend was something to do with the turndown browser
  // build not working in the backend context.
  // private turndown = new Turndown({
  //   headingStyle: "atx",
  //   codeBlockStyle: "fenced",
  //   hr: "---",
  // });

  constructor() {
    this.init()
      .then(() => {
        console.debug("DB ready");
      })
      .catch((err) => {
        console.error("Error initializing db", err);
        throw err;
      });
  }

  initDb = async ({
    dbPath,
    sqlite,
    migrations,
  }: {
    dbPath: string;
    sqlite: SQLite3;
    migrations: string[];
  }) => {
    const db = await sqlite.open(dbPath);

    console.debug(`db opened: :: ${dbPath}`);

    // Make sure migration table exists
    await db.exec(
      `CREATE TABLE IF NOT EXISTS internal_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sql TEXT UNIQUE NOT NULL,
          date TEXT
        );`
    );

    // Run migrations
    console.debug("migrations :: start");
    await migrate({ migrations, db });
    console.debug("migrations :: complete", migrations.length);

    return db;
  };

  private init = async () => {
    try {
      const sqlite = await initWasm(() => wasmUrl);
      console.debug("sqlite wasm loaded ::", wasmUrl);
      this._db = await this.initDb({
        dbPath: "fttf_20231102.3.sqlite",
        sqlite,
        migrations,
      });
      this._dbReady = true;
    } catch (err) {
      console.error("Error running migrations", err);
      this.error = err;
      throw err;
    }
  };

  /**
   * A template literal to make querying easier. Will forward ot execO once args are formatted.
   */
  sql = async <T extends {} = {}>(strings: TemplateStringsArray, ...values: any[]) => {
    const [str, args] = SQLFormat.format(strings, ...values);
    console.debug("sql ::", str, args);
    return this._db.execO<T>(str, args);
  };

  findOne = async ({ where }): Promise<DetailRow | null> => {
    return this.findOneRaw<DetailRow>(`SELECT * FROM "document" WHERE url = ? LIMIT 1`, [
      where.url,
    ]);
  };

  async reindex() {
    return this._db.tx(async (tx) => {
      await tx.exec(`DELETE FROM "fts";`);
      await tx.exec(`INSERT INTO "fts" (rowid, entityId, attribute, value)
                     SELECT "id", "entityId", "attribute", "value" FROM "document_fragment";`);
    });
  }

  async getStats() {
    const [document, document_fragment, db_size] = await Promise.all([
      this._db.execO<{ count: number }>(`SELECT COUNT(*) as count FROM document;`),
      this._db.execO<{ count: number }>(`SELECT COUNT(*) as count FROM document_fragment;`),
      this._db.execO<{ size: number }>(
        `SELECT (page_count * page_size) as size FROM pragma_page_count(), pragma_page_size();`
      ),
    ]);

    return {
      document: {
        count: document[0].count,
      },
      document_fragment: {
        count: document_fragment[0].count,
      },
      db: {
        size_bytes: db_size[0].size,
      },
    };
  }

  async exportJson() {
    const data = {
      document: await this._db.execA(`SELECT * FROM document;`),
      document_fragment: await this._db.execA(`SELECT * FROM document_fragment;`),
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

  /** Totally untested. Might not actualy work */
  async importJson(json: Record<string, any[][]>) {
    console.log("importJson :: documents", json.document.length);
    console.log("importJson :: fragments", json.document_fragment.length);

    await this._db.tx(async (tx) => {
      for (const row of json.document) {
        await tx.exec(
          `INSERT OR IGNORE INTO document (` +
            row.map((_, i) => `"${json.document[0][i]}"`).join(", ") +
            `) VALUES (` +
            row.map(() => "?").join(", ") +
            `);`,
          row
        );
      }
      for (const row of json.document_fragment) {
        await tx.exec(
          `INSERT OR IGNORE INTO document (` +
            row.map((_, i) => `"${json.document[0][i]}"`).join(", ") +
            `) VALUES (` +
            row.map(() => "?").join(", ") +
            `);`,
          row
        );
      }
    });

    console.log("importJson :: complete");
  }

  private createObjectURL = async (blob: Blob): Promise<string> => {
    if (URL && typeof URL.createObjectURL === "function") {
      // We're in Firefox and can use the native function
      return URL.createObjectURL(blob);
    }

    // Rather than URL.createObjectURL, we use a FileReader to create a usable
    // URL. This is because the download API requires a URL, and web workers in
    // don't support the blob URL api. Not memory efficient, but it will work if
    // the chrome extension is allowed to consume enough memory to encode the
    // database tables.
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
  };

  private findOneRaw = async <T extends {} = {}>(
    sql: string,
    args?: ObjectArray
  ): Promise<T | null> => {
    const xs = await this._db.execO<T>(sql, args);

    if (xs.length > 1) {
      console.warn("findOne returned more than one result. Returning first result.");
    }

    if (xs.length === 0) {
      return null;
    }

    return xs[0];
  };
}
