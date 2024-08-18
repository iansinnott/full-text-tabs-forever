<script lang="ts">
  import { Cog } from "lucide-svelte";
  import { menuOpen } from "@/ui/store/menuState";
  import Menu from "@/ui/Menu.svelte";
  import { tick } from "svelte";
</script>

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
  on:click={() => {
    $menuOpen = !$menuOpen;
    if ($menuOpen) {
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
</style>
