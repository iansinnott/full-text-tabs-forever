<script lang="ts">
  import { onMount } from "svelte";
  import { rpc } from "@/ui/lib/rpc";

  type Task = {
    id: number;
    task_type: string;
    params: Record<string, any>;
    created_at: number;
  };

  let tasks: Task[] = [];
  let totalTasks = 0;
  let loading = true;
  let error = null;

  async function fetchTasks() {
    try {
      loading = true;
      error = null;

      const countResult = await rpc([
        "pg.query",
        {
          sql: "SELECT COUNT(*) as count FROM task",
          params: [],
        },
      ]);
      totalTasks = countResult.rows[0].count;

      const tasksResult = await rpc([
        "pg.query",
        {
          sql: `SELECT id, task_type, params, created_at 
              FROM task 
              ORDER BY created_at DESC 
              LIMIT $1`,
          params: [100],
        },
      ]);
      tasks = tasksResult.rows;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(fetchTasks);

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
</script>

<div class="flex flex-col p-12 h-[calc(100%-70px)] prose dark:prose-invert">
  <h3>Task Queue</h3>

  {#if loading}
    <p>Loading task queue...</p>
  {:else if error}
    <p class="text-red-500">Error: {error}</p>
  {/if}

  <p>Total tasks in queue: {totalTasks}</p>
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
      {#each tasks as task}
        <tr>
          <td>{task.id}</td>
          <td>{task.task_type}</td>
          <td>{JSON.stringify(task.params)}</td>
          <td>{formatDate(task.created_at)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if tasks.length < totalTasks}
    <p class="mt-4">Showing {tasks.length} of {totalTasks} tasks.</p>
  {/if}

  <button
    on:click={fetchTasks}
    class="mt-4 bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900"
  >
    Refresh
  </button>
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
