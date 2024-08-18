import type { Transaction } from "@electric-sql/pglite";
import { z } from "zod";
import { createEmbedding } from "../embedding/pipeline";

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
    params: T extends z.AnyZodObject ? z.infer<T> : undefined
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
