<script lang="ts">
  import { handleImport } from "@/ui/lib/commands";

  let errorMessage = "";
  let vlcnImportMessage = "";
  let isImporting = false;

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
</div>

<style>
</style>
