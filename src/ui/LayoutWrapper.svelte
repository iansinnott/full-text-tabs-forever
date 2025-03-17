<script>
  export let layout;
  export let component;
  export let params = {};
</script>

<svelte:component this={layout}>
  <svelte:component this={component} {params} />
</svelte:component>