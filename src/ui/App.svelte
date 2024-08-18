<script lang="ts">
  import { Router } from "@roxi/routify";
  import { routes } from "./.routify/routes";
</script>

<Router config={{ useHash: true }} {routes} />
