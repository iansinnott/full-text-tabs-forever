import { formatDebuggablePayload } from "../common/utils";
import { Article, Backend, RemoteProc } from "./backend";

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
  "urlMd5" VARCHAR(32) PRIMARY KEY NOT NULL,
  "url" TEXT UNIQUE NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "lastVisit" INTEGER,
  "createdAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "documents" (
  id INTEGER PRIMARY KEY AUTOINCREMENT, 
  title TEXT, 
  htmlContent TEXT, 
  textContent TEXT,
  textContentMd5 TEXT UNIQUE NOT NULL,
  mdContent TEXT,
  publicationDate INTEGER,
  "createdAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "url_document_edges" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "urlMd5" VARCHAR(32) UNIQUE NOT NULL REFERENCES urls(urlMd5),
  "textContentMd5" VARCHAR(32) NOT NULL REFERENCES documents(textContentMd5)
);

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

  indexPage: Backend["indexPage"] = async (payload, sender) => {
    const { tab } = sender;

    // remove adjacent whitespace since it serves no purpose. The html or
    // markdown content stores formatting.
    const plainText = payload.textContent.replace(/[ \t]+/g, " ").replace(/\n+/g, "\n");

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(formatDebuggablePayload({ ...payload, textContent: plainText }));
    return {
      "@todo": "actually index page",
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    const { tab } = sender;
    console.log(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return {
      ok: true,
    };
  };

  // ------------------------------------------------------
  // implementation details
  //

  private _db: Database;
  private _dbReady = false;

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
          date TEXT,
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

  private findOne = async <T = any>(sql: string, args?: ObjectArray): Promise<T> => {
    const { rows } = await this.executeSql(sql, args);

    if (rows.length > 1) {
      console.warn("findOne returned more than one result. Returning first result.");
    }

    return rows.item(0) as T;
  };
}
