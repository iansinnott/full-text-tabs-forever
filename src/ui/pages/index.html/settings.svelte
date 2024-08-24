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
  let newPattern = "";
  let newLevel: "no_index" | "url_only" = "no_index";
  let addRuleError = "";

  // Add this new variable
  let activeSection = "import-json";

  // Add this new function
  const scrollToSection = (sectionId: string) => {
    activeSection = sectionId;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

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
