<script context="module" lang="ts">
  import type { ResultRow } from '@/background/backend';
  import {fly} from 'svelte/transition'
  import classNames from 'classnames';
  import type { FTTF } from '../background';
  declare global {
    interface Window {
      fttf: FTTF;
    }
  }
</script>

<script lang="ts">
  import DetailsPanel from "./DetailsPanel.svelte";

  let q = "";
  let res: Awaited<ReturnType<typeof window.fttf.adapter.backend.search>> | null = null;
  let results: ResultRow[] | undefined;
  let currentIndex = 0;
  let showDetails = false;
  
  const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        fn(...args);
      }, delay);
    };
  };

  const handleSearch = debounce(async (query: string) => {
    query = query.trim();
    if (query.length > 2) {
      res = await window.fttf.adapter.backend.search({ query });
      currentIndex = 0;
    } else {
      // Clear query
      res = null;
    }
  }, 100);

  const getFaviconByUrl = (url: string) => {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}`;
  };
  
  const scrollIntoView = (i: number) => {
    const el = document.querySelector<HTMLDivElement>(`[data-groupIndex='${i}']`);
    if (el /* && ((el.offsetTop + el.offsetHeight) > window.innerHeight) */) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  $: scrollIntoView(currentIndex);

  const keybinds: Record<string, (e: KeyboardEvent) => void> = {
    Escape: () => {
      if (showDetails) {
        showDetails = false;
      } else {
        q = "";
      }
    },
    ArrowUp: () => {
      if (currentIndex > 0) {
        currentIndex--;
      }
    },
    ArrowDown: () => {
      const len = Object.keys(groups || {}).length;
      if (currentIndex < (len - 1)) {
        currentIndex++;
      }
    },
    Enter: (e) => {
      if (currentUrl && e.metaKey) {
        // open a new tab
        window.open(currentUrl, "_blank");
      } else {
        showDetails = true;
      }
    },
  };
  
  const cleanUrl = (url: string) => {
    return url.replace(/^(https?:\/\/(?:www)?)/, '').replace(/\/$/, '');
  }

  const groupByUrl = (results?: ResultRow[]) => {
    if (!results) {
      return;
    }
    
    const hitsByUrl: Record<string, Set<string>> = {};

    return results.reduce((acc, x) => {
      const key = x.url
      hitsByUrl[key] ??= new Set();

      acc[key] ??= {
        id: x.rowid,
        url: x.url, // @note this should be href-able
        displayUrl: cleanUrl(x.url),
        title: x.title,
        hostname: x.hostname,
        hits: [],
      };
      
      if (x.attribute === 'title') {
        acc[key].title = x.snippet;
      } else if (x.attribute === 'url') {
        acc[key].displayUrl = cleanUrl(x.snippet as string);
      } else if (x.snippet && !hitsByUrl[key].has(x.snippet)) {
        hitsByUrl[key].add(x.snippet)
        acc[key].hits.push(x);
      }

      return acc;
    }, {} as Record<string, { id: number, url: string, displayUrl?: string, title?: string, hostname: string, hits: ResultRow[] }>)
  }
  
  $: handleSearch(q);
  $: results = res?.results;
  $: groups = groupByUrl(results);
  $: urls = Object.keys(groups || {});
  $: currentUrl = urls.at(currentIndex);
</script>

<svelte:window
  on:keydown={(e) => {
    if (keybinds[e.key]) {
      e.preventDefault();
      keybinds[e.key](e);
    }
  }}
/>

<div class={"App h-screen"}>
  <header>
    <!-- Intentionally empty for now. a placeholder -->
  </header>
  <form on:submit|preventDefault class="px-3 md:px-6 pt-3 md:pt-6">
    <!-- svelte-ignore a11y-autofocus -->
    <input
      autofocus
      class="w-full block px-3 md:px-6 py-3 text-lg font-mono text-white bg-slate-800 focus:ring-2 ring-indigo-300 border-none rounded-lg"
      type="text"
      placeholder="Search.."
      bind:value={q}
    />
  </form>
  <div class="stats px-6 md:px-12 py-6 text-sm text-slate-400">
    {#if res}
      Showing {results?.length} of {res.count}. Took <code>{res.perfMs}</code>ms.
    {/if}
  </div>
  <div class="results px-6 md:p-12 md:pt-6 overflow-auto flex flex-col space-y-4">
    {#each Object.entries(groups || []) as [url, group], i (url)}
      {@const u = new URL(url)}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        data-groupIndex={i}
        class={classNames("result-group p-2 -mx-2 rounded-lg", {
          "bg-slate-800": i === currentIndex,
          "bg-transparent": i !== currentIndex,
        })}
        on:mouseenter={() => {
          currentIndex = i;
        }}
        on:click={(e) => {
          currentIndex = i;
          showDetails = true;
        }}
      >
        <a class="result" href={url} on:click|preventDefault>
          <div class="favicon mr-3">
            <img
              class="w-4 h-4 rounded-lg"
              src={getFaviconByUrl(url)}
              alt="favicon for {u.hostname}"
            />
          </div>
          <div class="title mr-3 text-slate-300">{@html group.title}</div>
          <div class="url truncate text-indigo-200">
            {@html group.displayUrl}
          </div>
        </a>
        {#each group.hits as hit (hit.rowid)}
          <div class="fts-result pl-7">
            {@html hit.snippet}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

{#if showDetails}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    on:click={(e) => {
      showDetails = false;
    }}
    transition:fly={{ x: 0, duration: 200 }}
    class={classNames(
      "DetailPanel h-screen absolute top-0 bottom-0 w-full transition-all bg-zinc-900 shadow-lg overflow-auto p-6 md:p-12",
      {
        "left-[10%]": showDetails,
        "left-full": !showDetails,
      }
    )}
  >
    {#if currentUrl}
      <DetailsPanel docUrl={currentUrl} />
    {:else}
      <p>Not current</p>
    {/if}
  </div>
{/if}

<style>
  .App {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto minmax(0, 1fr);
  }
  .result {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
</style>
