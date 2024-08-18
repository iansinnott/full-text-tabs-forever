<script lang="ts">
  import classNames from "classnames";
  import { fly } from "svelte/transition";
  import { rpc } from "./lib/rpc";
  import { displaySettings } from "./store/displaySettings";
  import { url } from "@roxi/routify";
  import { routes } from "./.routify/routes";
  let _class: string = "";
  export { _class as class };
  export let open: boolean = false;
  export let onClose: () => void;
  let filterText = "";
  let currentIndex = 0;
  let fileInput: HTMLInputElement;

  const routeLabels = {
    index: "Search",
    "database-repl": "Database REPL",
    settings: "Settings",
  };

  const commands = [
    ...routes
      .filter((route) => route.filepath !== "/index.svelte")
      .filter((route) => (console.log(route), true))
      .map((route) => ({
        name: `Page: ${routeLabels[route.name] || route.name}`,
        exec: async () => {
          const newHash = "#" + route.path;
          window.location.hash = newHash;
          return true;
        },
      })),
    {
      name: "DB: Import...",
      exec: async () => {
        console.log("import");
        fileInput?.click();
        return false;
      },
    },
    {
      name: "DB: Export...",
      exec: async () => {
        console.log("export");
        await rpc(["exportJson"]);
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
    "fixed top-1/4 left-1/2 transform -translate-x-1/2 w-full max-w-[600px] rounded-lg shadow shadow-black",
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
    <input
      class="hidden"
      type="file"
      bind:this={fileInput}
      on:change={(e) => {
        const file = e.currentTarget.files?.[0];
        console.log("file", file);
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const text = reader.result;
            if (typeof text === "string") {
              await rpc(["importJson", JSON.parse(text)]);
              onClose();
            } else {
              console.error("invalid file", text);
            }
          };
          reader.readAsText(file);
        }
      }}
    />
  </form>
  <div class="commands p-2 text-lg">
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
