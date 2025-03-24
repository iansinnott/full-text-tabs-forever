<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';

  export let open = false;
  export let title = '';
  export let showClose = true;
  export let wideContent = false;

  const dispatch = createEventDispatcher();

  const closeModal = () => {
    dispatch('close');
  };

  // Close on escape key
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      closeModal();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    on:click|self={closeModal}
    in:fly={{ y: -10, duration: 150 }}
    out:fly={{ y: -10, duration: 100 }}
  >
    <div class={`bg-slate-900 rounded-lg shadow-xl ${wideContent ? 'w-full max-w-2xl' : 'max-w-md w-full'}`}>
      <div class="flex justify-between items-center p-4 border-b border-slate-700">
        <h3 class="text-lg font-medium">{title}</h3>
        {#if showClose}
          <button
            type="button"
            class="text-slate-400 hover:text-white"
            on:click={closeModal}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        {/if}
      </div>
      <div class="p-4">
        <slot></slot>
      </div>
    </div>
  </div>
{/if}