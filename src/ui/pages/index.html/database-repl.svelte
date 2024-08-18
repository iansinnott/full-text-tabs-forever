<script lang="ts">
  import { onMount } from "svelte";
  import type { QueryOptions, Results } from "@electric-sql/pglite";
  import { PGlite } from "@electric-sql/pglite";
  import { rpc } from "@/ui/lib/rpc";

  let pg: PGlite;
  let replElement: HTMLElement & { pg: PGlite };

  class PGliteServiceWorkerProxy implements PGlite {
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

  onMount(async () => {
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
</script>

<div>
  <h1>Database REPL</h1>
  <pglite-repl bind:this={replElement}></pglite-repl>
</div>

<style>
  :global(pglite-repl) {
    display: block;
    width: 100%;
    height: 400px;
  }
</style>
