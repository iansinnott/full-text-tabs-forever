<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import type { ResultRow } from "@/background/backend";
  import { fttf } from "@/ui/lib/rpc";
  import classNames from "classnames";
  import {
    getFaviconByUrl,
    getRelativeTime,
    getFullLocalTime,
    groupItemsByVisitDate,
  } from "@/common/utils";

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
    <div class="flex flex-col space-y-0">
      {#each Object.entries(groupedItems) as [date, items], i (date)}
        <div class="date-group mb-4">
          <div class="text-sm font-medium text-slate-400 mb-2">{date}</div>
          {#each items as item, j}
            {@const url = item.url}
            {@const u = new URL(url)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              data-group-index={`${i}-${j}`}
              class={classNames("result-group p-3 -mx-2 rounded-lg", {
                "bg-slate-800": i === currentGroupIndex && j === currentItemIndex,
                "bg-transparent": !(i === currentGroupIndex && j === currentItemIndex),
              })}
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
              on:click={() => {
                const encodedUrl = encodeURIComponent(url);
                push(`/doc/${encodedUrl}`);
              }}
            >
              <a class="result mb-1 flex items-center" href={url} on:click|preventDefault>
                <div class="text-xs text-slate-500 mr-3" title={getFullLocalTime(item.last_visit)}>
                  {getRelativeTime(item.last_visit)}
                </div>
                <div class="favicon mr-3 self-center">
                  <img
                    class="w-4 h-4 rounded-lg"
                    src={getFaviconByUrl(url)}
                    alt="favicon for {u.hostname}"
                  />
                </div>
                <div class="title mr-3 text-slate-300 text-base">{item.title || url}</div>
                <div class="url truncate text-indigo-200">
                  {url.replace(/^(https?:\/\/(?:www\.)?)/, "").replace(/\/$/, "")}
                </div>
              </a>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .result {
    display: grid;
    grid-template-columns: auto auto auto minmax(0, 1fr);
    grid-template-rows: auto;
    align-items: baseline;
  }
</style>
