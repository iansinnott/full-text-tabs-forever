import { z } from "zod";
import { readFileAsText, pickFile } from "./dom";
import { rpc, fttf } from "./rpc";
import { updateStats, stats } from "../store/statsStore";
import { get } from "svelte/store";
import { streamingExport } from "./streaming-export";

const dbImportSchema = z.object({
  document: z.array(z.any()),
});

export const handleImport = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const file = await pickFile(".json");
    if (file.type !== "application/json") {
      return { success: false, message: "Please upload a JSON file." };
    }

    const text = await readFileAsText(file);
    const content = JSON.parse(text);
    const result = dbImportSchema.safeParse(content);
    if (!result.success) {
      console.error("Error parsing JSON:", result);
      return { success: false, message: "Invalid JSON file. Please upload a valid JSON file." };
    }

    const documents = result.data.document;
    await rpc(["importDocumentsJSONv1", { document: documents }]);
    console.log("Imported:", documents.length, "documents");

    await updateStats();
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "No file selected") {
      return { success: false };
    }
    console.error("Error importing JSON:", error);
    return { success: false, message: "Error importing file. Please try again." };
  }
};

export const vacuumFull = async () => {
  await updateStats();
  let x = get(stats);
  const before = x?.Size;
  await rpc(["pg.exec", { sql: "VACUUM FULL" }]);
  await updateStats();
  x = get(stats);
  const after = x?.Size;
  return { before, after };
};

/**
 * Export the database to a JSON file
 * For large databases, this will use the streaming export API if available
 * Otherwise falls back to the regular export method
 * @param options Optional configuration including progress callback
 *
 * @todo This doesn't do much... probably remove it in favor of streamingExport directly.
 */
export const exportJson = async (options?: {
  onProgress?: (progress: { current: number; total: number }) => void;
}): Promise<{ success: boolean; message?: string }> => {
  try {
    // Use streaming export if available, which will fall back to regular export if needed
    const result = await streamingExport({
      batchSize: 200,
      onProgress: options?.onProgress,
    });

    return result;
  } catch (error) {
    console.error("Error exporting JSON:", error);
    return { success: false, message: "Error exporting file. Please try again." };
  }
};
