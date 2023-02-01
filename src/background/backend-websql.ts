import { formatDebuggablePayload, shasum } from "../common/utils";
import { Article, ArticleRow, Backend, RemoteProcWithSender } from "./backend";
import Turndown from 'turndown'

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
CREATE TABLE IF NOT EXISTS "urls" (
  "url" TEXT UNIQUE NOT NULL,
  "urlHash" VARCHAR(32) PRIMARY KEY NOT NULL,
  "title" TEXT,
  "lastVisit" INTEGER,
  "hostname" TEXT,
  "textContentHash" TEXT,
  "createdAt" INTEGER NOT NULL
);
`,

  `CREATE INDEX IF NOT EXISTS "urls_hostname" ON "urls" ("hostname");`,

  `
CREATE TABLE IF NOT EXISTS "documents" (
  "textContentHash" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT, 
  "url" TEXT UNIQUE NOT NULL,
  "textContent" TEXT,
  "mdContent" TEXT,
  "publicationDate" INTEGER,
  "hostname" TEXT,
  "lastVisit" INTEGER,
  "lastVisitDate" TEXT,
  "extractor" TEXT,
  "createdAt" INTEGER NOT NULL
);
  `,

  `CREATE INDEX IF NOT EXISTS "documents_hostname" ON "documents" ("hostname");`,
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

  indexPage: Backend["indexPage"] = async ({ htmlContent, date, ...payload }, sender) => {
    const { tab } = sender;

    // remove adjacent whitespace since it serves no purpose. The html or
    // markdown content stores formatting.
    const plainText = payload.textContent.replace(/\s+/g, " ").trim();

    // generate a hash of the text content
    const textContentHash = await shasum(plainText);
    let mdContent = "";
    try {
      mdContent = this.turndown.turndown(htmlContent);
    } catch (err) {
      console.error("turndown failed", err);
    }

    const u = new URL(tab?.url || "");
    const document: ArticleRow = {
      ...payload,
      textContentHash,
      mdContent,
      publicationDate: date ? new Date(date).getTime() : undefined,
      url: u.href,
      hostname: u.hostname,
      textContent: plainText,
      lastVisit: Date.now(),
      lastVisitDate: new Date().toISOString().split("T")[0],
      createdAt: Date.now(),
    };

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(formatDebuggablePayload(document));

    await this.upsertDocument(document);

    return {
      ok: true,
      message: `indexed doc:${textContentHash}, url:${u.href}`,
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
    const likeClause = `%${query}%`;
    const results = await this.findMany<ArticleRow>(`
      SELECT * FROM documents
      WHERE textContent LIKE ?
         OR url LIKE ?
         OR title LIKE ?
      ORDER BY lastVisit DESC
      LIMIT 100;
    `, [likeClause, likeClause, likeClause]);

    return {
      ok: true,
      results,
    }
  }

  // ------------------------------------------------------
  // implementation details
  //

  private upsertDocument = async (document: ArticleRow) => {
    return this.executeSql(`
      INSERT OR REPLACE INTO documents (
        textContentHash,
        title,
        url,
        textContent,
        mdContent,
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
    `, [
      document.textContentHash,
      document.title,
      document.url,
      document.textContent,
      document.mdContent,
      document.publicationDate,
      document.hostname,
      document.lastVisit,
      document.lastVisitDate,
      document.extractor,
      document.createdAt,
    ]);
  }

  private _db: Database;
  private _dbReady = false;
  private turndown = new Turndown({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    hr: "---",
  });

  constructor(opts: WebSQLBackendOpts = defaults) {
    const { maxSize } = opts;

    const _db = openDatabase("readflow", "1.0", "Readflow database", maxSize, () => {
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
        );`,
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
        [sql],
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
        () => resolve(null),
      );
    }).then((x) => {
      console.warn("Transaction triggered. Transactions do not track mutations.");
      // handleDbMutated(); // @see Note
      return x;
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
          },
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
