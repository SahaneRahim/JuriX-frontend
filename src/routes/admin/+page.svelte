<script lang="ts">
  import { API_URL, API_BASE_URL } from '$lib/api';
  import StatsCard from "$lib/components/admin/StatsCard.svelte";
  import { onMount } from "svelte";
  import { tr } from "$lib/stores/language";

let overview: any = { total_laws: 0, by_language: {}, recent_laws: 0 };
  let usage: any = { active_users: 0, total_calls: 0 };
  let searchStats: any = { total_searches: 0, avg_response_time_ms: 0 };
  let loading = true;

  onMount(async () => {
    try {
      const [overviewRes, usageRes, searchRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/overview`),
        fetch(`${API_BASE_URL}/analytics/usage`),
        fetch(`${API_BASE_URL}/analytics/search`),
      ]);

      if (overviewRes.ok) {
        overview = await overviewRes.json();
        // Fallback for latest_laws if API doesn't provide it directly in overview yet
        if (!overview.latest_laws) {
          const lawsRes = await fetch(`${API_BASE_URL}/laws?limit=4`);
          if (lawsRes.ok) {
            overview.latest_laws = await lawsRes.json();
          } else {
            overview.latest_laws = [];
          }
        }
      }
      if (usageRes.ok) usage = await usageRes.json();
      if (searchRes.ok) searchStats = await searchRes.json();
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="mb-8 flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold text-slate-900">{$tr("admin.dashboard")}</h1>
    <p class="mt-1 text-slate-500">{$tr("admin.dashboardDesc")}</p>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-sm font-medium text-slate-500"
      >{$tr("admin.lastUpdate")}: {new Date().toLocaleTimeString()}</span
    >
    <button
      class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50"
      on:click={() => window.location.reload()}
    >
      {$tr("admin.refresh")}
    </button>
  </div>
</div>

<!-- Stats Grid -->
<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
  <StatsCard
    title={$tr("admin.totalDocs")}
    value={overview.total_laws?.toString() || "0"}
    change={`+${overview.recent_laws || 0}`}
    trend="up"
    icon="📄"
    color="blue"
  />
  <StatsCard
    title={$tr("admin.totalSearches")}
    value={searchStats.total_searches?.toString() || "0"}
    change="+12%"
    trend="up"
    icon="🔍"
    color="purple"
  />
  <StatsCard
    title={$tr("admin.activeUsers")}
    value={usage.active_users?.toString() || "0"}
    change="+5.4%"
    trend="up"
    icon="👥"
    color="green"
  />
  <StatsCard
    title={$tr("admin.responseTime")}
    value={`${searchStats.avg_response_time_ms || 0}ms`}
    trend="neutral"
    icon="⚡"
    color="orange"
  />
</div>

<!-- Charts & Activity -->
<div class="grid gap-6 lg:grid-cols-3">
  <!-- Search Activity Chart -->
  <div
    class="col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
  >
    <div class="mb-6 flex items-center justify-between">
      <h3 class="font-bold text-slate-900">{$tr("admin.searchActivity")}</h3>
      <select
        class="rounded-lg border-slate-200 py-1 text-xs font-medium text-slate-600"
      >
        <option>{$tr("admin.last7days")}</option>
        <option>{$tr("admin.last30days")}</option>
      </select>
    </div>

    <!-- Placeholder Chart -->
    <div class="relative h-64 w-full">
      {#if searchStats.modes_usage}
        <div class="flex h-full items-end justify-between px-4">
          {#each Object.entries(searchStats.modes_usage) as [mode, count], i}
            <div
              class="group relative flex flex-col items-center gap-2"
              style="width: 30%"
            >
              <div
                class="w-full rounded-t-lg bg-blue-500 opacity-80 hover:opacity-100 transition-all"
                style="height: {Math.max(
                  (Number(count) / searchStats.total_searches) * 100,
                  5,
                )}%"
              ></div>
              <span class="text-xs font-medium capitalize text-slate-600"
                >{mode}</span
              >
              <div
                class="absolute -top-8 hidden rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block"
              >
                {count} reqs
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="flex h-full items-center justify-center text-slate-400 text-sm"
        >
          {$tr("admin.noActivityData")}
        </div>
      {/if}
    </div>
  </div>

  <!-- Recent Uploads -->
  <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h3 class="mb-4 font-bold text-slate-900">{$tr("admin.latestDocs")}</h3>
    <div class="space-y-4">
      {#if overview.latest_laws && overview.latest_laws.length > 0}
        {#each overview.latest_laws as law}
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
            >
              📄
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-slate-900">
                {law.title}
              </p>
              <p class="text-xs text-slate-500">
                {new Date(law.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        {/each}
      {:else}
        <div class="text-center py-6 text-slate-500 text-sm">
          {$tr("admin.noRecentDocs")}
        </div>
      {/if}
    </div>
    <a
      href="/admin/documents"
      class="mt-6 block w-full text-center rounded-lg py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {$tr("admin.viewAll")}
    </a>
  </div>
</div>
