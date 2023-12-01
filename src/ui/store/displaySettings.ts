import { writable } from "svelte/store";

export const displaySettings = writable({
  showStats: true,
  preprocessQuery: true,
});
