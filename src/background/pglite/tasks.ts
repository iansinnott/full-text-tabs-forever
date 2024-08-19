import type { Transaction } from "@electric-sql/pglite";
import { z } from "zod";
import { createEmbedding } from "../embedding/pipeline";
import type { PgLiteBackend } from "../backend-pglite";

/**
 * A helper for type inference.
 */
function createTask<T extends z.AnyZodObject | undefined = undefined>({
  params,
  handler,
}: {
  params?: T;
  handler: (
    tx: Transaction,
    params: T extends z.AnyZodObject ? z.infer<T> : undefined,
    backend: PgLiteBackend
  ) => Promise<void>;
}) {
  return { params, handler } as const;
}

export type TaskDefinition = ReturnType<typeof createTask>;

export const generate_vector = createTask({
  params: z.object({
    fragment_id: z.number(),
  }),
  handler: async (tx, params) => {
    const result = await tx.query<{ value: string }>(
      "SELECT value FROM document_fragment WHERE id = $1",
      [params.fragment_id]
    );
    const embedding = await createEmbedding(result.rows[0].value);
    await tx.query("UPDATE document_fragment SET content_vector = $1 WHERE id = $2", [
      JSON.stringify(embedding),
      params.fragment_id,
    ]);
  },
});

export const generate_fragments = createTask({
  params: z.object({
    document_id: z.number(),
  }),
  handler: async (tx, params, backend) => {
    const document = await tx.query<{
      id: number;
      title: string;
      url: string;
      excerpt: string;
      md_content: string;
    }>("SELECT * FROM document WHERE id = $1", [params.document_id]);
    const row = document.rows[0];

    if (!row) {
      throw new Error("Document not found");
    }

    await backend.upsertFragments(
      params.document_id,
      {
        title: row.title,
        url: row.url,
        excerpt: row.excerpt,
        text_content: row.md_content,
      },
      tx
    );
  },
});

export const ping = createTask({
  handler: async () => {
    console.log("Pong!");
  },
});

export const failing_task = createTask({
  handler: async () => {
    throw new Error("This task always fails");
  },
});
