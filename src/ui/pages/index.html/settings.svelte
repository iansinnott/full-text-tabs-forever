<script lang="ts">
  import { rpc } from "@/ui/lib/rpc";
  import { onMount } from "svelte";
  import { z } from "zod";

  let fileInput: HTMLInputElement;
  let errorMessage = "";

  const dbImportSchema = z.object({
    document: z.array(z.any()),
    document_fragment: z.array(z.any()),
  });

  const handleFileUpload = () => {
    errorMessage = "";
    const file = fileInput?.files?.[0];
    if (!file) return;

    if (file.type !== "application/json") {
      errorMessage = "Please upload a JSON file.";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) return;

      try {
        const content = JSON.parse(e.target.result as string);
        const result = dbImportSchema.safeParse(content);
        if (!result.success) {
          errorMessage = "Invalid JSON file. Please upload a valid JSON file.";
          return;
        }

        /**
         * Insert in batches of 100. for any failing batch, insert one at a time
         * logging but otherwise ignoring errors
         */

        let importedCount = 0;
        const documents = result.data.document;
        const batchSize = 10_000;
        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize);
          try {
            await rpc(["importDocuments", { document: batch }]);
            importedCount += batch.length;
          } catch (error) {
            console.error("Failed to import batch:", error);
            for (const doc of batch) {
              try {
                await rpc(["importDocuments", { document: [doc] }]);
                importedCount++;
              } catch (error) {
                console.error("Failed to import document:", doc, error);
              }
            }
          }
        }

        console.log(
          "Imported:",
          importedCount,
          "documents",
          result.data.document_fragment.length,
          "fragments"
        );
      } catch (error) {
        errorMessage = "Invalid JSON file. Please upload a valid JSON file.";
        console.error("Error importing JSON:", error);
      }
    };

    reader.readAsText(file);
  };
</script>

<div class="flex flex-col p-12 h-[calc(100%-70px)] prose dark:prose-invert">
  <h3>Settings</h3>
  <p>
    Upload a JSON file to import your database. The file should contain document and
    document_fragment data, which will be processed and added to your local database.
  </p>
  <div class="mt-4">
    <input
      type="file"
      id="file-upload"
      accept=".json"
      bind:this={fileInput}
      on:change={handleFileUpload}
    />
  </div>
  {#if errorMessage}
    <p class="text-red-500 mt-2">{errorMessage}</p>
  {/if}
</div>

<style>
</style>
