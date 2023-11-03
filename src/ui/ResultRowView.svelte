<script lang="ts">
  import type { ResultRow } from "@/background/backend";
  import classNames from "classnames";
  import { onMount, tick } from "svelte";
  import { makeHighlights } from "./lib/dom";
  let _class: string = "";
  export let item: ResultRow;
  export let q: string;
  export { _class as class };
  let el: HTMLDivElement | null = null;

</script>

<div bind:this={el} data-has-snippet="1" class={classNames("fts-result pl-7", _class)}>
  <!-- {@html item.snippet} -->
  {item.snippet}
</div>
