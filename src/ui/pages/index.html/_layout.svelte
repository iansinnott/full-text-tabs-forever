<script lang="ts">
  import { Cog } from "lucide-svelte";
  import { menuOpen } from "@/ui/store/menuState";
  import Menu from "@/ui/Menu.svelte";
  import { onMount, tick } from "svelte";
  import { fttf } from "@/ui/lib/rpc";
  import { routes } from "@/ui/.routify/routes";
  import { toLabel } from "@/common/utils";

  onMount(() => {
    if (typeof window !== "undefined") {
      (window as any).fttf = fttf;
    }
  });

  const handleCmdK = () => {
    $menuOpen = !$menuOpen;
    if ($menuOpen) {
      tick().then(() => {
        document.querySelector<HTMLInputElement>("input[data-menu-input]")?.focus();
      });
    }
  };

  const routeLabels = {
    index: "Search",
    "database-repl": "Database REPL",
    settings: "Settings",
  };

  const navigationRoutes = [
    routes.find((route) => route.name === "index"), // Search page first
    ...routes.filter((route) => route.name !== "index"),
  ].filter(Boolean);
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCmdK();
    }
  }}
/>

<div class={"App h-screen"}>
  <header>
    <!-- Intentionally empty for now. a placeholder -->
  </header>
  <slot />
</div>

{#if $menuOpen}
  <Menu
    onClose={() => {
      $menuOpen = false;
    }}
  />
{/if}

<div class="LowerMenu">
  <nav class="flex space-x-2 overflow-x-auto rounded bg-zinc-900 border border-zinc-600 text-white">
    {#each navigationRoutes as route}
      <a
        href={"#" + route.path}
        class="flex-shrink-0 px-4 py-2 hover:bg-zinc-800 whitespace-nowrap items-center flex"
      >
        {routeLabels[route.name] || toLabel(route.name)}
      </a>
    {/each}
  </nav>
  <button
    class="flex-shrink-0 p-2 rounded bg-zinc-900 border border-zinc-600 w-11 h-11 hover:bg-zinc-800"
    on:click={handleCmdK}
  >
    <Cog />
  </button>
</div>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  nav::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  nav {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
  .LowerMenu {
    @apply fixed bottom-4 left-4 z-10 max-w-[calc(100%-2rem)] w-full;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }
</style>
