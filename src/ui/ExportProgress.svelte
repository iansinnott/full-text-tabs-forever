<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  
  export let visible = false;
  export let current = 0;
  export let total = 0;
  
  const progress = writable(0);
  const percentage = writable(0);
  
  $: {
    $progress = current;
    $percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  }
</script>

{#if visible}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
      <h3 class="text-lg font-semibold mb-4">Exporting Database</h3>
      
      <div class="mb-4">
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            class="bg-blue-600 h-2.5 rounded-full" 
            style="width: {$percentage}%"
          ></div>
        </div>
        <div class="mt-2 text-sm text-gray-600 flex justify-between">
          <span>{$progress} of {total} documents</span>
          <span>{$percentage}%</span>
        </div>
      </div>
      
      <p class="text-sm text-gray-600 mb-4">
        Please don't close this window while export is in progress.
      </p>
    </div>
  </div>
{/if}