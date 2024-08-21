<script lang="ts">
  import { handleImport } from "@/ui/lib/commands";

  let errorMessage = "";

  const handleFileUpload = async () => {
    errorMessage = "";
    const result = await handleImport();
    if (!result.success && result.message) {
      errorMessage = result.message;
    }
  };
</script>

<div class="flex flex-col p-12 h-[calc(100%-70px)] prose dark:prose-invert">
  <h3>Settings</h3>
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
</div>

<style>
</style>
