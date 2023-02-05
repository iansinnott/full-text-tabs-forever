import { formatDebuggablePayload, getArticleFragments, shasum } from "../common/utils";
import { Article, ArticleRow, Backend, RemoteProcWithSender, ResultRow } from "./backend";
import Turndown from "turndown";

// Just for typing...
declare const openDatabase: typeof window.openDatabase;

type WebSQLBackendOpts = {
  maxSize: number;
};

const _10gb = 10 * 1024 * 1024 * 1024;

const defaults: WebSQLBackendOpts = {
  maxSize: _10gb,
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
  "createdAt" INTEGER NOT NULL
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

  // @note Browser sqlite does not support FTS4 or 5, so we use FTS3. Also, 'if
  // not exists' is not supported on virtual tables.
  `
CREATE VIRTUAL TABLE "fts" USING fts3(
  entityId,
  attribute,
  value,
  tokenize='porter'
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

export class WebSQLBackend implements Backend {
  getPageStatus: Backend["getPageStatus"] = async (payload, sender) => {
    const { tab } = sender;
    let shouldIndex = tab?.url?.startsWith("http"); // ignore chrome extensions, about:blank, etc

    try {
      const url = new URL(tab?.url || "");
      if (url.hostname === "localhost") shouldIndex = false;
      if (url.hostname.endsWith(".local")) shouldIndex = false;
    } catch (err) {
      // should not happen
      throw err;
    }

    console.log(`%c${"getPageStatus"}`, "color:lime;", { shouldIndex, url: tab?.url }, payload);

    return {
      shouldIndex,
    };
  };

  indexPage: Backend["indexPage"] = async (
    { htmlContent, date, textContent, ...payload },
    sender
  ) => {
    const { tab } = sender;

    let mdContent: string | undefined = undefined;
    let mdContentHash: string | undefined = undefined;
    try {
      mdContent = this.turndown.turndown(htmlContent);
      mdContentHash = await shasum(mdContent);
    } catch (err) {
      console.error("turndown failed", err);
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

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(
      formatDebuggablePayload({
        title: document.title,
        textContent,
        siteName: document.siteName,
      })
    );

    const inserted = await this.upsertDocument(document);

    if (inserted) {
      console.log(
        `%c  ${"new insertion"}`,
        "color:gray;",
        `indexed doc:${inserted.insertId}, url:${u.href}`
      );
      await this.upsertFragments(inserted.insertId, {
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
    console.log(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return {
      ok: true,
    };
  };

  search: Backend["search"] = async (payload) => {
    const { query } = payload;
    console.log(`%c${"search"}`, "color:lime;", query);

    // @note The SNIPPET syntax is FTS3 syntax, not FTS5. This cannot be copied to an FTS5 database and work
    const results = await this.findMany<ResultRow>(
      `
      SELECT 
        fts.rowid,
        d.id as entityId,
        fts.attribute,
        SNIPPET(fts, '<mark>', '</mark>', '…', -1, 50) AS snippet,
        d.url,
        d.title,
        d.excerpt,
        d.lastVisit,
        d.lastVisitDate,
        d.mdContentHash,
        d.createdAt
      FROM fts
        INNER JOIN "document" d ON d.id = fts.entityId
      WHERE fts MATCH ?
      LIMIT 100;
    `,
      [query]
    );

    return {
      ok: true,
      results,
    };
  };

  // ------------------------------------------------------
  // implementation details
  //

  private upsertFragments = async (
    entityId: number,
    document: Partial<{ url: string; title: string; excerpt: string; textContent: string }>
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

    console.log({ entityId, fragments });

    let params: [number, string, string, number][] = [];
    if (document.title) params.push([entityId, "title", document.title, 0]);
    if (document.excerpt) params.push([entityId, "excerpt", document.excerpt, 0]);
    if (document.url) params.push([entityId, "url", document.url, 0]);
    params = params.concat(
      fragments.map((fragment, i) => {
        return [entityId, "content", fragment, i];
      })
    );

    return this.transaction((tx) => {
      params.forEach((param) => {
        tx.executeSql(sql, param);
      });
    });
  };

  private upsertDocument = async (document: Partial<ArticleRow>) => {
    const doc = await this.findOne<ArticleRow>(
      `
      SELECT id FROM "document" WHERE url = ?;
    `,
      [document.url]
    );

    if (doc) {
      console.log("doc already exists, not updating", doc);
      return;
    }

    return this.executeSql(
      `
      INSERT INTO "document" (
        title,
        url,
        excerpt,
        mdContent,
        mdContentHash,
        publicationDate,
        hostname,
        lastVisit,
        lastVisitDate,
        extractor,
        createdAt
      ) VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
    `,
      [
        document.title,
        document.url,
        document.excerpt,
        document.mdContent,
        document.mdContentHash,
        document.publicationDate,
        document.hostname,
        document.lastVisit,
        document.lastVisitDate,
        document.extractor,
        document.createdAt || Date.now(),
      ]
    );
  };

  private _db: Database;
  private _dbReady = false;
  private turndown = new Turndown({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    hr: "---",
  });

  constructor(opts: WebSQLBackendOpts = defaults) {
    const { maxSize } = opts;

    const _db = openDatabase("fttf", "1.0", "Full Text Tabs Forever Database", maxSize, () => {
      console.log("Initial DB creation"); // only runs on initial creation
    });

    this._db = _db;

    this.init()
      .then(() => {
        console.debug("DB ready");
      })
      .catch((err) => {
        console.error("Error initializing db", err);
        throw err;
      });
  }

  private init = async () => {
    try {
      // Make sure migration table exists
      await this.executeSql(
        `CREATE TABLE IF NOT EXISTS internal_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sql TEXT UNIQUE NOT NULL,
          date TEXT
        );`
      );

      // Run migrations
      await this.migrate();
    } catch (err) {
      console.error("Error running migrations", err);
      throw err;
    }

    this._dbReady = true;
  };

  private migrate = async () => {
    for (let sql of migrations) {
      sql = sql.trim(); // @note We really should also strip leading whitespace. this is to help avoid sql differing due to formatting

      const exists = await this.findOne<{ id: number }>(
        `SELECT * FROM internal_migrations WHERE sql = ? LIMIT 1`,
        [sql]
      );

      if (exists) {
        continue;
      }

      await this.executeSql(sql);
      await this.executeSql(`INSERT INTO internal_migrations (sql, date) VALUES (?, ?)`, [
        sql,
        new Date().toISOString(),
      ]);
    }
  };

  // @note `transaction` does not notify of changes on complete.
  private transaction = (fn: SQLTransactionCallback) => {
    return new Promise((resolve, reject) => {
      this._db.transaction(
        fn,
        (err) => reject(err),
        () => resolve(null)
      );
    });
  };

  private executeSql(sqlStatement: DOMString, args?: ObjectArray): Promise<SQLResultSet> {
    return new Promise((resolve, reject) => {
      this._db.transaction((tx) => {
        tx.executeSql(
          sqlStatement,
          args,
          (_, result) => resolve(result),
          // @ts-ignore supposed to return a bool here, but I couldn't find docs for what it signifies
          (_, err) => {
            reject(err);
          }
        );
      });
    });
  }

  private findMany = async <T = any>(sql: string, args?: ObjectArray): Promise<T[]> => {
    const { rows } = await this.executeSql(sql, args);
    const items: T[] = [];

    for (let i = 0; i < rows.length; i++) {
      items.push(rows.item(i) as T);
    }

    return items;
  };

  private findOne = async <T = any>(sql: string, args?: ObjectArray): Promise<T | null> => {
    const { rows } = await this.executeSql(sql, args);

    if (rows.length > 1) {
      console.warn("findOne returned more than one result. Returning first result.");
    }

    if (rows.length === 0) {
      return null;
    }

    return rows.item(0) as T;
  };
}
