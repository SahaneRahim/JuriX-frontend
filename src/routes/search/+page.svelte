<script lang="ts">
  import { API_URL } from '$lib/api';
  
  import { nombreDePages, pagesVisibles, TAILLE_PAGE_RECHERCHE } from '$lib/pagination';
  import SearchBar from '$lib/components/SearchBar.svelte';
  // Cette page recopiait le header à la main (90 lignes) : la copie et
  // l'original avaient divergé — le lien mort vers /categories a dû être
  // corrigé deux fois, et le bouton flottant « assistant » pointait ici vers
  // l'accueil au lieu de /chat.
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { onMount } from "svelte";
  import { tr } from "$lib/stores/language";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import type { Category, SearchResult } from '$lib/types';

// State
  let searchQuery = "";
  let activeTab = "all";
  let isLoading = true;
  let results: SearchResult[] = [];
  let totalResults = 0;
  let searchTimeMs = 0;
  let currentPage = 1;
  let errorMessage = "";
  let sortBy = "relevance";

  /**
   * Filtres latéraux.
   *
   * Les radios et les cases n'avaient AUCUN `bind:` ni `on:change` : la colonne
   * de filtres était entièrement décorative, elle ne filtrait rien.
   *
   * Les catégories sont désormais chargées depuis l'API. Les six libellés
   * codés en dur étaient des chaînes traduites SANS identifiant : impossible
   * de les envoyer à `SearchFilters.category_ids`, qui attend des entiers.
   */
  const RESULTS_PER_PAGE = TAILLE_PAGE_RECHERCHE;

  let dateRange: "all" | "year" | "5y" = "all";
  let selectedCategoryIds: number[] = [];
  let categories: { id: number; name: string }[] = [];

  async function loadCategories() {
    try {
      const r = await fetch(`${API_URL}/categories`);
      if (r.ok) {
        const data = await r.json();
        categories = (Array.isArray(data) ? data : []).map(
          (c: Category) => ({ id: c.id, name: c.name }),
        );
      }
    } catch {
      // Les filtres restent vides : la recherche fonctionne sans eux.
    }
  }

  /** Traduit `dateRange` en bornes d'années comprises par l'API. */
  function yearBounds(): { year_from?: number } {
    const now = new Date().getFullYear();
    if (dateRange === "year") return { year_from: now };
    if (dateRange === "5y") return { year_from: now - 4 };
    return {};
  }

  function resetFilters() {
    dateRange = "all";
    selectedCategoryIds = [];
    activeTab = "all";
    sortBy = "relevance";
    currentPage = 1;
    performSearch();
  }

  function toggleCategory(id: number) {
    selectedCategoryIds = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((c) => c !== id)
      : [...selectedCategoryIds, id];
    currentPage = 1;
    performSearch();
  }

  $: totalPages = nombreDePages(totalResults, RESULTS_PER_PAGE);

  function goToPage(n: number) {
    if (n < 1 || n > totalPages || n === currentPage) return;
    currentPage = n;
    performSearch();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Fenêtre de pagination : au plus 5 numéros centrés sur la page courante.
   * Les numéros étaient codés en dur (« 1 2 3 ») et sans `on:click`.
   */
  $: visiblePages = pagesVisibles(currentPage, totalPages);

  $: tabFilters = [
    {
      id: "all",
      icon: "description",
      label: $tr("search.allTexts"),
      filter: null,
    },
    { id: "laws", icon: "gavel", label: $tr("search.laws"), filter: "loi" },
    {
      id: "decrees",
      icon: "assignment",
      label: $tr("search.decrees"),
      filter: "decret",
    },
    {
      id: "articles",
      icon: "article",
      label: $tr("search.articles"),
      filter: "article",
    },
  ];

  onMount(() => {
    loadCategories();
    const urlQuery = $page.url.searchParams.get("q");
    if (urlQuery) {
      searchQuery = urlQuery;
      performSearch();
    } else {
      isLoading = false;
    }
  });

  // Removed: reactive block was preventing user from editing input
  // The onMount above handles initial URL parameter loading

  async function performSearch() {
    if (!searchQuery.trim()) {
      results = [];
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMessage = "";

    try {
      const response = await fetch(`${API_URL}/search/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          mode: "text",
          limit: RESULTS_PER_PAGE,
          // `offset` existe depuis toujours dans SearchRequest : la pagination
          // affichée n'était simplement jamais envoyée.
          offset: (currentPage - 1) * RESULTS_PER_PAGE,
          filters: {
            status: "published",
            ...yearBounds(),
            ...(selectedCategoryIds.length
              ? { category_ids: selectedCategoryIds }
              : {}),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // « article 35 du code minier » : le backend a identifie le document ET
        // verifie que l'article y existe. Ces trois champs etaient calcules
        // depuis toujours et n'etaient lus nulle part.
        if (data.direct_navigation && data.target_law_id && data.target_article) {
          goto(
            `/laws/${data.target_law_id}?article=${encodeURIComponent(data.target_article)}`,
          );
          return;
        }

        results = data.results || [];
        totalResults = data.total || results.length;
        searchTimeMs = data.search_time_ms || 0;
      } else {
        errorMessage = $tr("search.errorSearch");
      }
    } catch (error) {
      console.error("Search error:", error);
      errorMessage = $tr("search.errorServer");
    } finally {
      results = errorMessage ? [] : results;
      isLoading = false;
    }
  }

  /**
   * Le bouton portait une icône de signet sans aucun gestionnaire, et aucune
   * notion de favori n'existe ni côté front ni côté API. Il copie désormais le
   * lien du document — même comportement que « Partager » sur /laws/[id].
   */
  let copiedId: number | null = null;

  async function copyResultLink(result: SearchResult) {
    const id = result.law_id;
    const url = `${window.location.origin}/laws/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      copiedId = id;
      setTimeout(() => (copiedId = null), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : on n'affiche rien.
    }
  }

  function handleSearchSubmit() {
    currentPage = 1;
    goto(`/search?q=${encodeURIComponent(searchQuery)}`, {
      replaceState: true,
    });
    performSearch();
  }

  // handleKeydown a ete retire : la gestion des touches vit dans SearchBar.

  $: tabFiltered =
    activeTab === "all"
      ? results
      : results.filter((r) => {
          const tab = tabFilters.find((t) => t.id === activeTab);
          if (!tab?.filter) return true;
          const title = (r.title || "").toLowerCase();
          const ref = (r.reference || "").toLowerCase();
          return title.includes(tab.filter) || ref.includes(tab.filter);
        });

  /**
   * Tri appliqué côté client.
   *
   * `sortBy` était lié au select mais lu NULLE PART : changer le tri ne
   * changeait rien à l'affichage. L'API n'expose aucun champ de tri
   * (`SearchRequest` = query, mode, filters, limit, offset), donc le tri se
   * fait ici, sur la page courante de résultats. `relevance` conserve l'ordre
   * rendu par l'API, qui EST le classement par pertinence.
   */
  $: filteredResults =
    sortBy === "relevance"
      ? tabFiltered
      : [...tabFiltered].sort((a, b) => {
          // `|| a.date` retire : le champ n'existe pas sur SearchResult.
          const da = new Date(a.publication_date || 0).getTime();
          const db = new Date(b.publication_date || 0).getTime();
          return sortBy === "date_desc" ? db - da : da - db;
        });

  /**
   * Deux sections : le mot cherché est dans le TITRE, ou seulement dans le texte.
   *
   * Le découpage est fait APRÈS le filtrage par onglet et le tri, pour que les
   * deux continuent de s'appliquer — le tri par date agit alors à l'intérieur
   * de chaque section au lieu de détruire la séparation.
   *
   * `match_scope` est calculé côté serveur sur le POIDS des lexèmes (poids A =
   * titre), pas deviné ici sur la chaîne : une recherche « société » doit
   * reconnaître « sociétés » dans un titre, ce qu'un `includes()` raterait.
   */
  $: titleMatches = filteredResults.filter((r) => r.match_scope === "title");
  $: bodyMatches = filteredResults.filter((r) => r.match_scope !== "title");

  function getBadgeInfo(result: SearchResult): {
    color: string;
    labelKey: string;
    icon: string;
  } {
    const title = (result.title || "").toLowerCase();
    const ref = (result.reference || "").toLowerCase();

    if (title.includes("loi") || ref.includes("loi")) {
      return {
        color:
          "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
        labelKey: "badge.law",
        icon: "gavel",
      };
    }
    if (
      title.includes("décret") ||
      ref.includes("décret") ||
      ref.includes("decret")
    ) {
      return {
        color:
          "bg-slate-100 dark:bg-card-dark text-slate-600 dark:text-slate-300",
        labelKey: "badge.decree",
        icon: "assignment",
      };
    }
    if (title.includes("constitution")) {
      return {
        color:
          "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        labelKey: "badge.constitution",
        icon: "account_balance",
      };
    }
    if (title.includes("ordonnance")) {
      return {
        color:
          "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
        labelKey: "badge.ordinance",
        icon: "description",
      };
    }
    return {
      color:
        "bg-slate-100 dark:bg-card-dark text-slate-600 dark:text-slate-300",
      labelKey: "badge.text",
      icon: "article",
    };
  }

</script>

<!-- Hors index : chaque requete produit une URL differente, donc une infinite
     de pages au contenu quasi identique. `follow` reste actif : la page doit
     continuer a transmettre l'autorite de ses liens vers les fiches. -->
<MetaSeo
  titre={$tr("title.search")}
  canonique={urlCanonique($page.url)}
  indexable={false}
/>

<svelte:head>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body min-h-screen flex flex-col transition-colors duration-300"
>
  <SiteHeader />

  <!-- Main Content -->
  <main id="contenu" class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
    <!-- Search Header -->
    <div class="mb-10">
      <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-6">
        {#if searchQuery}
          {$tr("search.resultsFor")} "{searchQuery}"
        {:else}
          {$tr("nav.search")}
        {/if}
      </h1>

      <!-- Search Bar -->
      <!-- SearchBar est le seul composant qui appelle /search/suggest : il
           porte l'anti-rebond de 300 ms, la liste deroulante et la navigation
           au clavier. Il n'etait importe NULLE PART, et cette page avait son
           propre champ de saisie sans suggestions — d'ou l'absence totale
           d'autocompletion a l'ecran, meme apres reparation de l'endpoint. -->
      <div class="max-w-3xl">
        <SearchBar
          size="large"
          bind:value={searchQuery}
          loading={isLoading}
          placeholder={$tr("search.searchLaw")}
          on:search={handleSearchSubmit}
          on:clear={() => {
            searchQuery = "";
            results = [];
          }}
        />
      </div>

      <!-- Tabs -->
      <div class="flex gap-3 mt-6 overflow-x-auto pb-2">
        {#each tabFilters as tab}
          <button
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all {activeTab ===
            tab.id
              ? 'bg-slate-100 dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
            on:click={() => (activeTab = tab.id)}
          >
            <span class="material-icons text-lg" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Layout -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- Sidebar Filters -->
      <aside class="w-full lg:w-64 flex-shrink-0">
        <div
          class="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-slate-700/50 p-6 sticky top-24 shadow-soft"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-slate-900 dark:text-white">
              {$tr("search.filters")}
            </h3>
            <button
              on:click={resetFilters}
              data-testid="search-reset"
              class="text-xs text-primary font-medium hover:underline"
              >{$tr("search.reset")}</button
            >
          </div>

          <!-- Date Filter -->
          <div class="mb-6">
            <h4
              class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3"
            >
              {$tr("search.datePublication")}
            </h4>
            <div class="space-y-2">
              {#each [{ v: "all", label: $tr("search.allTime") }, { v: "year", label: $tr("search.thisYear") }, { v: "5y", label: $tr("search.last5Years") }] as { v, label }}
                <label class="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="date"
                    value={v}
                    bind:group={dateRange}
                    on:change={() => { currentPage = 1; performSearch(); }}
                    class="form-radio text-primary border-slate-300 focus:ring-primary h-4 w-4"
                  />
                  <span
                    class="text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    >{label}</span
                  >
                </label>
              {/each}
            </div>
          </div>

          <!-- Category Filter -->
          <div class="mb-6">
            <h4
              class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3"
            >
              {$tr("search.category")}
            </h4>
            <div class="space-y-2">
              {#each categories as category (category.id)}
                <label class="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    on:change={() => toggleCategory(category.id)}
                    class="form-checkbox text-primary rounded border-slate-300 focus:ring-primary h-4 w-4"
                  />
                  <span
                    class="text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    >{category.name}</span
                  >
                </label>
              {:else}
                <p class="text-xs text-slate-500">{$tr("common.loading")}</p>
              {/each}
            </div>
          </div>

        </div>
      </aside>

      <!-- Results -->
      <div class="flex-grow space-y-4">
        <!-- Results Meta -->
        <div
          class="flex justify-between items-center text-sm text-secondary-text-light dark:text-secondary-text-dark pb-2"
        >
          <!--
            role="status" (donc aria-live="polite") : apres une recherche, un
            lecteur d'ecran n'apprenait NI que la requete etait partie, NI
            combien de resultats revenaient — la page changeait en silence.
            L'annonce est posee ici, sur la ligne de statut, et non sur la liste
            de resultats : annoncer les deux ferait entendre l'information deux
            fois.
          -->
          <span role="status" aria-live="polite" data-testid="search-status">
          {#if isLoading}
            <span>{$tr("search.searching")}</span>
          {:else if errorMessage}
            <span class="text-red-500">{errorMessage}</span>
          {:else}
            <span
              >{$tr("search.aboutResults")}
              {totalResults}
              {$tr("search.resultsFound")} ({(searchTimeMs / 1000).toFixed(2)}
              {$tr("search.seconds")})</span
            >
          {/if}
          </span>
          <div class="flex items-center gap-2">
            <span>{$tr("search.sortBy")}</span>
            <select
              bind:value={sortBy}
          aria-label={$tr("a11y.sortBy")}
              data-testid="search-sort"
              class="bg-transparent border-none text-slate-900 dark:text-white font-medium focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded cursor-pointer pr-8 text-sm"
            >
              <option value="relevance">{$tr("search.relevance")}</option>
              <option value="date_desc">{$tr("search.recentDate")}</option>
              <option value="date_asc">{$tr("search.oldestDate")}</option>
            </select>
          </div>
        </div>

        <!-- Loading State -->
        {#if isLoading}
          <div class="space-y-4">
            {#each [1, 2, 3] as _}
              <div
                class="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft animate-pulse"
              >
                <div
                  class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3"
                ></div>
                <div
                  class="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"
                ></div>
                <div
                  class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"
                ></div>
                <div
                  class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"
                ></div>
              </div>
            {/each}
          </div>

          <!-- Empty State -->
        {:else if !searchQuery}
          <div
            class="bg-white dark:bg-card-dark p-12 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft text-center"
          >
            <span
              class="material-icons text-6xl text-slate-300 dark:text-slate-600 mb-4"
               aria-hidden="true">search</span
            >
            <h3
              class="text-xl font-semibold text-slate-900 dark:text-white mb-2"
            >
              {$tr("search.startTitle")}
            </h3>
            <p class="text-secondary-text-light dark:text-secondary-text-dark">
              {$tr("search.startDesc")}
            </p>
          </div>

          <!-- Erreur : cette branche doit passer AVANT « aucun resultat ».
               Sans elle, une panne de serveur s'affichait en grand comme
               « Aucun resultat trouve / Essayez avec d'autres termes », et
               l'utilisateur reformulait sa requete pour un probleme reseau. -->
        {:else if errorMessage}
          <div
            role="alert"
            data-testid="search-error"
            class="bg-white dark:bg-card-dark p-12 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-soft text-center"
          >
            <span class="material-icons text-6xl text-red-300 mb-4"
               aria-hidden="true">cloud_off</span
            >
            <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {errorMessage}
            </h3>
            <button
              on:click={() => performSearch()}
              data-testid="search-retry"
              class="mt-4 px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >{$tr("common.retry")}</button
            >
          </div>

          <!-- No Results -->
        {:else if filteredResults.length === 0}
          <div
            class="bg-white dark:bg-card-dark p-12 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft text-center"
          >
            <span
              class="material-icons text-6xl text-slate-300 dark:text-slate-600 mb-4"
               aria-hidden="true">search_off</span
            >
            <h3
              class="text-xl font-semibold text-slate-900 dark:text-white mb-2"
            >
              {$tr("search.noResultsTitle")}
            </h3>
            <p class="text-secondary-text-light dark:text-secondary-text-dark">
              {$tr("search.noResultsDesc")}
            </p>
          </div>

          <!-- Results List -->
        {:else}
          <!--
            Deux sections. Les documents dont le TITRE correspond d'abord, ceux
            qui ne correspondent que par le texte ensuite, sous un intertitre
            qui le dit. Rien n'est masqué : c'est la lisibilité du classement
            qui change, pas son contenu.
          -->
          {#each titleMatches as result, index}
            <SearchResultCard
              {result}
              badge={getBadgeInfo(result)}
              highlight={index === 0}
              copied={copiedId === result.law_id}
              onCopy={copyResultLink}
            />
          {/each}

          {#if bodyMatches.length > 0}
            <div class="flex items-center gap-3 pt-4 pb-1">
              <span
                class="text-sm font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
              >
                {$tr("search.bodyMatches")}
              </span>
              <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
            </div>
            {#each bodyMatches as result}
              <SearchResultCard
                {result}
                badge={getBadgeInfo(result)}
                copied={copiedId === result.law_id}
                onCopy={copyResultLink}
              />
            {/each}
          {/if}

          <!-- Pagination : les numeros etaient codes en dur et sans on:click -->
          {#if totalPages > 1}
            <nav
              class="flex justify-center items-center gap-2 mt-8 pt-4"
              aria-label={$tr("pagination.page")}
            >
              <button
                on:click={() => goToPage(currentPage - 1)}
                data-testid="search-page-prev"
                aria-label={$tr("pagination.prev")}
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                disabled={currentPage === 1}
              >
                <span class="material-icons" aria-hidden="true">chevron_left</span>
              </button>

              {#each visiblePages as n (n)}
                <button
                  on:click={() => goToPage(n)}
                  data-testid="search-page-{n}"
                  aria-current={n === currentPage ? "page" : undefined}
                  class="w-10 h-10 flex items-center justify-center rounded-xl font-medium transition-colors {n ===
                  currentPage
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                  >{n}</button
                >
              {/each}

              <button
                on:click={() => goToPage(currentPage + 1)}
                data-testid="search-page-next"
                aria-label={$tr("pagination.next")}
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                disabled={currentPage === totalPages}
              >
                <span class="material-icons" aria-hidden="true">chevron_right</span>
              </button>
            </nav>
          {/if}
        {/if}
      </div>
    </div>
  </main>

  <!-- FAB -->
  <div class="fixed bottom-6 right-6 z-40">
    <!-- Pointait vers "/" : l'icône annonce l'assistant, la cible est /chat.
         Le FAB équivalent de (main)/+layout.svelte pointe bien vers /chat. -->
    <a
      href="/chat"
      aria-label={$tr("mode.chat")}
      class="w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
    >
      <span class="material-icons text-2xl" aria-hidden="true">smart_toy</span>
    </a>
  </div>
  <SiteFooter />
</div>

<style>
  :global(body) {
    font-family: "Inter", sans-serif;
  }

  /* Smooth transitions for sliding pill */
  .sliding-pill {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
