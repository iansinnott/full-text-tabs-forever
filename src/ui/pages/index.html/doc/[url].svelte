<script lang="ts">
  import type { DetailRow } from "@/background/backend";
  import { fttf } from "@/ui/lib/rpc";
  import SvelteMarkdown from "svelte-markdown";
  import { onMount } from "svelte";
  import { params } from "@roxi/routify";

  let row: DetailRow | null = null;
  let err: Error | null = null;

  const fetchRow = async (url: string) => {
    try {
      row = await fttf.adapter.backend.findOne({ where: { url } });
    } catch (_err) {
      err = _err;
    }
  };

  onMount(() => {
    const decodedUrl = decodeURIComponent($params.url);
    fetchRow(decodedUrl);
  });
</script>

<div class="prose prose-invert p-6 md:p-12">
  {#if row}
    <div class="Controls flex space-x-4 mb-4 w-full">
      <a href="/" class="px-3 py-2 rounded border border-white text-white no-underline">
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
    </div>
    <h1 class="text-3xl">
      <span class="block">{row.title}</span>
      <a href={row.url} target="_blank" rel="noopener noreferrer" class="block text-sm italic"
        >{row.url}</a
      >
    </h1>
    <SvelteMarkdown source={row.md_content} />
  {:else if err}
    <div class="error">
      {err.message}
    </div>
  {:else}
    <div>Loading...</div>
  {/if}
</div>
