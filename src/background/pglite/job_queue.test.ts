// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { JobQueue, JOB_QUEUE_SCHEMA } from "./job_queue";
import { PGlite } from "@electric-sql/pglite";
import * as defaultTasks from "./tasks";

describe("JobQueue", () => {
  let db: PGlite;
  let jobQueue: JobQueue;
  let mockTasks: typeof defaultTasks;

  beforeEach(async () => {
    // Create an in-memory PGLite instance
    db = new PGlite("memory://");
    await db.query(JOB_QUEUE_SCHEMA);

    // Create mock tasks
    mockTasks = {
      ...defaultTasks,
      generate_fragments: {
        handler: mock(() => Promise.resolve()),
        params: { parse: (p: any) => p },
      },
    };

    jobQueue = new JobQueue(db, mockTasks, 100);
    await jobQueue.initialize();
  });

  afterEach(async () => {
    // Clean up the database
    await db.query("DROP TABLE IF EXISTS task");
    await db.close();
  });

  it("should initialize the job queue", async () => {
    const result = await db.query<{ count: number }>("SELECT COUNT(*) as count FROM task");
    expect(result.rows[0].count).toBe(0);
  });

  it("should enqueue a task", async () => {
    const taskType = "generate_fragments";
    const params = { articleId: 1 };

    const taskId = await jobQueue.enqueue(taskType, params);
    expect(taskId).toBeGreaterThan(0);

    const result = await db.query<{ count: number }>("SELECT COUNT(*) as count FROM task");
    expect(result.rows[0].count).toBe(1);
  });

  it("should not enqueue duplicate tasks", async () => {
    const taskType = "generate_fragments";
    const params = { articleId: 1 };

    const taskId1 = await jobQueue.enqueue(taskType, params);
    const taskId2 = await jobQueue.enqueue(taskType, params);

    expect(taskId1).toBeGreaterThan(0);
    expect(taskId2).toBeUndefined();

    const result = await db.query<{ count: number }>("SELECT COUNT(*) as count FROM task");
    expect(result.rows[0].count).toBe(1);
  });

  it("should process pending tasks", async () => {
    const taskType = "generate_fragments";
    const params = { articleId: 1 };

    await jobQueue.enqueue(taskType, params);

    await jobQueue.processPendingTasks();

    // Wait for a short time to allow the task to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await db.query<{ count: number }>("SELECT COUNT(*) as count FROM task");
    expect(result.rows[0].count).toBe(0);
    expect(mockTasks[taskType].handler).toHaveBeenCalledTimes(1);
  });

  it("should mark failed tasks", async () => {
    const taskType = "generate_fragments";
    const params = { articleId: 1 };

    // Mock the task handler to throw an error
    mockTasks[taskType] = {
      handler: mock(() => Promise.reject(new Error("Test error"))),
      params: { parse: (p: any) => p },
    };

    await jobQueue.enqueue(taskType, params);

    await jobQueue.processPendingTasks();

    // Wait for a short time to allow the task to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await db.query<{ count: number; failed_count: number }>(
      "SELECT COUNT(*) as count, COUNT(failed_at) as failed_count FROM task"
    );
    expect(result.rows[0].count).toBe(1);
    expect(result.rows[0].failed_count).toBe(1);
  });

  it("should stop processing tasks when requested", async () => {
    const taskType = "generate_fragments";
    const params = { articleId: 1 };

    // Mock the task handler
    mockTasks[taskType] = {
      handler: mock(() => new Promise((resolve) => setTimeout(resolve, 500))),
      params: { parse: (p: any) => p },
    };

    await jobQueue.enqueue(taskType, params);
    await jobQueue.enqueue(taskType, { articleId: 2 });

    const processPromise = jobQueue.processPendingTasks();

    // Stop the queue after a short delay
    setTimeout(() => jobQueue.stop(), 100);

    await processPromise;

    const result = await db.query<{ count: number }>("SELECT COUNT(*) as count FROM task");
    expect(result.rows[0].count).toBe(1); // One task should remain unprocessed
  });
});
