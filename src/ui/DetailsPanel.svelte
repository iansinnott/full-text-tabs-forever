<script lang="ts">
  import classNames from "classnames";
  import type { ResultRow , DetailRow} from "@/background/backend";
  import SvelteMarkdown from "svelte-markdown";
  
  // Note this will not have the content. we need a separate fetch for that
  export let docUrl: string;
  export let showDetails = false;
  let row: DetailRow | null = null;
  let err: Error | null = null;
  
  const fetchRow = async (url: string) => {
    try {
      row = await window.fttf.adapter.backend.findOne({ where: { url }});
    } catch (_err) {
      err = _err; 
    }
  };

  $: fetchRow(docUrl);
  $: console.log({ detailRow: row });
</script>

<div class="prose prose-invert">
  {#if row}
    <div class="Controls flex space-x-4 mb-4 w-full">
      <button
        class="px-3 py-2 rounded border border-white"
        on:click|preventDefault={() => {
          window.open(row?.url, "_blank");
        }}
      >
        Open URL
      </button>
      <button
        class="!ml-auto font-mono px-3 py-2"
        on:click={() => {
          showDetails = false;
        }}
      >
        {"x"}
      </button>
    </div>
    <h1 class="text-3xl">
      <span class="block">{row?.title}</span>
      <a href={row.url} target="_blank" rel="noopener noreferrer" class="block text-sm italic"
        >{row.url}</a
      >
    </h1>
    <SvelteMarkdown source={row.mdContent} />
  {:else if err}
    <div class="error">
      {err.message}
    </div>
  {:else}
    <!-- Intentionally left blank. Loading is local so it is a quick blip the user doesn't parse -->
    <!-- <div class="loading">Loading...</div> -->
  {/if}
</div>
