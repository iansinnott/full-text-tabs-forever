import { rpc } from "@/ui/lib/rpc";
import { writable } from "svelte/store";

export type Stats = {
  Documents: string;
  Fragments: string;
  Size: string;
};

export const stats = writable<Stats | null>(null);

export async function updateStats() {
  try {
    const _stats = (await rpc(["getStats"])) as {
      document: { count: number };
      document_fragment: { count: number };
      db: { size_bytes: number };
    };

    stats.set({
      Documents: _stats.document.count.toLocaleString(),
      Fragments: _stats.document_fragment.count.toLocaleString(),
      Size: (_stats.db.size_bytes / 1024 / 1024).toFixed(2) + "MB",
    });
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}
