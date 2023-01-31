import { formatDebuggablePayload } from "../common/utils";
import { Article, ArticleRow, Backend, RemoteProc, UrlRow } from "./backend";
import { DBCoreRangeType, Dexie } from "dexie";

function getUniqueWords(text: string) {
  // @note if we want to support zh we need to do better splitting
  var wordSet = text.split(" ").reduce((agg, x) => {
    agg.add(x);
    return agg;
  }, new Set<string>());

  return Array.from(wordSet);
}

function getUrlWords(row: UrlRow) {
  let contentString = row.title ? [row.title] : [];

  try {
    const url = new URL(row.url)
    contentString.push(url.hostname)
    contentString.push(url.hostname.split('.').slice(-2).join('.')) // base domain
    for (const part of url.pathname.split('/')) {
      if (part.length > 2) contentString.push(part)
    }
  } catch (err) {
    console.warn("Coudl not parse url", err)
  }

  if (contentString.length) {
    return getUniqueWords(contentString.map(x => x.trim()).join(" "));
  } else {
    return []
  }
}

class DocumentDatabase extends Dexie {
  urls!: Dexie.Table<UrlRow, number>;
  documents!: Dexie.Table<ArticleRow, number>;
  constructor() {
    super("fttf@2023-02-01.3");

    // @note As per the docs, the values here are only those we want indexed,
    // but we can store any other data we want
    this.version(1).stores({
      urls: "++,&url,&urlHash,title,textContentHash,*searchWords",
      documents: "++,&textContentHash,*searchWords",
    });

    // Add hooks that will index "textContent" for full-text search:
    this.urls.hook("creating", (primKey, row, trans) => {
      row.searchWords = getUrlWords(row);
    });

    this.documents.hook("creating", (primKey, row, trans) => {
      if (typeof row.textContent === "string") row.searchWords = getUniqueWords(row.textContent)
    });

    this.urls.hook("updating", (mods: Partial<ArticleRow>, primKey, row, trans) => {
      row.searchWords = getUrlWords(row);
    });

    this.documents.hook("updating", (mods: Partial<ArticleRow>, primKey, row, trans) => {
      if (typeof row.textContent === "string") {
        // "textContent" property is being updated
        if (typeof mods.textContent == 'string') {

          // "textContent" property was updated to another valid value. Re-index searchWords:
          return { searchWords: getUniqueWords(mods.textContent) };
        } else {
          // "textContent" property was deleted (typeof mods.textContent === 'undefined') or changed to an unknown type. Remove indexes:
          return { searchWords: [] };
        }
      }

    });

  }
}

export class IndexedDbBackend implements Backend {
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

    if (!shouldIndex) return { shouldIndex };
    if (!tab?.url) return { shouldIndex }; // Just for the type bennefits

    const row = await this.db.urls
      .where("url")
      .equals(tab.url)
      .first();

    if (row) {
      console.info("already indexed", row.textContentHash);
    }

    shouldIndex = !row;

    console.log(`%c${"getPageStatus"}`, "color:lime;", { shouldIndex, url: tab?.url }, payload);

    return {
      shouldIndex,
    };
  };

  indexPage: Backend["indexPage"] = async (payload, sender) => {
    const { tab } = sender;

    // remove adjacent whitespace since it serves no purpose. The html or
    // markdown content stores formatting.
    const plainText = payload.textContent.replace(/\s+/g, " ").trim();

    // generate a hash of the text content
    const textContentHash = await shasum(plainText);

    const document = {
      ...payload,
      textContent: plainText,
      textContentHash,
    }

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(formatDebuggablePayload(document));

    const docId = await this.db.documents.add(document);
    const urlId = await this.db.urls.add({
      url: tab?.url || "",
      urlHash: await shasum(tab?.url || ""),
      title: document.title,
      lastVisit: Date.now(),
    })

    return {
      ok: true,
      message: `indexed doc:${docId}, url:${urlId}`,
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    const { tab } = sender;
    console.log(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return {
      ok: true,
    };
  };

  search: Backend["search"] = async (payload, sender) => {
    const { query } = payload;
    const [urls, documents] = await Promise.all([
      this.db.urls
        .where("searchWords")
        .startsWithIgnoreCase(query)
        .distinct()
        .toArray(),
      this.db.documents
        .where("searchWords")
        .startsWithIgnoreCase(query)
        .distinct()
        .toArray(),
    ]);

    return {
      ok: true,
      urls,
      documents: documents.map((doc) => {
        const { htmlContent, mdContent, ...x } = doc;
        return {
          htmlContent: `... truncated ...`,
          mdContent: `... truncated ...`,
          ...x,
        }
      }),
    }
  }

  db: DocumentDatabase;

  constructor() {
    this.db = new DocumentDatabase();
    this.db.open()
  }

  destroy() {
    if (this.db.isOpen()) {
      this.db.close()
    }
  }
}

const shasum = async (text: string) => {
  const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

