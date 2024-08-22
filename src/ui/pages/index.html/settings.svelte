<script lang="ts">
  import { handleImport } from "@/ui/lib/commands";
  import { rpc } from "@/ui/lib/rpc";
  import { onMount } from "svelte";

  type BlacklistRule = {
    id: number;
    pattern: string;
    level: "no_index" | "url_only";
  };

  let errorMessage = "";
  let vlcnImportMessage = "";
  let isImporting = false;
  let blacklistRules: BlacklistRule[] = [];

  onMount(async () => {
    await fetchBlacklistRules();
  });

  const handleFileUpload = async () => {
    errorMessage = "";
    const result = await handleImport();
    if (!result.success && result.message) {
      errorMessage = result.message;
    }
  };

  const importVLCNDatabase = async () => {
    isImporting = true;
    vlcnImportMessage = "Importing VLCN database... This may take a while.";
    try {
      const response = await chrome.runtime.sendMessage(["importVLCNDocuments"]);
      if (response.ok) {
        vlcnImportMessage = "VLCN database imported successfully!";
      } else {
        vlcnImportMessage = `Error importing VLCN database: ${response.error}`;
      }
    } catch (error) {
      vlcnImportMessage = `Error importing VLCN database: ${error.message}`;
    } finally {
      isImporting = false;
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
    await chrome.runtime.sendMessage([
      "pg.query",
      {
        sql: "DELETE FROM blacklist_rule WHERE id = $1",
        params: [id],
      },
    ]);
    await fetchBlacklistRules();
  };
</script>

<div class="flex flex-col p-12 h-[calc(100%-70px)] prose dark:prose-invert">
  <h3>Settings</h3>

  <h4>Import JSON Database</h4>
  <p>
    Upload a JSON file to import your database. The file should contain document and
    document_fragment data, which will be processed and added to your local database.
  </p>
  <div class="mt-4">
    <button
      on:click={handleFileUpload}
      class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900">Import JSON</button
    >
  </div>
  {#if errorMessage}
    <p class="text-red-500 mt-2">{errorMessage}</p>
  {/if}

  <h4 class="mt-8">Import VLCN Database (v1)</h4>
  <p>
    Import your old database from v1 of the extension. This will migrate your VLCN documents to the
    new format. The import process may take several minutes depending on the size of your database.
  </p>
  <div class="mt-4">
    <button
      on:click={importVLCNDatabase}
      class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isImporting}
    >
      {#if isImporting}
        Importing...
      {:else}
        Import VLCN Database
      {/if}
    </button>
  </div>
  {#if vlcnImportMessage}
    <p
      class="mt-2"
      class:text-green-500={vlcnImportMessage.includes("successfully")}
      class:text-red-500={vlcnImportMessage.includes("Error")}
    >
      {vlcnImportMessage}
    </p>
  {/if}

  <h4 class="mt-8">Blacklist Rules</h4>
  <p class="mb-0">
    Manage your blacklist rules. These rules determine which URLs should not be indexed or only have
    their URLs indexed.
  </p>
  <p class="mt-4">
    Note: The <code class="wildcard font-sans">%</code> character is used as a wildcard in these
    rules. It matches any sequence of characters. For example, <code>example.com/%</code> would match
    any URL on example.com.
  </p>
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
        <tr>
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
</div>

<style>
  :global(.wildcard) {
    @apply text-yellow-400 font-bold font-sans text-sm;
  }
</style>
