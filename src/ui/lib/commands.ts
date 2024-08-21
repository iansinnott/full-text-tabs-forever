import { z } from "zod";
import { readFileAsText, pickFile } from "./dom";
import { rpc, fttf } from "./rpc";
import { updateStats, stats } from "../store/statsStore";
import { get } from "svelte/store";

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

export const dumpDataDir = async () => {
  return await rpc(["pg.dumpDataDir"]);
};

export const loadDataDir = async () => {
  const file = await pickFile(".dump,.gz");
  console.log("loadDataDir :: file.type", file.type);
  await fttf.adapter.backend["pg.loadDataDir"](file);
  await updateStats();
  return { success: true };
};
