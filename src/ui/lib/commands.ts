import { z } from "zod";
import { readFileAsText, pickFile } from "./dom";
import { rpc } from "./rpc";
import { updateStats } from "../store/statsStore";

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
