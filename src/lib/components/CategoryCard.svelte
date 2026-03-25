<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let title: string;
  export let description: string;
  export let icon: string;
  export let color: string = "bg-blue-500"; // Expecting classes like 'bg-blue-100 text-blue-600' passed via prop logic or handled here

  const dispatch = createEventDispatcher();

  // Helper to derive background/text colors if simple color name is passed
  // or assume the parent passes the full class string for the bg.
  // For simplicity, let's assume 'color' prop might need adjustment or we map it here.
  // But based on current usage, 'color' is like 'blue', 'indigo' etc. in +page.svelte.

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    cyan: "bg-cyan-50 text-cyan-600",
    slate: "bg-slate-50 text-slate-600",
    // Fallbacks
    "bg-blue-500": "bg-blue-50 text-blue-600",
  };

  $: themeClasses = colorMap[color] || colorMap["blue"];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="group flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer"
  on:click={() => dispatch("click")}
>
  <div class="mb-4">
    <div
      class="flex h-12 w-12 items-center justify-center rounded-lg {themeClasses} transition-transform group-hover:scale-110"
    >
      <span class="text-xl">{icon}</span>
    </div>
  </div>

  <div>
    <h3
      class="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
    >
      {title}
    </h3>
    <p class="text-sm text-slate-500 mt-2 leading-relaxed">{description}</p>
  </div>
</div>
