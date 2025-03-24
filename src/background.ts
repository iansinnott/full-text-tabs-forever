// import browser, { omnibox, Runtime } from "webextension-polyfill";

import type { SendResponse } from "./background/backend";
import { VLCN } from "./background/backend-vlcn";
import { PgLiteBackend } from "./background/backend-pglite";
import { log } from "./common/logs";
import { debounce } from "./common/utils";

class BackendAdapter {
  backend: PgLiteBackend;
  _vlcn: VLCN | null = null;

  constructor({ backend }: { backend: PgLiteBackend }) {
    this.backend = backend;
  }

  async onInstalled(details: chrome.runtime.InstalledDetails) {
    log("@todo Check if the backend is available");
  }

  onMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: SendResponse) {
    // Special case for migrating from VLCN to PgLite
    if (message[0] === "importVLCNDocuments" || message[0] === "importVLCNDocumentsV1") {
      this.importVLCNDocumentsV1()
        .then((result) => {
          sendResponse({ ok: true, ...result });
        })
        .catch((err) => {
          sendResponse({ error: err.message });
        });
      return true;
    }

    // Add handler for checking VLCN migration status
    if (message[0] === "checkVLCNMigrationStatus") {
      this.checkVLCNMigrationStatus()
        .then((result) => {
          sendResponse(result);
        })
        .catch((err) => {
          sendResponse({ error: err.message });
        });
      return true;
    }

    let waitForResponse = false;
    try {
      const { tab } = sender;
      const [method, payload] = message as [string, any];

      if (sender.url !== tab?.url) {
        console.log(`%cinfo`, "color:yellow;", "sender URL and tab URL differ. probably iframe");
      }

      // @ts-ignore This could be handled better. unimportant for now
      if (typeof this.backend[method] === "function") {
        waitForResponse = true;
        // @ts-ignore
        this.backend[method](payload, sender)
          .then((ret) => {
            sendResponse(ret);
          })
          .catch((err) => {
            console.error(`backend :: err :: ${method} ::`, payload);
            console.error(err);
            sendResponse({ error: err.message, stack: err.stack });
          });
      } else {
        console.warn(`%c${method}`, "color:yellow;", "is not a valid method", payload);
        sendResponse({ error: `'${method}' is not a valid RPC` });
      }
    } catch (err) {
      console.error("Could not parse message", message, sender, err);
      sendResponse({ error: err.message });
    }

    return waitForResponse; // Keep channel open for async response. Yikes
  }

  async checkVLCNMigrationStatus() {
    try {
      const isComplete = await this.isMigrationComplete();

      if (isComplete) {
        return { available: true, migrated: true };
      }

      if (!this._vlcn) {
        this._vlcn = new VLCN();
        try {
          await this._vlcn.readyPromise;
        } catch (err) {
          console.error("Failed to initialize VLCN", err);
          return { available: false, error: err.message };
        }
      }

      const status = await this._vlcn.getStatus();
      if (!status.ok) {
        return { available: false, error: status.error };
      }

      // Check if there are documents to migrate
      const count = await this._vlcn.sql<{
        count: number;
      }>`select count(*) as count from "document";`;

      return {
        available: true,
        migrated: false,
        documentCount: count[0].count,
      };
    } catch (err) {
      console.error("Error checking VLCN migration status", err);
      return { available: false, error: err.message };
    }
  }

  // Created for debugging workflow
  async openIndexPage() {
    const [existingTab] = await chrome.tabs.query({
      url: chrome.runtime.getURL("index.html"),
    });

    if (existingTab) {
      await chrome.tabs.update(existingTab.id!, { active: true });
    } else {
      await chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
    }
  }

  async setMigrationComplete() {
    // First create the table if it doesn't exist
    await this.backend.db!.exec(
      `CREATE TABLE IF NOT EXISTS migration_info (key TEXT PRIMARY KEY, value TEXT);`
    );

    // Then insert the migration flag
    await this.backend.db!.exec(
      `INSERT INTO migration_info (key, value) VALUES ('migrated_to_pglite', '1') ON CONFLICT(key) DO UPDATE SET value = '1';`
    );
  }

  async isMigrationComplete() {
    try {
      const result = await this.backend.db!.query<{ value: string }>(
        `SELECT value FROM migration_info WHERE key = 'migrated_to_pglite';`
      );
      return result.rows[0]?.value === "1";
    } catch (error) {
      // If we haven't run the migration yet don't consider this an error
      if (error instanceof Error && error.message.includes("does not exist")) {
        return false;
      }

      throw error;
    }
  }

  async importVLCNDocumentsV1() {
    try {
      // Send initial status update
      chrome.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "starting",
        message: "Initializing VLCN database...",
      });

      if (!this._vlcn) {
        this._vlcn = new VLCN();
        await this._vlcn.readyPromise;
      }

      // Check document count
      const count = await this._vlcn.sql<{
        count: number;
      }>`select count(*) as count from "document";`;

      console.log("vlcnAdapter :: count", count);

      if (count[0].count === 0) {
        chrome.runtime.sendMessage({
          type: "vlcnMigrationStatus",
          status: "empty",
          message: "No documents found in the VLCN database.",
        });
        return { imported: 0, message: "No documents found in VLCN database" };
      }

      // Send update with document count
      chrome.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "fetching",
        message: `Found ${count[0].count} documents to migrate...`,
      });

      // Fetch documents
      const docs = await this._vlcn?.db.execA(`SELECT 
        id,
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
        createdAt,
        updatedAt
      FROM "document";`);

      console.log(
        "vlcnAdapter :: docs sample",
        docs.slice(0, 3).map((d) => ({ id: d[0], title: d[1], url: d[2] }))
      );

      // Send update before importing
      chrome.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "importing",
        message: `Beginning import of ${count[0].count} documents...`,
        total: docs.length,
        current: 0,
      });

      // Import the documents
      const result = await this.backend.importDocumentsJSONv1({ document: docs });

      // Send completion status
      chrome.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "complete",
        message: `Migration complete. Imported ${result.imported} documents (${result.duplicates} were duplicates).`,
        result,
      });

      // Mark VLCN database as migrated to prevent duplicate migrations
      try {
        this.setMigrationComplete();

        console.log("Marked VLCN database as migrated successfully");
      } catch (err) {
        console.error("Error marking VLCN database as migrated", err);
      }

      return result;
    } catch (error) {
      console.error("VLCN migration failed", error);

      // Send error status
      chrome.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "error",
        message: `Migration failed: ${error.message}`,
        error: error.message,
      });

      return { error: error.message };
    }
  }
}

// Although there were initially multiple adapters there is no mainly one.
const adapter = new BackendAdapter({
  backend: new PgLiteBackend(),
});

/**
 * Expose for debugging
 * @example await fttf.backend._db.execO(`select * from sqlite_master;`)
 */
globalThis.fttf = adapter;

export type FTTF = {
  adapter: BackendAdapter;
};

if (adapter.onMessage) {
  chrome.runtime.onMessage.addListener((...args) => adapter.onMessage(...args));
}

// @note We do not support spas currently. URL changes trigger here, but we do
// not then instruct the frontend to send the full text.
const updateHandler = debounce(
  async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    console.debug("%ctab update", "color:gray;", "no action performed", tab.url);
    // browser.tabs.sendMessage(tabId, ["onTabUpdated", { tabId, changeInfo }]);
  },
  200
);

// Listen for tab updates, because the content script normally only runs on load. This is for SPA apps
chrome.tabs.onUpdated.addListener((...args) => updateHandler(...args));

// When the extension button is clicked, log a message
chrome.action.onClicked.addListener(async () => {
  await adapter.openIndexPage();
});
