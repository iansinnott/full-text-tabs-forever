import type { Transaction } from "@electric-sql/pglite";
import { z } from "zod";

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
    fragmentId: z.number(),
  }),
  handler: async (tx, params) => {
    // Implement vector generation logic here
    console.log(`Generating vector for fragment ${params.fragmentId}`);
    // Example implementation:
    // const fragment = await client.query('SELECT value FROM document_fragment WHERE id = $1', [params.fragmentId]);
    // const embedding = await createEmbedding(fragment.rows[0].value);
    // await client.query('UPDATE document_fragment SET content_vector = $1, vector_status = $2 WHERE id = $3',
    //   [embedding, 'completed', params.fragmentId]);
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
