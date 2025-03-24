import type { SendResponse } from "./backend";
import { VLCN } from "./backend-vlcn";
import { PgLiteBackend } from "./backend-pglite";
import { log } from "../common/logs";

export type BackendAdapterRuntime = {
  sendMessage: typeof chrome.runtime.sendMessage;
  getURL: typeof chrome.runtime.getURL;
};

export class BackendAdapter {
  backend: PgLiteBackend;
  runtime: BackendAdapterRuntime;
  _vlcn: VLCN | null = null;

  constructor({ backend, runtime }: { backend: PgLiteBackend; runtime: BackendAdapterRuntime }) {
    this.backend = backend;
    this.runtime = runtime;
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

      const documentCount = count[0].count;

      // Flag the migration as somplete so that we don't continue to initialize
      // VLCN ever time. Ultimately we will remove VLCN completely.
      if (documentCount === 0) {
        await this.setMigrationComplete();
      }

      return {
        available: true,
        migrated: false,
        documentCount,
      };
    } catch (err) {
      console.error("Error checking VLCN migration status", err);
      return { available: false, error: err.message };
    }
  }

  // Created for debugging workflow
  async openIndexPage() {
    const [existingTab] = await chrome.tabs.query({
      url: this.runtime.getURL("index.html"),
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
      this.runtime.sendMessage({
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
        this.runtime.sendMessage({
          type: "vlcnMigrationStatus",
          status: "empty",
          message: "No documents found in the VLCN database.",
        });
        return { imported: 0, message: "No documents found in VLCN database" };
      }

      // Send update with document count
      this.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "fetching",
        message: `Found ${count[0].count} documents to migrate...`,
      });

      // Process documents in batches
      const BATCH_SIZE = 100;
      let imported = 0;
      let duplicates = 0;
      let processed = 0;
      const totalDocuments = count[0].count;

      // Send update before importing
      this.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "importing",
        message: `Beginning import of ${totalDocuments} documents...`,
        total: totalDocuments,
        current: 0,
      });

      while (processed < totalDocuments) {
        // Fetch batch of documents
        const batchQuery = `SELECT 
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
        FROM "document"
        LIMIT ${BATCH_SIZE} OFFSET ${processed};`;

        const batch = await this._vlcn?.db.execA(batchQuery);

        if (batch.length === 0) {
          break; // No more documents to process
        }

        if (processed === 0) {
          // Log sample of first batch only
          console.log(
            "vlcnAdapter :: docs sample",
            batch.slice(0, 3).map((d) => ({ id: d[0], title: d[1], url: d[2] }))
          );
        }

        // Import current batch
        const batchResult = await this.backend.importDocumentsJSONv1({ document: batch });

        imported += batchResult.imported;
        duplicates += batchResult.duplicates;
        processed += batch.length;

        // Update progress
        this.runtime.sendMessage({
          type: "vlcnMigrationStatus",
          status: "importing",
          message: `Imported ${processed} of ${totalDocuments} documents...`,
          total: totalDocuments,
          current: processed,
        });
      }

      const result = { imported, duplicates };

      // Send completion status
      this.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "complete",
        message: `Migration complete. Imported ${result.imported} documents (${result.duplicates} were duplicates).`,
        result,
      });

      // Mark VLCN database as migrated to prevent duplicate migrations
      try {
        await this.setMigrationComplete();

        console.log("Marked VLCN database as migrated successfully");
      } catch (err) {
        console.error("Error marking VLCN database as migrated", err);
      }

      return result;
    } catch (error) {
      console.error("VLCN migration failed", error);

      // Send error status
      this.runtime.sendMessage({
        type: "vlcnMigrationStatus",
        status: "error",
        message: `Migration failed: ${error.message}`,
        error: error.message,
      });

      return { error: error.message };
    }
  }
}
