<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { API_URL } from "$lib/api";
  import { tr } from "$lib/stores/language";
  import { fade, fly } from "svelte/transition";

  let searchQuery = "";

  function handleSearch() {
    if (searchQuery.trim()) {
      goto(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }

  // Les categories viennent de la BASE, plus d'une liste ecrite en dur.
  //
  // L'ancienne liste melangeait des domaines juridiques (Droit Fiscal) et des
  // types de texte (Lois, Decrets, Arretes). Un decret fiscal n'avait donc
  // aucune case correcte, et le slug « lois » ne correspondant a aucune ligne
  // de la table, la page de categorie basculait sur une recherche plein texte
  // du mot « loi » — qui remonte tous les decrets. C'est exactement le
  // symptome constate : des decrets affiches dans « Lois ».
  type ApiCategory = {
    id: number;
    name: string;
    description: string | null;
    icon: string | null;
    law_count: number;
  };

  let categories: ApiCategory[] = [];
  let categoriesError = "";
  let categoriesLoading = true;

  // Palette appliquee par position d'affichage. Les couleurs sont decoratives :
  // les rattacher au nom obligerait a modifier le front a chaque domaine ajoute.
  const PALETTE = [
    "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    "text-slate-600 bg-slate-50 dark:bg-slate-500/10",
    "text-sky-600 bg-sky-50 dark:bg-sky-500/10",
    "text-blue-800 bg-blue-50 dark:bg-blue-900/10",
    "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    "text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10",
    "text-orange-600 bg-orange-50 dark:bg-orange-500/10",
    "text-purple-600 bg-purple-50 dark:bg-purple-500/10",
    "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
    "text-pink-600 bg-pink-50 dark:bg-pink-500/10",
    "text-teal-600 bg-teal-50 dark:bg-teal-500/10",
    "text-red-600 bg-red-50 dark:bg-red-500/10",
    "text-lime-600 bg-lime-50 dark:bg-lime-500/10",
    "text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10",
  ];

  onMount(async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      categories = await response.json();
    } catch (e) {
      console.error("Chargement des categories impossible", e);
      categoriesError = $tr("categories.errorLoad");
    } finally {
      categoriesLoading = false;
    }
  });
</script>

<svelte:head>
  <title>JuriX - {$tr("title.home")}</title>
</svelte:head>

<div
  class="w-full max-w-7xl flex flex-col items-center pb-20"
  in:fade={{ duration: 300, delay: 150 }}
>
  <!-- Search Bar -->
  <div class="w-full max-w-3xl relative group z-20 mb-16">
    <div
      class="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-300"
    ></div>
    <div
      class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center p-2 border border-slate-100 dark:border-slate-700/50"
    >
      <div class="pl-4 text-slate-400">
        <span class="material-icons text-2xl">search</span>
      </div>
      <input
        type="text"
        bind:value={searchQuery}
        on:keydown={handleKeydown}
        placeholder={$tr("search.placeholder")}
        class="w-full bg-transparent border-none text-lg text-slate-800 dark:text-white placeholder-slate-400 focus:ring-0 px-4 py-3"
        autofocus
      />
      <button
        on:click={handleSearch}
        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95"
      >
        {$tr("search.button")}
      </button>
    </div>
  </div>

  <!-- Section Title -->
  <div class="text-center mb-10 w-full">
    <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
      {$tr("categories.title")}
    </h2>
    <p class="text-slate-500 dark:text-slate-400">
      {$tr("categories.subtitle")}
    </p>
  </div>

  {#if categoriesLoading}
    <p class="text-slate-500 dark:text-slate-400">{$tr("common.loading")}</p>
  {:else if categoriesError}
    <p class="text-red-600 dark:text-red-400">{categoriesError}</p>
  {/if}

  <!-- Categories Grid -->
  <div
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full px-4"
  >
    {#each categories as cat, i}
      <!--
        Les categories vides restent affichees mais attenuees. Les masquer
        ferait apparaitre et disparaitre des cases au fil des ingestions : le
        plan de la page changerait a chaque visite, et un utilisateur cherchant
        « Droit Pénal » conclurait que la plateforme ne le couvre pas.
      -->
      <a
        href="/categories/{cat.id}"
        class="group relative flex flex-col p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 {cat.law_count ===
        0
          ? 'opacity-55'
          : ''}"
      >
        <div class="mb-3 flex items-center justify-between">
          <div
            class="w-10 h-10 rounded-xl {PALETTE[i % PALETTE.length]} flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300"
          >
            {cat.icon || "📄"}
          </div>
          <span
            class="text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums"
          >
            {cat.law_count}
            {$tr("categories.documentsShort")}
          </span>
        </div>

        <div>
          <h3
            class="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          >
            {cat.name}
          </h3>
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2"
          >
            {cat.description || ""}
          </p>
        </div>
      </a>
    {/each}
  </div>
</div>
