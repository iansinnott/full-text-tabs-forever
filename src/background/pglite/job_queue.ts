import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { PgLiteBackend } from "../backend-pglite";
import type { TaskDefinition } from "./tasks";
import * as tasks from "./tasks";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class JobQueue {
  private isProcessing: boolean = false;

  /** for manually stopping the queue */
  private shouldStop: boolean = false;

  constructor(
    private backend: PgLiteBackend,
    private taskInterval: number = 1000
  ) {}

  async initialize() {
    await this.backend.db!.query(`
      CREATE TABLE IF NOT EXISTS task (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        task_type TEXT NOT NULL,
        params JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT task_task_type_params_unique UNIQUE(task_type, params)
      );
    `);
  }

  async enqueue(
    taskType: keyof typeof tasks,
    params: object = {},
    tx: Transaction | PGlite = this.backend.db!
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
   * - no select for update since there's only one writer, however maybe we should add it anyway
   * - priority queue based on logic in the ORDER BY clause. add cases as needed
   * - random order if no priority is set
   *
   * @todo Error handling. Currently a failure does not remove the task from the
   * queue or modify it, so it will be run again next time. The order is
   * randomized so it probably won't block, but it's not exactly handled. It just
   * sits there, indefiniedly, potentially blocking queue runs.
   */
  private async processQueue() {
    try {
      await this.backend.db!.transaction(async (tx) => {
        const result = await tx.query<{
          id: number;
          task_type: string;
          params: Record<string, any>;
        }>(`
          DELETE FROM task
          WHERE id IN (
            SELECT id
            FROM task
            ORDER BY
              CASE
                WHEN task_type = 'generate_fragments' THEN 0
                ELSE random()
              END,
              created_at
            LIMIT 1
          )
          RETURNING id, task_type, params::jsonb
        `);

        if (!result.rows.length) {
          console.log("task :: empty queue");
          return;
        }

        const { task_type, params } = result.rows[0];

        if (!(task_type in tasks)) {
          console.warn(`task :: ${task_type} :: not implemented`);
          throw new Error(`Task type ${task_type} not implemented`);
        }

        const task = tasks[task_type as keyof typeof tasks] as TaskDefinition;
        const start = performance.now();
        try {
          await task.handler(tx, task.params?.parse(params));
        } catch (error) {
          throw error;
        } finally {
          console.log(
            `task :: ${performance.now() - start}ms :: ${task_type} :: ${JSON.stringify(params)}`
          );
        }
      });
    } catch (error) {
      console.error(`task :: error`, error);
    }
  }

  async processPendingTasks() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;

    const getCount = async () => {
      const pendingTasks = await this.backend.db!.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM task
    `);
      return pendingTasks.rows[0].count;
    };

    try {
      while ((await getCount()) > 0 && !this.shouldStop) {
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
