<script lang="ts">
  import type { DetailRow, ResultRow } from "@/background/backend";
  import { fttf } from "@/ui/lib/rpc";
  import SvelteMarkdown from "svelte-markdown";
  import { onMount } from "svelte";
  import { location } from "svelte-spa-router";

  let row: (DetailRow & Partial<ResultRow>) | null = null;
  let err: Error | null = null;
  let showRawContent = false;
  
  // Get the URL parameter from the location
  export let params = {};

  const fetchRow = async (url: string) => {
    try {
      row = await fttf.adapter.backend.findOne({ where: { url } });
    } catch (_err) {
      err = _err;
    }
  };

  onMount(() => {
    if (params.url) {
      const decodedUrl = decodeURIComponent(params.url);
      fetchRow(decodedUrl);
    }
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
</script>

<div class="!max-w-[920px] prose prose-invert p-4 pb-20">
  {#if row}
    <section class="bg-zinc-900 rounded-lg border border-zinc-700 p-4 mb-6">
      <div class="Controls flex flex-wrap gap-4 mb-4">
        <a
          class="px-3 py-2 rounded border border-white text-white no-underline"
          on:click={() => {
            window.history.back();
          }}
        >
          Back to Search
        </a>
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          class="px-3 py-2 rounded border border-white text-white no-underline"
        >
          Open URL
        </a>
        <div class="flex gap-4 mr-0 ml-auto">
          <button
            on:click={() => (showRawContent = !showRawContent)}
            class="px-3 py-2 rounded border border-white text-white"
          >
            {showRawContent ? "Show Formatted" : "Show Raw"}
          </button>
        </div>
      </div>
      <div class="Metadata text-sm text-zinc-400">
        <p>Last visited: {row.last_visit ? formatDate(row.last_visit) : "N/A"}</p>
        <p>Created: {formatDate(row.created_at)}</p>
        <p>Updated: {formatDate(row.updated_at)}</p>
      </div>
    </section>

    <section class="bg-zinc-900 rounded-lg border border-zinc-700 p-4">
      <h1 class="text-3xl mt-0">
        <span class="block">{row.title}</span>
        <a href={row.url} target="_blank" rel="noopener noreferrer" class="block text-sm italic"
          >{row.url}</a
        >
      </h1>
      {#if showRawContent}
        <pre class="whitespace-pre-wrap">{row.md_content}</pre>
      {:else}
        <SvelteMarkdown source={row.md_content} />
      {/if}
    </section>
  {:else if err}
    <section class="Error bg-red-900 text-red-100 p-4 rounded-lg">
      {err.message}
    </section>
  {:else}
    <section class="Loading bg-zinc-900 text-zinc-300 p-4 rounded-lg">Loading...</section>
  {/if}
</div>

<style>
  .prose :global(pre) {
    background-color: #1e1e1e;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
  }
  .Metadata p:last-child {
    margin-bottom: 0;
  }
  section {
    @apply p-6 md:p-12;
  }
</style>
