<script lang="ts">
  import { tr } from '$lib/stores/language';
  export let title: string;
  export let value: string;
  export let change: string | null = null;
  export let trend: 'up' | 'down' | 'neutral' = 'neutral';
  export let icon: string;
  export let color: string = 'blue';

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-amber-100 text-amber-600'
  };

  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-slate-500'
  };
</script>

<!-- Plus compacte sur téléphone, où quatre cartes s'empilent ; l'icône ne
     rétrécit pas (shrink-0) quand le titre est long. -->
<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:p-6">
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <p class="text-sm font-medium text-slate-500">{title}</p>
      <h3 class="coupe-mots mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{value}</h3>
    </div>
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 {colorClasses[color]}">
      <span class="text-lg sm:text-xl">{icon}</span>
    </div>
  </div>

  {#if change}
    <div class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span class="flex items-center font-medium {trendColors[trend]}">
        {#if trend === 'up'}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="mr-1 h-3 w-3">
             <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        {:else if trend === 'down'}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="mr-1 h-3 w-3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        {/if}
        {change}
      </span>
      <span class="text-slate-500">{$tr("admin.sinceLastMonth")}</span>
    </div>
  {/if}
</div>
