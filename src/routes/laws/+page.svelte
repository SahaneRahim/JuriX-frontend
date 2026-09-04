<script lang="ts">
  /**
   * Liste des documents du corpus.
   *
   * Cette page n'existait pas : hors /search et /admin/documents, rien ne
   * permettait de parcourir le corpus. Le lien "Explorer" de la navigation
   * pointait /categories, qui n'existe pas non plus — il repondait 404.
   */
  import { onMount } from "svelte";
  import { API_URL } from "$lib/api";
  import { tr } from "$lib/stores/language";

  const PAGE_SIZE = 20;

  let laws: any[] = [];
  let categories: any[] = [];
  let isLoading = true;
  let error = "";

  let page = 0;
  let hasMore = false;
  let language = "all";
  let categoryId = "all";

  async function loadCategories() {
    try {
      const response = await fetch(`${API_URL}/categories`);
      if (response.ok) categories = await response.json();
    } catch {
      // Les filtres de categorie sont un confort : leur absence ne doit pas
      // empecher la liste de s'afficher.
      categories = [];
    }
  }

  async function loadLaws() {
    isLoading = true;
    error = "";
    try {
      // limit + 1 : une ligne de plus que la page permet de savoir s'il existe
      // une suite, sans second appel de comptage.
      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE + 1),
      });
      if (language !== "all") params.set("language", language);
      if (categoryId !== "all") params.set("category_id", categoryId);

      const response = await fetch(`${API_URL}/laws/?${params}`);
      if (!response.ok) throw new Error("Backend indisponible");

      const data = await response.json();
      hasMore = data.length > PAGE_SIZE;
      laws = hasMore ? data.slice(0, PAGE_SIZE) : data;
    } catch (e) {
      error = $tr("laws.errorLoad");
      laws = [];
    } finally {
      isLoading = false;
    }
  }

  function changeFilters() {
    page = 0;
    loadLaws();
  }

  function formatDate(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  onMount(() => {
    loadCategories();
    loadLaws();
  });
</script>

<svelte:head><title>JuriX — {$tr("laws.title")}</title></svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">
    {$tr("laws.title")}
  </h1>
  <p class="text-slate-500 mb-6">{$tr("laws.subtitle")}</p>

  <!-- Filtres -->
  <div class="flex flex-wrap gap-3 mb-6">
    <select
      bind:value={language}
      on:change={changeFilters}
      class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
    >
      <option value="all">{$tr("laws.allLanguages")}</option>
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>

    <select
      bind:value={categoryId}
      on:change={changeFilters}
      class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
    >
      <option value="all">{$tr("laws.allCategories")}</option>
      {#each categories as category}
        <option value={String(category.id)}>{category.name}</option>
      {/each}
    </select>

    <a
      href="/search"
      class="ml-auto px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
    >
      {$tr("laws.searchInstead")}
    </a>
  </div>

  {#if isLoading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
      {error}
    </div>
  {:else if laws.length === 0}
    <div class="p-10 text-center text-slate-500">
      {$tr("laws.empty")}
    </div>
  {:else}
    <div class="grid gap-4">
      {#each laws as law}
        <a
          href="/laws/{law.id}"
          class="group block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2
                class="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2"
              >
                {law.title}
              </h2>
              <div class="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                <span>{law.reference}</span>
                {#if law.publication_date}
                  <span>•</span><span>{formatDate(law.publication_date)}</span>
                {/if}
                {#if law.article_count}
                  <span>•</span><span>{law.article_count} {$tr("laws.articles")}</span>
                {/if}
              </div>
            </div>
            <span
              class="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              {law.type}
            </span>
          </div>
        </a>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-center gap-3 mt-8">
      <button
        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40"
        disabled={page === 0}
        on:click={() => {
          page -= 1;
          loadLaws();
        }}
      >
        {$tr("laws.previous")}
      </button>
      <span class="text-sm text-slate-500">{$tr("laws.page")} {page + 1}</span>
      <button
        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40"
        disabled={!hasMore}
        on:click={() => {
          page += 1;
          loadLaws();
        }}
      >
        {$tr("laws.next")}
      </button>
    </div>
  {/if}
</div>
