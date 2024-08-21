<script lang="ts">
  import { readFileAsText, pickFile } from "@/ui/lib/dom";
  import { rpc } from "@/ui/lib/rpc";
  import { z } from "zod";

  let errorMessage = "";

  const dbImportSchema = z.object({
    document: z.array(z.any()),
  });

  const handleFileUpload = async () => {
    errorMessage = "";
    try {
      const file = await pickFile(".json");
      if (file.type !== "application/json") {
        errorMessage = "Please upload a JSON file.";
        return;
      }

      const text = await readFileAsText(file);
      const content = JSON.parse(text);
      const result = dbImportSchema.safeParse(content);
      if (!result.success) {
        errorMessage = "Invalid JSON file. Please upload a valid JSON file.";
        console.error("Error parsing JSON:", result);
        return;
      }

      const documents = result.data.document;
      await rpc(["importDocumentsJSONv1", { document: documents }]);
      console.log("Imported:", documents.length, "documents");
    } catch (error) {
      if (error instanceof Error && error.message === "No file selected") {
        // User cancelled file selection, do nothing
        return;
      }
      errorMessage = "Invalid JSON file. Please upload a valid JSON file.";
      console.error("Error importing JSON:", error);
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
