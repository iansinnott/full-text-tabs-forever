<script lang="ts">
  import type { ResultRow } from "@/background/backend";
  import { fly } from "svelte/transition";
  import { debounce, getFaviconByUrl, cleanUrl } from "@/common/utils";
  import { onMount, tick } from "svelte";
  import classNames from "classnames";
  import { fttf, rpc } from "@/ui/lib/rpc";
  import ResultRowView from "@/ui/ResultRowView.svelte";
  import ResultItem from "@/ui/ResultItem.svelte";
  import RecentItems from "@/ui/RecentItems.svelte";
  import { MIN_QUERY_LENGTH } from "@/ui/lib/constants";
  import { displaySettings } from "@/ui/store/displaySettings";
  import { stats, updateStats } from "@/ui/store/statsStore";
  import { push, querystring } from "svelte-spa-router";
  import { get } from "svelte/store";
  import MigrationModal from "@/ui/MigrationModal.svelte";

  let q = "";
  let res: Awaited<ReturnType<typeof fttf.adapter.backend.search>> | null = null;
  let results: ResultRow[] | undefined;
  let currentIndex = 0;
  let enableMouseEvents = false;
  let showMigrationModal = false;

  // Parse query parameters
  const getParams = () => {
    const searchParams = new URLSearchParams(get(querystring));
    return {
      q: searchParams.get("q") || "",
    };
  };

  let params = getParams();

  // Update params when querystring changes
  $: $querystring, (params = getParams());

  const handleMouseMove = (e: MouseEvent) => {
    if (!enableMouseEvents) enableMouseEvents = true;
  };

  $: preprocessQuery = $displaySettings.preprocessQuery;

  const updateUrlWithQuery = (query: string) => {
    if (params.q !== query) {
      const searchParams = new URLSearchParams();
      searchParams.set("q", query);
      push(`/?${searchParams.toString()}`);
    }
  };

  const handleSearch = debounce(async (query: string) => {
    query = query.trim();
    if (query.length >= MIN_QUERY_LENGTH) {
      res = await fttf.adapter.backend.search({
        query,
        limit: 500,
        orderBy: $displaySettings.sortMode,
        preprocessQuery,
      });
      currentIndex = 0;
      console.log("[search-results]", res);
      updateUrlWithQuery(query);
    } else {
      res = null;
      updateUrlWithQuery("");
    }
  }, 120);

  // Re-search if the preprocessQuery setting changes
  $: {
    preprocessQuery;
    handleSearch(q);
  }

  // Using getFaviconByUrl from utils.ts

  const scrollIntoView = (i: number) => {
    const el = document.querySelector<HTMLDivElement>(`[data-groupIndex='${i}']`);
    if (el /* && ((el.offsetTop + el.offsetHeight) > window.innerHeight) */) {
      if (i === urls.length - 1) {
        // scroll to bottom
        el.parentElement?.scrollTo({ top: el.offsetTop, behavior: "smooth" });
      } else {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  };

  let input: HTMLInputElement | null = null;

  const keybinds: Record<string, (e: KeyboardEvent) => void> = {
    "/": (e) => {
      if (document.activeElement !== input) {
        e.preventDefault();
        input?.select();
      }
    },
    Escape: (e) => {
      e.preventDefault();
      q = "";
      tick().then(() => {
        input?.focus();
      });
    },
    ArrowUp: (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        currentIndex--;
        scrollIntoView(currentIndex);
      }
    },
    ArrowDown: (e) => {
      e.preventDefault();
      const len = Object.keys(groups || {}).length;
      if (currentIndex < len - 1) {
        currentIndex++;
        scrollIntoView(currentIndex);
      }
    },
    Enter: (e) => {
      e.preventDefault();
      if (currentUrl && e.metaKey) {
        const encodedUrl = encodeURIComponent(currentUrl);
        push(`/doc/${encodedUrl}`);
      } else {
        // open a new tab
        window.open(currentUrl, "_blank");
      }
    },
  };

  let loading = true;
  let error: string | null = null;
  let errorDetail: any = null;

  onMount(async () => {
    await tick();
    input?.focus();

    const initialQuery = params.q;

    if (initialQuery) {
      q = initialQuery;
      handleSearch(initialQuery);
    }

    let status = await fttf.adapter.backend.getStatus();

    // Wait. Sometimes the backend takes a while to start up
    if (!status.ok) {
      for (const wait of [100, 200, 300, 400, 500, 1000, 2000]) {
        await new Promise((resolve) => setTimeout(resolve, wait));
        status = await fttf.adapter.backend.getStatus();
        if (status.ok) {
          break;
        }
      }
    }

    // If still not OK assume it's an error
    if (!status.ok) {
      error = status.error;
      errorDetail = status.detail;
    } else {
      loading = false;
      await updateStats();

      // Check for VLCN migration
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const migrationStatus = await rpc(["checkVLCNMigrationStatus"]);
        if (
          migrationStatus?.available &&
          !migrationStatus?.migrated &&
          migrationStatus?.documentCount > 0
        ) {
          showMigrationModal = true;
        }
      } catch (error) {
        console.error("Error checking VLCN migration status", error);
      }
    }
  });

  const groupByUrl = (results?: ResultRow[]) => {
    if (!results) {
      return;
    }

    const hitsByUrl: Record<string, Set<string>> = {};

    const urlCanParse = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch (error) {
        return false;
      }
    };

    return results.reduce(
      (acc, x) => {
        const key = x.url;
        hitsByUrl[key] ??= new Set();

        // This SHOULD NOT happen, but it was a bug at one point thus the guard
        if (!urlCanParse(key)) {
          console.warn("groupByUrl :: invalid URL ::", key);
          return acc;
        }

        acc[key] ??= {
          id: x.rowid,
          url: x.url, // @note this should be href-able
          displayUrl: cleanUrl(x.url),
          title: x.title,
          hostname: x.hostname,
          last_visit: x.last_visit,
          hits: [],
        };

        // Update last_visit if current item has a more recent timestamp
        if (x.last_visit && (!acc[key].last_visit || x.last_visit > acc[key].last_visit)) {
          // @ts-ignore
          acc[key].last_visit = x.last_visit;
        }

        if (x.attribute === "title") {
          acc[key].title = x.snippet;
        } else if (x.attribute === "url") {
          acc[key].displayUrl = cleanUrl(x.snippet as string);
        } else if (x.snippet && !hitsByUrl[key].has(x.snippet)) {
          hitsByUrl[key].add(x.snippet);
          acc[key].hits.push(x);
        }

        return acc;
      },
      {} as Record<
        string,
        {
          id: number;
          url: string;
          displayUrl?: string;
          title?: string;
          hostname: string;
          last_visit?: number;
          hits: ResultRow[];
        }
      >
    );
  };

  $: {
    q;
    $displaySettings.sortMode;
    handleSearch(q);
  }
  $: results = res?.results;
  $: groups = groupByUrl(results);

  // Always group URLs by date regardless of sort mode
  $: dateGroupedResults = groupByDate(groups || {});

  $: urls = Object.values(dateGroupedResults).flatMap((group) => Object.keys(group));

  $: currentUrl = urls.at(currentIndex);

  // Function to group results by date when sorting by last_visit
  const groupByDate = (urlGroups: Record<string, any>) => {
    const groupedByDate: Record<string, Record<string, any>> = {};

    Object.entries(urlGroups).forEach(([url, group]) => {
      if (!group.last_visit) {
        groupedByDate["Unknown"] = groupedByDate["Unknown"] || {};
        groupedByDate["Unknown"][url] = group;
        return;
      }

      const visitDate = new Date(group.last_visit);
      const today = new Date();

      let dateKey;
      if (
        visitDate.getFullYear() === today.getFullYear() &&
        visitDate.getMonth() === today.getMonth() &&
        visitDate.getDate() === today.getDate()
      ) {
        dateKey = "Today";
      } else {
        dateKey = visitDate.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      groupedByDate[dateKey] = groupedByDate[dateKey] || {};
      groupedByDate[dateKey][url] = group;
    });

    return groupedByDate;
  };
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:keydown={(e) => {
    const key = e.key;
    if (keybinds[key]) {
      if (enableMouseEvents) enableMouseEvents = false;
      keybinds[key](e);
    }
  }}
/>

<div class="App">
  <form on:submit|preventDefault class="px-3 md:px-6 pt-3 md:pt-6">
    <input
      class="w-full block px-3 md:px-6 py-3 text-lg font-mono text-white bg-slate-800 focus:ring-2 ring-indigo-300 border-none rounded-lg"
      type="text"
      placeholder="Search.."
      bind:this={input}
      bind:value={q}
    />
  </form>
  <div
    class="stats px-6 md:px-12 py-6 text-sm text-slate-400 flex flex-col sm:flex-row sm:justify-between"
  >
    <div class="InnerStats">
      {#if res}
        Showing {results?.length} of {res.count}. Took
        <code>{Math.round(10 * res.perfMs) / 10}</code>ms.
      {:else if $stats && $displaySettings.showStats}
        <div class="inline-stats flex space-x-4" in:fly|local={{ y: -20, duration: 150 }}>
          {#each Object.entries($stats) as [k, v]}
            <span><strong>{k}:</strong> {v}</span>
          {/each}
        </div>
      {/if}
    </div>

    {#if res}
      <div class="flex justify-between items-center mb-2">
        <div class="sort-controls flex items-center">
          <span class="mr-2">Sort by:</span>
          <label class="inline-flex items-center mr-3 cursor-pointer">
            <input
              type="radio"
              name="sortMode"
              value="last_visit"
              bind:group={$displaySettings.sortMode}
              class="form-radio h-4 w-4 text-indigo-600 bg-slate-700 border-slate-500 focus:ring-indigo-500"
            />
            <span class="ml-1">Last Visit</span>
          </label>
          <label class="inline-flex items-center cursor-pointer">
            <input
              type="radio"
              name="sortMode"
              value="rank"
              bind:group={$displaySettings.sortMode}
              class="form-radio h-4 w-4 text-indigo-600 bg-slate-700 border-slate-500 focus:ring-indigo-500"
            />
            <span class="ml-1">Rank</span>
          </label>
        </div>
      </div>
    {/if}
  </div>
  {#if error}
    <div
      class="error px-6 md:px-12 py-6 text-sm text-red-200 bg-red-900/70 m-6 rounded-lg border border-red-600"
    >
      <h3 class="text-3xl">Error: <code>{error}</code></h3>
      <pre>{errorDetail?.stack}</pre>
    </div>
  {/if}
  {#if !res}
    <div class="recent px-6 md:px-12 py-6 max-w-[inherit] overflow-auto">
      <RecentItems limit={500} offset={0} />
    </div>
  {/if}
  <div class="results px-6 md:p-12 md:pt-6 overflow-auto flex flex-col space-y-4">
    {#each Object.entries(dateGroupedResults) as [date, dateGroup], dateIndex (date)}
      {#if Object.keys(dateGroup).length > 0}
        <div class="date-group">
          <div class="text-sm font-medium text-slate-400 mb-2">{date}</div>
          {#each Object.entries(dateGroup) as [url, group], urlIndex (url)}
            <!-- Using ResultItem for the main item display -->
            <ResultItem
              item={{
                rowid: group.id,
                id: group.id,
                entity_id: group.id,
                attribute: "url",
                url: group.url,
                hostname: group.hostname,
                title: group.title,
                snippet: group.title,
                last_visit: group.last_visit,
                updated_at: 0,
                created_at: 0,
              }}
              showTime={true}
              showSnippets={false}
              selected={currentUrl === url}
              highlightClass="bg-slate-800"
              groupIndex={urls.indexOf(url)}
              on:focus={() => (currentIndex = urls.indexOf(url))}
              on:mouseover={() => {
                if (enableMouseEvents) {
                  currentIndex = urls.indexOf(url);
                }
              }}
            >
              <!-- Render snippets inside the slot -->
              {#each group.hits as hit (hit.rowid)}
                <ResultRowView item={hit} />
              {/each}
            </ResultItem>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
</div>

<MigrationModal open={showMigrationModal} on:close={() => (showMigrationModal = false)} />

<style>
  .App {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto minmax(0, 1fr);
  }
</style>
