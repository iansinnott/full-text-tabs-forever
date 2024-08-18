<script lang="ts">
  import { Cog } from "lucide-svelte";
  import { menuOpen } from "@/ui/store/menuState";
  import Menu from "@/ui/Menu.svelte";
  import { tick } from "svelte";

  const handleCmdK = () => {
    $menuOpen = !$menuOpen;
    if ($menuOpen) {
      tick().then(() => {
        document.querySelector<HTMLInputElement>("input[data-menu-input]")?.focus();
      });
    }
  };
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

<button
  class="fixed bottom-4 left-4 z-10 p-2 rounded-full bg-zinc-900 border border-zinc-600"
  on:click={handleCmdK}
>
  <Cog />
</button>

<style>
</style>
