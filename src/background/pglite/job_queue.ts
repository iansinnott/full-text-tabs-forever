import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { TaskDefinition } from "./tasks";
import * as tasks from "./tasks";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type DBWriter = Pick<Transaction, "query" | "exec" | "sql">;

export const JOB_QUEUE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS task (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    task_type TEXT NOT NULL,
    params JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    failed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    CONSTRAINT task_task_type_params_unique UNIQUE(task_type, params)
  );
`;

export class JobQueue {
  private isProcessing: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    private db: PGlite,
    private taskInterval: number = 1000
  ) {}

  async initialize() {
    await this.db.query(JOB_QUEUE_SCHEMA);
  }

  async enqueue(
    taskType: keyof typeof tasks,
    params: object = {},
    tx: DBWriter = this.db
  ): Promise<number> {
    const task = tasks[taskType as keyof typeof tasks];

    if (!task) {
      throw new Error(`Task type ${taskType} not implemented`);
    }

    // Make sure params are valid before adding to queue
    task.params?.parse(params);

    const result = await tx.query<{ id: number }>(
      `
      INSERT INTO task (task_type, params)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (task_type, params) DO NOTHING
      RETURNING id
    `,
      [taskType, params]
    );

    const taskId = result.rows[0]?.id;

    return taskId;
  }

  /**
   * Process a single task from the queue
   *
   * NOTE: a few things about this queue strategy:
   * - priority queue based on logic in the ORDER BY clause. add cases as needed
   * - random order if no priority is set
   */
  private async processQueue() {
    let processedId: number | null = null;

    try {
      await this.db.transaction(async (tx) => {
        const result = await tx.query<{
          id: number;
          task_type: string;
          params: Record<string, any>;
        }>(`
          SELECT id, task_type, params::jsonb
          FROM task
          WHERE failed_at IS NULL
          ORDER BY
            CASE
              WHEN task_type = 'generate_fragments' THEN 0
              ELSE random()
            END,
            created_at
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `);

        if (!result.rows.length) {
          console.log("task :: empty queue");
          return;
        }

        const { id, task_type, params } = result.rows[0];

        processedId = id;

        if (!(task_type in tasks)) {
          console.warn(`task :: ${task_type} :: not implemented`);
          await this.markTaskAsFailed(tx, id, "Task type not implemented");
          return;
        }

        const task = tasks[task_type as keyof typeof tasks] as TaskDefinition;
        const start = performance.now();
        try {
          await task.handler(tx, task.params?.parse(params));
          await tx.query("DELETE FROM task WHERE id = $1", [id]);
        } catch (error) {
          console.error(`task :: error`, error.message);
          throw error;
        } finally {
          console.log(
            `task :: ${performance.now() - start}ms :: ${task_type} :: ${JSON.stringify(params)}`
          );
        }
      });
    } catch (error) {
      console.error(`task :: processQueue :: error`, error);

      // NOTE this cannot be done within the transaction. using the tx after a
      // failure will result in an error saying the transaction is aborted.
      if (processedId) {
        await this.markTaskAsFailed(this.db, processedId, error.message);
      }
    }
  }

  private async markTaskAsFailed(tx: DBWriter, id: number, errorMessage: string) {
    await tx.query(
      `
      UPDATE task
      SET failed_at = CURRENT_TIMESTAMP, error = $1
      WHERE id = $2
    `,
      [errorMessage, id]
    );
  }

  async processPendingTasks() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;

    const getPendingCount = async () => {
      const pendingTasks = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM task
        WHERE failed_at IS NULL
    `);
      return pendingTasks.rows[0].count;
    };

    try {
      while ((await getPendingCount()) > 0 && !this.shouldStop) {
        await this.processQueue();
        await sleep(this.taskInterval);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  stop() {
    this.shouldStop = true;
  }
}
