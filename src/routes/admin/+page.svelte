<script lang="ts">
  import { apiFetch } from '$lib/api';
  import StatsCard from "$lib/components/admin/StatsCard.svelte";
  import { onMount } from "svelte";
  import { formatDate } from "$lib/format";
  import { language, tr } from "$lib/stores/language";
  import type { AnalyticsOverview, AnalyticsSearch, AnalyticsUsage, Law } from '$lib/types';

let overview: AnalyticsOverview = { total_laws: 0, by_language: {}, recent_laws: 0 };
  let usage: AnalyticsUsage = {
    window_days: 7, conversations: 0, questions_asked: 0, answers_generated: 0,
    searches: 0, active_users: 0, median_answer_time_ms: 0,
  };
  let searchStats: AnalyticsSearch = {
    window_days: 7, total_searches: 0, median_response_time_ms: 0,
    p95_response_time_ms: 0, max_response_time_ms: 0, cache_hit_rate_percent: 0,
  };

  /**
   * Derniers documents ingeres, dans leur PROPRE variable.
   *
   * Ils venaient d'une quatrieme requete puis etaient greffes sur `overview`
   * sous le nom `latest_laws` — un champ que `/analytics/overview` ne renvoie
   * pas et n'a jamais renvoye. Melanger une reponse du serveur et une donnee
   * composee par le client dans le meme objet rendait impossible de dire, en
   * lisant la page, d'ou venait quoi.
   */
  let dernieresLois: Law[] = [];
  let loading = true;
  let erreur = "";

  /**
   * Chargement du tableau de bord.
   *
   * Deux defauts corriges ici :
   *
   * 1. `loading` etait declare et remis a false, mais JAMAIS lu dans le
   *    balisage, et le catch ne faisait qu'un console.error. Backend eteint, la
   *    page affichait « 0 documents, 0 recherches, 0 utilisateurs » comme des
   *    chiffres reels. Un operateur ne pouvait pas distinguer une base vide
   *    d'un serveur injoignable.
   * 2. Les quatre appels passaient par `fetch()` nu : aucun en-tete
   *    Authorization, et surtout aucune gestion du 401. Un jeton expire
   *    laissait donc l'ecran affiche et vide, sans que la garde du layout se
   *    declenche — elle depend de `authStore.logout()`, que seul `apiFetch`
   *    appelle.
   *
   * La quatrieme requete etait aussi en cascade derriere la premiere alors
   * qu'elle n'a besoin de rien : elle rejoint le lot parallele.
   */
  async function loadStats() {
    loading = true;
    erreur = "";
    try {
      const [overviewRes, usageRes, searchRes, lawsRes] = await Promise.all([
        apiFetch("/analytics/overview"),
        apiFetch("/analytics/usage"),
        apiFetch("/analytics/search"),
        apiFetch("/laws/?limit=4"),
      ]);

      if (!overviewRes.ok && !usageRes.ok && !searchRes.ok) {
        erreur = $tr("admin.statsError");
        return;
      }

      if (overviewRes.ok) overview = await overviewRes.json();
      if (usageRes.ok) usage = await usageRes.json();
      if (searchRes.ok) searchStats = await searchRes.json();
      if (lawsRes.ok) dernieresLois = await lawsRes.json();
    } catch (e) {
      console.error("Error fetching admin stats:", e);
      erreur = $tr("admin.statsError");
    } finally {
      loading = false;
    }
  }

  onMount(loadStats);
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
      class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-50 disabled:opacity-60"
      on:click={loadStats}
      disabled={loading}
      data-testid="admin-refresh"
    >
      {$tr("admin.refresh")}
    </button>
  </div>
</div>

{#if loading}
  <p class="py-20 text-center text-slate-500" data-testid="admin-loading">
    {$tr("common.loading")}
  </p>
{:else if erreur}
  <!-- Sans cette branche, un backend injoignable affichait « 0 documents,
       0 recherches, 0 utilisateurs » comme des faits mesures. -->
  <div
    role="alert"
    data-testid="admin-error"
    class="rounded-xl border border-red-200 bg-red-50 p-8 text-center"
  >
    <p class="mb-4 font-medium text-red-700">{erreur}</p>
    <button
      on:click={loadStats}
      data-testid="admin-retry"
      class="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
      >{$tr("common.retry")}</button
    >
  </div>
{:else}
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
      trend="neutral"
      icon="🔍"
      color="purple"
    />
    <StatsCard
      title={$tr("admin.activeUsers")}
      value={usage.active_users?.toString() || "0"}
      trend="neutral"
      icon="👥"
      color="green"
    />
    <StatsCard
      title={$tr("admin.responseTime")}
      value={`${searchStats.median_response_time_ms || 0}ms`}
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
        <!-- La fenêtre d'observation est affichée plutôt que choisie : le
             backend accepte désormais `?days=`, mais un sélecteur suppose des
             données sur plusieurs semaines. Il sera utile quand il y en aura. -->
        <span class="text-sm text-slate-500"
          >{$tr("admin.lastDays").replace("{n}", String(searchStats.window_days ?? 7))}</span
        >
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
                  {count} {$tr("admin.requests")}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div
            class="flex h-full items-center justify-center text-slate-500 text-sm"
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
        {#if dernieresLois.length > 0}
          {#each dernieresLois as law}
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
                  {formatDate(law.created_at, $language.current)}
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
{/if}
