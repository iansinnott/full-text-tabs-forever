<script lang="ts">
  import { Cog } from "lucide-svelte";
  import type { ResultRow } from "@/background/backend";
  import { fly } from "svelte/transition";
  import DetailsPanel from "./DetailsPanel.svelte";
  import { debounce } from "../common/utils";
  import { onMount, tick } from "svelte";
  import classNames from "classnames";
  import { fttf, rpc } from "./lib/rpc";
  import ResultRowView from "./ResultRowView.svelte";
  import Menu from "./Menu.svelte";
  import { MIN_QUERY_LENGTH } from "./lib/constants";
  import { displaySettings } from "./store/displaySettings";

  let q = "";
  let res: Awaited<ReturnType<typeof fttf.adapter.backend.search>> | null = null;
  let results: ResultRow[] | undefined;
  let currentIndex = 0;
  let showDetails = false;
  let enableMouseEvents = false;

  const handleMouseMove = (e: MouseEvent) => {
    if (!enableMouseEvents) enableMouseEvents = true;
  };

  $: preprocessQuery = $displaySettings.preprocessQuery;

  const handleSearch = debounce(async (query: string) => {
    query = query.trim();
    if (query.length >= MIN_QUERY_LENGTH) {
      res = await fttf.adapter.backend.search({
        query,
        limit: 500,
        orderBy: "updatedAt",
        preprocessQuery,
      });
      currentIndex = 0;
      console.log("[search-results]", res);
    } else {
      // Clear query
      res = null;
    }
  }, 120);

  // Re-search if the preprocessQuery setting changes
  $: {
    preprocessQuery;
    handleSearch(q);
  }

  const getFaviconByUrl = (url: string) => {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}`;
  };

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
      if (showDetails) {
        showDetails = false;
      } else {
        q = "";
        tick().then(() => {
          input?.focus();
        });
      }
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
        showDetails = true;
      } else {
        // open a new tab
        window.open(currentUrl, "_blank");
      }
    },
    "cmd+k": () => {
      menuOpen = !menuOpen;
      if (menuOpen) {
        tick().then(() => {
          document.querySelector<HTMLInputElement>("input[data-menu-input]")?.focus();
        });
      }
    },
  };

  let loading = true;
  let error: string | null = null;
  let errorDetail: any = null;
  type Stats = {
    Documents: string;
    Fragments: string;
    Size: string;
  };
  let stats: Stats | null = null;

  onMount(async () => {
    await tick();
    input?.focus();

    let status = await fttf.adapter.backend.getStatus();

    if (typeof window !== "undefined") {
      // @ts-expect-error
      window.fttf = fttf;
    }

    // Wait. Sometimes the backend takes a while to start up
    if (!status.ok) {
      for (const wait of [100, 200, 300, 400, 500]) {
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
      const _stats = (await rpc(["getStats"])) as {
        document: { count: number };
        document_fragment: { count: number };
        db: { size_bytes: number };
      };

      console.log("[stats]", _stats);

      stats = {
        Documents: _stats.document.count.toLocaleString(),
        Fragments: _stats.document_fragment.count.toLocaleString(),
        Size: (_stats.db.size_bytes / 1024 / 1024).toFixed(2) + "MB",
      };
    }
  });

  const cleanUrl = (url: string) => {
    return url.replace(/^(https?:\/\/(?:www\.)?)/, "").replace(/\/$/, "");
  };

  let menuOpen = false;

  const groupByUrl = (results?: ResultRow[]) => {
    if (!results) {
      return;
    }

    const hitsByUrl: Record<string, Set<string>> = {};

    return results.reduce(
      (acc, x) => {
        const key = x.url;
        hitsByUrl[key] ??= new Set();

        acc[key] ??= {
          id: x.rowid,
          url: x.url, // @note this should be href-able
          displayUrl: cleanUrl(x.url),
          title: x.title,
          hostname: x.hostname,
          hits: [],
        };

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
          hits: ResultRow[];
        }
      >
    );
  };

  $: handleSearch(q);
  $: results = res?.results;
  $: groups = groupByUrl(results);
  $: urls = Object.keys(groups || {});
  $: currentUrl = urls.at(currentIndex);
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:keydown={(e) => {
    // NOTE the mouse has odd behavior, at least in brave. It will send a
    // mouseover event without being moved. They keyboard can be used to scroll
    // so new elements fall below the mouse. they get a mouseover event. Thus
    // this logic
    const key = e.key;
    const isModifierPressed = e.ctrlKey || e.metaKey;
    const keybind = isModifierPressed ? `cmd+${key}` : key;
    if (keybinds[keybind]) {
      if (enableMouseEvents) enableMouseEvents = false; // See NOTE
      keybinds[keybind](e);
    }
  }}
/>

<div class={"App h-screen"}>
  <header>
    <!-- Intentionally empty for now. a placeholder -->
  </header>
  <form on:submit|preventDefault class="px-3 md:px-6 pt-3 md:pt-6">
    <input
      class="w-full block px-3 md:px-6 py-3 text-lg font-mono text-white bg-slate-800 focus:ring-2 ring-indigo-300 border-none rounded-lg"
      type="text"
      placeholder="Search.."
      bind:this={input}
      bind:value={q}
    />
  </form>
  <div class="stats px-6 md:px-12 py-6 text-sm text-slate-400">
    {#if res}
      Showing {results?.length} of {res.count}. Took <code>{Math.round(10*res.perfMs)/10}</code>ms.
    {:else if stats && $displaySettings.showStats}
      <div class="inline-stats flex space-x-4" in:fly|local={{ y: -20, duration: 150 }}>
        {#each Object.entries(stats) as [k, v]}
          <span><strong>{k}:</strong> {v}</span>
        {/each}
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
  <div class="results px-6 md:p-12 md:pt-6 overflow-auto flex flex-col space-y-0">
    {#each Object.entries(groups || []) as [url, group], i (url)}
      {@const u = new URL(url)}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        data-groupIndex={i}
        class={classNames("result-group p-3 -mx-2 rounded-lg", {
          "bg-slate-800": i === currentIndex,
          "bg-transparent": i !== currentIndex,
        })}
        on:focus={() => (currentIndex = i)}
        on:mouseover={() => {
          if (enableMouseEvents) {
            currentIndex = i;
          }
        }}
        on:click={(e) => {
          currentIndex = i;
          showDetails = true;
        }}
      >
        <a class="result mb-1" href={url} on:click|preventDefault>
          <div class="favicon mr-3 self-center">
            <img
              class="w-4 h-4 rounded-lg"
              src={getFaviconByUrl(url)}
              alt="favicon for {u.hostname}"
            />
          </div>
          <div class="title mr-3 text-slate-300 text-base">{@html group.title}</div>
          <div class="url truncate text-indigo-200">
            {@html group.displayUrl}
          </div>
        </a>
        {#each group.hits as hit (hit.rowid)}
          <ResultRowView item={hit} />
        {/each}
      </div>
    {/each}
  </div>
</div>

{#if menuOpen}
  <Menu
    onClose={() => {
      menuOpen = false;
    }}
  />
{/if}

{#if showDetails}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    on:click={(e) => {
      showDetails = false;
    }}
    in:fly={{ x: 200, duration: 200 }}
    out:fly={{ x: 200, duration: 200 }}
    class={classNames(
      "DetailPanel h-screen absolute left-auto right-0 top-0 bottom-0 w-full max-w-[768px] bg-zinc-900 shadow-lg shadow-black border-l border-[#33383f] overflow-auto p-6 md:p-12"
    )}
  >
    {#if currentUrl}
      <DetailsPanel docUrl={currentUrl} />
    {:else}
      <p>Not current</p>
    {/if}
  </div>
{/if}

<button
  class="fixed bottom-4 left-4 z-10 p-2 rounded-full bg-zinc-900 border border-zinc-600"
  on:click={() => {
    menuOpen = !menuOpen;
    if (menuOpen) {
      tick().then(() => {
        // @ts-expect-error Inline code like this isn't real TS, so we wan't add the type without breaking svelte
        document.querySelector("input[data-menu-input]")?.focus();
      });
    }
  }}
>
  <Cog />
</button>

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
    align-items: baseline;
  }
</style>
