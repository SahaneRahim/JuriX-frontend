<script lang="ts">
  import { page } from "$app/stores";
  import "../app.css";
</script>

<!-- 
  Global Layout Removed to support individual page designs.
  Each page (+page.svelte) is now responsible for its own layout (Header/Footer).
  This prevents duplicate navbars when using the new design system.
-->

<slot />
