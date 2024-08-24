<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { rpc } from "@/ui/lib/rpc";
  import { RotateCcw, Trash } from "lucide-svelte";

  type Task = {
    id: number;
    task_type: string;
    params: Record<string, any>;
    created_at: number;
    failed_at: number | null;
    error: string | null;
  };

  let tasks: Task[] = [];
  let failedTasks: Task[] = [];
  let totalTasks = 0;
  let totalFailedTasks = 0;
  let error = null;
  let refreshInterval: Timer;

  async function fetchTasks() {
    try {
      error = null;

      const [countResult, tasksResult, failedTasksResult] = await Promise.all([
        rpc(["pg.query", { sql: "SELECT COUNT(*) as count FROM task", params: [] }]),
        rpc([
          "pg.query",
          {
            sql: `SELECT id, task_type, params, created_at 
                FROM task 
                WHERE failed_at IS NULL
                ORDER BY created_at DESC 
                LIMIT $1`,
            params: [100],
          },
        ]),
        rpc([
          "pg.query",
          {
            sql: `SELECT id, task_type, params, created_at, failed_at, error
                FROM task 
                WHERE failed_at IS NOT NULL
                ORDER BY failed_at DESC 
                LIMIT $1`,
            params: [100],
          },
        ]),
      ]);

      totalTasks = countResult.rows[0].count;
      tasks = tasksResult.rows;
      failedTasks = failedTasksResult.rows;
      totalFailedTasks = failedTasks.length;
    } catch (e) {
      error = e.message;
    }
  }

  async function retryTask(taskId: number) {
    await rpc([
      "pg.query",
      {
        sql: "UPDATE task SET failed_at = NULL, error = NULL WHERE id = $1",
        params: [taskId],
      },
    ]);
    await rpc(["processJobQueue"]);
    await fetchTasks();
  }

  async function removeTask(taskId: number) {
    await rpc([
      "pg.query",
      {
        sql: "DELETE FROM task WHERE id = $1",
        params: [taskId],
      },
    ]);
    await fetchTasks();
  }

  onMount(() => {
    fetchTasks();
    refreshInterval = setInterval(fetchTasks, 2000);
  });

  onDestroy(() => {
    clearInterval(refreshInterval);
  });

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
</script>

<div class="flex flex-col p-12 h-[calc(100%-70px)]">
  <div class=" prose dark:prose-invert mb-6">
    <h3>Task Queue</h3>
    <p class="mb-4">
      This page displays the current state of the task queue. It shows both pending and failed
      tasks, and automatically refreshes to provide up-to-date information.
    </p>
    <p>
      When the system is functioning normally you can expect the number of pending tasks to either
      be zero or be decreasing.
    </p>
    <hr class="border-gray-700 my-6" />
  </div>

  {#if error}
    <p class="text-red-500">Error: {error}</p>
  {:else}
    <p>Total tasks in queue: {totalTasks}</p>

    <h4 class="text-lg font-bold mt-4">Pending Tasks</h4>
    <table class="w-full mt-4">
      <thead>
        <tr>
          <th class="text-left">ID</th>
          <th class="text-left">Type</th>
          <th class="text-left">Params</th>
          <th class="text-left">Created At</th>
        </tr>
      </thead>
      <tbody>
        {#if tasks.length === 0}
          <tr>
            <td colspan="4" class="text-center py-4">There are currently no pending tasks.</td>
          </tr>
        {:else}
          {#each tasks as task}
            <tr>
              <td>{task.id}</td>
              <td>{task.task_type}</td>
              <td class="font-mono">{JSON.stringify(task.params)}</td>
              <td>{formatDate(task.created_at)}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
    {#if tasks.length > 0 && tasks.length < totalTasks - totalFailedTasks}
      <p class="mt-4">Showing {tasks.length} of {totalTasks - totalFailedTasks} pending tasks.</p>
    {/if}

    {#if failedTasks.length > 0}
      <h4 class="mt-8 text-xl font-bold">Failed Tasks</h4>
      <table class="w-full mt-4">
        <thead>
          <tr>
            <th class="text-left">ID</th>
            <th class="text-left">Type</th>
            <th class="text-left">Params</th>
            <th class="text-left">Created At</th>
            <th class="text-left">Failed At</th>
            <th class="text-left">Error</th>
            <th class="text-left"></th>
          </tr>
        </thead>
        <tbody>
          {#each failedTasks as task}
            <tr>
              <td>{task.id}</td>
              <td>{task.task_type}</td>
              <td class="font-mono">{JSON.stringify(task.params)}</td>
              <td>{formatDate(task.created_at)}</td>
              <td>{formatDate(task.failed_at)}</td>
              <td class="bg-red-500/30 text-red-200">{task.error}</td>
              <td>
                <div class="flex gap-2">
                  <button
                    on:click={() => retryTask(task.id)}
                    class="text-white p-1 rounded hover:text-blue-400"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    on:click={() => removeTask(task.id)}
                    class="text-red-500 p-1 rounded hover:text-red-400"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if failedTasks.length < totalFailedTasks}
        <p class="mt-4">Showing {failedTasks.length} of {totalFailedTasks} failed tasks.</p>
      {/if}
    {/if}
  {/if}
</div>

<style>
  table {
    border-collapse: collapse;
  }
  th,
  td {
    border: 1px solid #4a5568;
    padding: 8px;
  }
  th {
    background-color: #2d3748;
  }
</style>
