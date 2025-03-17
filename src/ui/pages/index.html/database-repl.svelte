<script lang="ts">
  import { onMount } from "svelte";
  import type { QueryOptions, Results } from "@electric-sql/pglite";
  import { PGlite } from "@electric-sql/pglite";
  import { rpc } from "@/ui/lib/rpc";

  let replElement: HTMLElement & { pg: PGlite };
  let showInstructions: boolean;

  onMount(async () => {
    showInstructions = localStorage.getItem("showInstructions") !== "false";

    // @ts-expect-error Types are wrong for pglite for some reason
    await import("@electric-sql/pglite-repl/webcomponent");

    const pg = new PGliteServiceWorkerProxy();
    const pgproxy = new Proxy(pg, {
      get: (target, prop: string | symbol, receiver) => {
        console.log(`pg :: property access :: ${String(prop)}`);
        if (!Reflect.has(target, prop)) {
          console.warn(`pg :: property access :: ${String(prop)} is not supported`);
        } else {
          return Reflect.get(target, prop, receiver);
        }
      },
    });

    if (replElement) {
      // @ts-expect-error
      replElement.pg = pgproxy;
    }
  });

  function toggleInstructions() {
    showInstructions = !showInstructions;
    localStorage.setItem("showInstructions", showInstructions.toString());
  }

  class PGliteServiceWorkerProxy implements Pick<PGlite, "query" | "exec" | "waitReady"> {
    async query<T>(query: string, params?: any[], options?: QueryOptions): Promise<Results<T>> {
      const result = await rpc(["pg.query", { sql: query, params, options }]);
      return result as Results<T>;
    }

    async exec(query: string, options?: QueryOptions): Promise<Array<Results>> {
      const result = await rpc(["pg.exec", { sql: query, options }]);
      return result as Array<Results>;
    }

    waitReady = Promise.resolve();
  }
</script>

<div class="flex flex-col p-4 h-[calc(100%-70px)]">
  <button
    on:click={toggleInstructions}
    class="self-end mb-2 px-3 py-1 bg-gray-700 rounded-md text-sm"
  >
    {showInstructions ? "Hide" : "Show"} Instructions
  </button>

  {#if showInstructions}
    <div class="Instructions prose prose-invert mb-8">
      <h2>SQL Playground</h2>
      <p>
        You can directly access the browsing history database here. If you're not familiar with SQL,
        ChatGPT can likely help you.
      </p>
      <p>Here's an example query that shows the 10 most recently visited documents:</p>
      <pre>SELECT * FROM document order by last_visit desc limit 10;</pre>
    </div>
  {/if}

  <pglite-repl bind:this={replElement}></pglite-repl>
</div>

<style>
  :global(pglite-repl) {
    display: block;
    width: 100%;
    max-height: 100%;
    min-height: 200px;
    border: 1px solid #34333e;
    @apply rounded-lg overflow-hidden;
  }
</style>
