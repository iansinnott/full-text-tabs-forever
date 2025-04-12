<script lang="ts">
  import { onMount } from "svelte";
  import type { ResultRow } from "@/background/backend";
  import { fttf } from "@/ui/lib/rpc";
  import { groupItemsByVisitDate } from "@/common/utils";
  import ResultItem from "@/ui/ResultItem.svelte";

  export let limit = 100;
  export let offset = 0;

  let loading = true;
  let error = false;
  let recentItems: ResultRow[] = [];
  let groupedItems: Record<string, ResultRow[]> = {};
  let currentGroupIndex = -1;
  let currentItemIndex = -1;
  let enableMouseEvents = false;

  const loadRecentItems = async () => {
    loading = true;
    try {
      const response = await fttf.adapter.backend.getRecent({
        limit,
        offset,
      });

      if (response.ok) {
        recentItems = response.results;
        updateGroupedItems();
      } else {
        error = true;
      }
    } catch (err) {
      console.error("Error loading recent items:", err);
      error = true;
    } finally {
      loading = false;
    }
  };

  const updateGroupedItems = () => {
    // Use the utility function to group the items
    groupedItems = groupItemsByVisitDate(recentItems);
  };

  onMount(() => {
    loadRecentItems();

    // Enable mouse events on first mouse move
    const handleMouseMove = () => {
      if (!enableMouseEvents) enableMouseEvents = true;
      window.removeEventListener("mousemove", handleMouseMove);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  });
</script>

<div class="recent-items pb-8">
  {#if loading}
    <div class="py-4 text-slate-400">Loading recent pages...</div>
  {:else if error}
    <div class="py-4 text-red-400">There was an error loading recent pages.</div>
  {:else if recentItems.length === 0}
    <div class="py-4 text-slate-400">No recent pages found.</div>
  {:else}
    <div class="flex flex-col space-y-4">
      {#each Object.entries(groupedItems) as [date, items], i (date)}
        <div class="date-group">
          <div class="text-sm font-medium text-slate-400 mb-2">{date}</div>
          {#each items as item, j}
            <ResultItem
              {item}
              showTime={true}
              showSnippets={false}
              selected={i === currentGroupIndex && j === currentItemIndex}
              groupIndex={i}
              on:focus={() => {
                currentGroupIndex = i;
                currentItemIndex = j;
              }}
              on:mouseover={() => {
                if (enableMouseEvents) {
                  currentGroupIndex = i;
                  currentItemIndex = j;
                }
              }}
            />
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>
