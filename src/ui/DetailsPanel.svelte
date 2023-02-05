<script lang="ts">
  import classNames from "classnames";
  import type { ResultRow , DetailRow} from "@/background/backend";
  import SvelteMarkdown from "svelte-markdown";
  
  // Note this will not have the content. we need a separate fetch for that
  export let docUrl: string;
  let row: DetailRow | null = null;
  let err: Error | null = null;
  
  const fetchRow = async (url: string) => {
    try {
    row = await window.fttf.adapter.backend.findOne<DetailRow>(`SELECT * FROM "document" WHERE url = ?`, [url]);
    } catch (_err) {
      err = _err; 
    }
  };

  $: fetchRow(docUrl);
  
  $: console.log({ detailRow: row });
</script>

<div class="prose prose-invert">
  <h1 class="text-3xl">
    {row?.title}
  </h1>
  {#if row}
    <SvelteMarkdown
      on:parsed={() => {
        console.log("Parsed");
      }}
      source={row.mdContent}
    />
  {:else if err}
    <div class="error">
      {err.message}
    </div>
  {:else}
    <div class="loading">Loading...</div>
  {/if}
</div>
