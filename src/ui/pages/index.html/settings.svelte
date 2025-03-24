<script lang="ts">
  import { handleImport, exportJson } from "@/ui/lib/commands";
  import { rpc } from "@/ui/lib/rpc";
  import { onMount } from "svelte";
  import ExportProgress from "@/ui/ExportProgress.svelte";

  type BlacklistRule = {
    id: number;
    pattern: string;
    level: "no_index" | "url_only";
  };

  let errorMessage = "";
  let vlcnImportMessage = "";
  let isImporting = false;
  let isMigrated = false;
  let blacklistRules: BlacklistRule[] = [];
  let newPattern = "";
  let newLevel: "no_index" | "url_only" = "no_index";
  let addRuleError = "";
  let migrationProgress = 0;
  let totalDocuments = 0;

  // Add this new variable
  let activeSection = "import-json";

  // Export progress tracking
  let isExporting = false;
  let exportProgress = 0;
  let exportTotal = 0;
  let exportErrorMessage = "";

  // Add this new function
  const scrollToSection = (sectionId: string) => {
    activeSection = sectionId;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Listen for migration status updates
  const setupMigrationListener = () => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "vlcnMigrationStatus") {
        console.log("Migration status update:", message);

        if (message.status === "starting" || message.status === "fetching") {
          vlcnImportMessage = message.message;
        } else if (message.status === "importing") {
          totalDocuments = message.total;
          migrationProgress = message.current;
          vlcnImportMessage = message.message;
        } else if (message.status === "progress") {
          migrationProgress = message.current;
          vlcnImportMessage = `Imported ${message.current} of ${message.total} documents...`;
        } else if (message.status === "complete") {
          isImporting = false;
          vlcnImportMessage = message.message;
          migrationProgress = totalDocuments;
        } else if (message.status === "error") {
          isImporting = false;
          vlcnImportMessage = message.message;
        } else if (message.status === "empty") {
          isImporting = false;
          vlcnImportMessage = message.message;
        }
      }
      return true;
    });
  };

  onMount(async () => {
    await fetchBlacklistRules();
    checkVLCNMigrationStatus();
    setupMigrationListener();
  });

  const checkVLCNMigrationStatus = async () => {
    try {
      // First, check if the VLCN backend is available and has been migrated
      const response = await rpc(["checkVLCNMigrationStatus"]);
      if (response?.migrated) {
        isMigrated = true;
        vlcnImportMessage = "VLCN database has already been migrated to PgLite.";
      } else if (!response?.available) {
        vlcnImportMessage =
          "No VLCN database found. If you're a new user, you can ignore this section.";
      }
    } catch (error) {
      console.error("Error checking VLCN migration status", error);
    }
  };

  const handleFileUpload = async () => {
    errorMessage = "";
    const result = await handleImport();
    if (!result.success && result.message) {
      errorMessage = result.message;
    }
  };

  const importVLCNDatabase = async () => {
    isImporting = true;
    migrationProgress = 0;
    vlcnImportMessage = "Initializing VLCN database migration...";
    try {
      await rpc(["importVLCNDocumentsV1"]);
      // Status updates will come through the listener
    } catch (error) {
      isImporting = false;
      vlcnImportMessage = `Error importing VLCN database: ${error.message}`;
    }
  };

  const fetchBlacklistRules = async () => {
    const response = await rpc<{ rows: BlacklistRule[] }>([
      "pg.query",
      {
        sql: "SELECT id, pattern, level FROM blacklist_rule ORDER BY created_at DESC",
        params: [],
      },
    ]);
    blacklistRules = response.rows;
  };

  const deleteBlacklistRule = async (id: number) => {
    await rpc([
      "pg.query",
      {
        sql: "DELETE FROM blacklist_rule WHERE id = $1",
        params: [id],
      },
    ]);
    await fetchBlacklistRules();
  };

  const addBlacklistRule = async () => {
    addRuleError = "";
    if (!newPattern.trim()) {
      addRuleError = "Pattern is required";
      return;
    }

    if (newPattern.replace(/%/g, "").trim().length === 0) {
      addRuleError =
        "Pattern must be more specific. A wildcard-only pattern will match everything, which defeats the purpose of this extension.";
      return;
    }

    if (newPattern.trim().includes("*")) {
      addRuleError = "The '*' character is not allowed. Use '%' instead.";
      return;
    }

    if (!newPattern.trim().startsWith("http") && !newPattern.trim().startsWith("%")) {
      addRuleError = "Pattern must start with 'http' or be a `%` wildcard.";
      return;
    }

    try {
      await rpc(["addBlacklistRule", { pattern: newPattern.trim(), level: newLevel }]);
      newPattern = "";
      newLevel = "no_index";
      await fetchBlacklistRules();
    } catch (error) {
      addRuleError = `Error adding rule: ${error.message}`;
    }
  };
