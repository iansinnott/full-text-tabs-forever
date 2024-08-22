<script lang="ts">
  import { handleImport } from "@/ui/lib/commands";

  let errorMessage = "";
  let vlcnImportMessage = "";

  const handleFileUpload = async () => {
    errorMessage = "";
    const result = await handleImport();
    if (!result.success && result.message) {
      errorMessage = result.message;
    }
  };

  const importVLCNDatabase = async () => {
    vlcnImportMessage = "Importing VLCN database...";
    try {
      const response = await chrome.runtime.sendMessage(["importVLCNDocuments"]);
      if (response.ok) {
        vlcnImportMessage = "VLCN database imported successfully!";
      } else {
        vlcnImportMessage = `Error importing VLCN database: ${response.error}`;
      }
    } catch (error) {
      vlcnImportMessage = `Error importing VLCN database: ${error.message}`;
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
    new format.
  </p>
  <div class="mt-4">
    <button
      on:click={importVLCNDatabase}
      class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900"
      >Import VLCN Database</button
    >
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
