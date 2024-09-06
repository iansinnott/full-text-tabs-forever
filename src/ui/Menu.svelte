<script lang="ts">
  import classNames from "classnames";
  import { fly } from "svelte/transition";
  import { rpc } from "./lib/rpc";
  import { displaySettings } from "./store/displaySettings";
  import { routes } from "./.routify/routes";
  import { dumpDataDir, handleImport, loadDataDir, vacuumFull, exportJson } from "./lib/commands";
  import { toLabel } from "@/common/utils";
  let _class: string = "";
  export { _class as class };
  export let open: boolean = false;
  export let onClose: () => void;
  let filterText = "";
  let currentIndex = 0;

  const routeLabels = {
    index: "Search",
    "database-repl": "Database REPL",
    settings: "Settings",
  };

  console.debug("fttf :: routes", routes);

  const commands = [
    ...routes
      .filter((route) => route.filepath !== "/index.svelte")
      .filter((route) => !route.name.startsWith("["))
      .map((route) => ({
        name: `Page: ${routeLabels[route.name] || toLabel(route.name)}`,
        exec: async () => {
          const newHash = "#" + route.path;
          window.location.hash = newHash;
          return true;
        },
      })),
    {
      name: "DB: Import...",
      exec: async () => {
        const result = await handleImport();
        if (result.success) {
          onClose();
          return true;
        }
        return false;
      },
    },
    {
      name: "DB: Export...",
      exec: async () => {
        const result = await exportJson();
        if (result.success) {
          onClose();
          return true;
        }
        return false;
      },
    },
    {
      name: "DB: Vacuum",
      exec: async () => {
        const res = await vacuumFull();
        console.log("vacuum", res);
        return true;
      },
    },
    {
      name: "DB: Dump Data Dir",
      exec: async () => {
        const res = await dumpDataDir();
        if (res) {
          console.log("dumpDataDir :: err", res);
          return false;
        }
        return true;
      },
    },
    {
      name: "DB: Load Data Dir",
      exec: async () => {
        const res = await loadDataDir();
        console.log("loadDataDir", res);
        return true;
      },
    },
    {
      name: "UI: Toggle Show Stats",
      exec: async () => {
        displaySettings.update((s) => ({ ...s, showStats: !s.showStats }));
        return true;
      },
    },
    {
      name: "Dev: Toggle Query Processing",
      exec: async () => {
        displaySettings.update((s) => ({ ...s, preprocessQuery: !s.preprocessQuery }));
        return true;
      },
    },
    {
      name: "Dev: Reindex",
      exec: async () => {
        const res = await rpc(["reindex"]);
        console.log("reindex", res);
        return true;
      },
    },
  ];

  $: filteredCommands = commands.filter((c) =>
    c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const scrollIntoView = (index: number) => {
    const el = document.querySelector(`.commands:nth-child(${index + 1})`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const keybinds: Record<string, (e: KeyboardEvent) => void> = {
    Escape: () => {
      onClose();
    },
    Enter: async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (filteredCommands[currentIndex]) {
        const shouldClose = await filteredCommands[currentIndex].exec();
        if (shouldClose) onClose();
      }
    },
    ArrowDown: () => {
      if (currentIndex < filteredCommands.length - 1) {
        currentIndex++;
        scrollIntoView(currentIndex);
      }
    },
    ArrowUp: () => {
      if (currentIndex > 0) {
        currentIndex--;
        scrollIntoView(currentIndex);
      }
    },
  };

  const handleKeydown = (e: KeyboardEvent) => {
    const fn = keybinds[e.key];
    if (fn) {
      fn(e);
    }
  };
</script>

<div
  in:fly={{ y: 20, duration: 200 }}
  out:fly={{ y: 20, duration: 200 }}
  on:keydown={handleKeydown}
  class={classNames(
    "fixed top-[20%] left-1/2 transform -translate-x-1/2 w-full max-w-[600px] rounded-lg shadow shadow-black",
    "bg-zinc-900 text-white",
    _class
  )}
>
  <form on:submit|preventDefault>
    <input
      type="text"
      bind:value={filterText}
      on:input={() => (currentIndex = 0)}
      data-menu-input
      class="appearance-none w-full outline-none focus:ring-0 text-white text-lg bg-[#1d1d1d] rounded-t-lg px-3 py-3 border-none border-b border-zinc-600"
    />
  </form>
  <div class="commands p-2 text-lg overflow-auto max-h-[60vh]">
    {#each filteredCommands as command, i (command.name)}
      <div
        on:mouseenter={() => {
          currentIndex = i;
        }}
        on:click={async () => {
          const shouldClose = await command.exec();
          if (shouldClose) onClose();
        }}
        class={classNames("command p-2 rounded", { "bg-white/10": currentIndex === i })}
      >
        {command.name}
      </div>
    {:else}
      <div class="text-center py-3 font-mono">No commands</div>
    {/each}
  </div>
</div>