</script>

<ExportProgress visible={isExporting} current={exportProgress} total={exportTotal} />

<div class="flex flex-col md:flex-row p-4 md:p-12 h-[calc(100%-70px)] overflow-auto">
  <nav class="md:w-1/4 mb-4 md:mb-0 md:mr-8">
    <ul
      class="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto md:overflow-x-visible whitespace-nowrap"
    >
      <li>
        <button
          class="px-3 py-2 rounded-md text-sm font-medium {activeSection === 'import-json'
            ? 'bg-pink-800 text-white'
            : 'text-gray-300 hover:bg-gray-700'}"
          on:click={() => scrollToSection("import-json")}
        >
          Import JSON
        </button>
      </li>
      <li>
        <button
          class="px-3 py-2 rounded-md text-sm font-medium {activeSection === 'import-vlcn'
            ? 'bg-pink-800 text-white'
            : 'text-gray-300 hover:bg-gray-700'}"
          on:click={() => scrollToSection("import-vlcn")}
        >
          Import VLCN
        </button>
      </li>
      <li>
        <button
          class="px-3 py-2 rounded-md text-sm font-medium {activeSection === 'blacklist-rules'
            ? 'bg-pink-800 text-white'
            : 'text-gray-300 hover:bg-gray-700'}"
          on:click={() => scrollToSection("blacklist-rules")}
        >
          Blacklist Rules
        </button>
      </li>
    </ul>
  </nav>

  <div class="md:w-3/4 prose dark:prose-invert">
    <h3>Settings</h3>

    <section id="import-json">
      <h4>Import/Export JSON Database</h4>
      <p>
        Upload a JSON file to import your database or export your current database to a JSON file.
      </p>
      <div class="mt-4 flex space-x-2">
        <button
          on:click={handleFileUpload}
          class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900"
        >
          Import JSON
        </button>

        <button
          on:click={async () => {
            isExporting = true;
            exportProgress = 0;
            exportTotal = 0;
            exportErrorMessage = "";

            try {
              // Get initial stats for progress
              const stats = await rpc(["getStats"]);

              // Start with an estimate
              exportTotal = stats.document.count;

              // These variables will be updated by the exportJson function
              // through the onProgress callback in streamingExport
              const result = await exportJson({
                onProgress: (progress) => {
                  // Update the UI progress variables
                  exportProgress = progress.current;
                  exportTotal = progress.total;

                  console.log(
                    `Export progress: ${progress.current}/${progress.total} documents (${Math.round(
                      (progress.current / progress.total) * 100
                    )}%)`
                  );
                },
              });

              if (!result.success) {
                exportErrorMessage = result.message || "Export failed";
              }
            } catch (error) {
              exportErrorMessage = error instanceof Error ? error.message : "Export failed";
            } finally {
              isExporting = false;
            }
          }}
          class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Export JSON
        </button>
      </div>

      {#if errorMessage}
        <p class="text-red-500 mt-2">{errorMessage}</p>
      {/if}
      {#if exportErrorMessage}
        <p class="text-red-500 mt-2">{exportErrorMessage}</p>
      {/if}
    </section>

    <section id="import-vlcn">
      <h4 class="mt-8">Import VLCN Database (v1)</h4>
      <p>
        Import your old database from v1 of the extension. This will migrate your VLCN documents to
        the new format. The import process may take several minutes depending on the size of your
        database.
      </p>
      <div class="mt-4">
        <button
          on:click={importVLCNDatabase}
          class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isImporting || isMigrated}
        >
          {#if isImporting}
            Importing...
          {:else if isMigrated}
            Already Migrated
          {:else}
            Import VLCN Database
          {/if}
        </button>
      </div>
      {#if vlcnImportMessage}
        <div class="mt-2">
          <p
            class:text-green-500={vlcnImportMessage.includes("successfully") ||
              vlcnImportMessage.includes("complete")}
            class:text-red-500={vlcnImportMessage.includes("Error") ||
              vlcnImportMessage.includes("failed")}
            class:text-yellow-500={vlcnImportMessage.includes("already been migrated")}
          >
            {vlcnImportMessage}
          </p>

          {#if isImporting && totalDocuments > 0}
            <div class="mt-2">
              <div class="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                <div
                  class="bg-pink-800 h-2.5 rounded-full"
                  style="width: {(migrationProgress / totalDocuments) * 100}%"
                ></div>
              </div>
              <p class="text-xs text-gray-400 text-right">
                {migrationProgress} of {totalDocuments} documents
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </section>

    <section id="blacklist-rules">
      <h4 class="mt-8">Blacklist Rules</h4>
      <p class="mb-0">
        Manage your blacklist rules. These rules determine which URLs should not be indexed or only
        have their URLs indexed.
      </p>
      <p class="mt-4">
        Note: The <code class="wildcard font-sans">%</code> character is used as a wildcard in these
        rules. It matches any sequence of characters. For example,
        <code>https://example.com/%</code> would match any URL on example.com.
      </p>
      <p class="mt-4">
        You can choose to only index the URL of a page (<code class="wildcard font-sans"
          >url_only</code
        >), or to not index the page at all (<code class="wildcard font-sans">no_index</code>).
      </p>

      <!-- Add new blacklist rule form -->
      <div class="mt-4 mb-4">
        <h5 class="mb-2">Add New Blacklist Rule</h5>
        <form on:submit|preventDefault={addBlacklistRule} class="flex flex-col space-y-2">
          <input
            type="text"
            bind:value={newPattern}
            placeholder="Pattern (e.g., example.com/%)"
            class="p-2 border rounded text-black"
          />
          <select bind:value={newLevel} class="p-2 border rounded text-black">
            <option value="no_index">No Index</option>
            <option value="url_only">URL Only</option>
          </select>
          <button type="submit" class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900">
            Add Rule
          </button>
        </form>
        {#if addRuleError}
          <p class="text-red-500 mt-2">{addRuleError}</p>
        {/if}
      </div>

      <table class="table-auto w-full mt-0">
        <thead>
          <tr>
            <th class="px-4 py-2 text-left">Pattern</th>
            <th class="px-4 py-2 text-left">Level</th>
            <th class="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each blacklistRules as rule}
            <tr class="hover:bg-gray-800">
              <td class="px-2 py-0 font-mono text-xs border-b border-gray-200/20">
                {#if rule.pattern.includes("%")}
                  {@html rule.pattern.replace(/%/g, '<span class="wildcard">%</span>')}
                {:else}
                  {rule.pattern}
                {/if}
              </td>
              <td class="px-2 py-0 border-b border-gray-200/20">{rule.level}</td>
              <td class="px-2 py-0 border-b border-gray-200/20">
                <button
                  on:click={() => deleteBlacklistRule(rule.id)}
                  class="text-red-500 py-1 px-2 rounded"
                >
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  </div>
</div>

<style>
  :global(.wildcard) {
    @apply text-yellow-400 font-bold font-sans text-sm;
  }
</style>
