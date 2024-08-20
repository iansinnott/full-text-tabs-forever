import type { Transaction } from "@electric-sql/pglite";
import { z } from "zod";
import { createEmbedding } from "../embedding/pipeline";
import { getArticleFragments, segment } from "../../common/utils";

/**
 * A helper for type inference.
 */
function createTask<T extends z.AnyZodObject | undefined = undefined>({
  params = z.object({}),
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

export type TaskDefinition<T extends z.AnyZodObject = z.AnyZodObject> = ReturnType<
  typeof createTask<T>
>;

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
  handler: async (tx, params) => {
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

    const fragments = getArticleFragments(row.md_content || "");

    const sql = `
      INSERT INTO document_fragment (
        entity_id,
        attribute,
        value,
        fragment_order
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING;
    `;

    let triples: [e: number, a: string, v: string, o: number][] = [];
    if (row.title) triples.push([params.document_id, "title", segment(row.title), 0]);
    if (row.excerpt) triples.push([params.document_id, "excerpt", segment(row.excerpt), 0]);
    if (row.url) triples.push([params.document_id, "url", row.url, 0]);
    triples = triples.concat(
      fragments
        .filter((x) => x.trim())
        .map((fragment, i) => {
          return [params.document_id, "content", fragment, i];
        })
    );

    const logLimit = 5;
    console.debug(
      `generate_fragments :: triples :: ${triples.length} (${triples.length - logLimit} omitted)`,
      triples.slice(0, logLimit)
    );

    for (const param of triples) {
      await tx.query(sql, param);
    }
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
