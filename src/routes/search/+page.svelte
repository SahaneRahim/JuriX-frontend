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
  import ChatFab from '$lib/components/ChatFab.svelte';
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import { onMount, tick } from "svelte";
  import { tr, language } from "$lib/stores/language";
  import { nomCategorie } from "$lib/categories";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import type { SearchResponse, Category, SearchResult } from '$lib/types';

// State
  // Lus depuis l'URL des l'initialisation, au serveur comme dans le navigateur :
  // le HTML servi porte deja la requete et son titre, et ne montre des
  // squelettes que s'il y a une recherche a faire. Initialises a vide, le
  // champ arrivait vide et desactive (isLoading), puis basculait a
  // l'hydratation.
  let searchQuery = $page.url.searchParams.get("q") ?? "";
  let activeTab = "all";
  let isLoading = searchQuery.trim() !== "";
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

  /**
   * Filtres repliés sous `lg`.
   *
   * Dépliés d'office, avec trois dates et quatorze catégories, ils occupaient
   * environ 650 px AU-DESSUS des résultats : un écran de téléphone entier
   * avant le premier résultat. À partir de `lg`, la colonne latérale les
   * montre toujours, et cet état n'y change plus rien.
   */
  let filtresOuverts = false;

  // Ce qu'annonce le bouton « Filtres (N) » : ce qui est réglé DANS le
  // panneau. Les onglets et le tri restent visibles, ils ne comptent pas.
  $: nombreFiltresActifs =
    selectedCategoryIds.length + (dateRange !== "all" ? 1 : 0);

  /** Début de la colonne des résultats, où ramène un changement de page. */
  let resultatsEl: HTMLElement | undefined;

  function allerAuxResultats() {
    // Passé en JavaScript, `behavior: "smooth"` ignore la préférence
    // « réduire les animations » : elle est donc lue ici.
    const sansAnimation = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    resultatsEl?.scrollIntoView?.({
      block: "start",
      behavior: sansAnimation ? "auto" : "smooth",
    });
  }

  /** Referme le panneau (sous lg) et ramène au premier résultat. */
  async function voirLesResultats() {
    filtresOuverts = false;
    await tick();
    allerAuxResultats();
  }

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

  async function goToPage(n: number) {
    if (n < 1 || n > totalPages || n === currentPage) return;
    currentPage = n;
    performSearch();
    // Au début des RÉSULTATS, et non en haut de la page : sous lg, le haut de
    // la page, ce sont le titre, la barre de recherche et les filtres, qu'il
    // fallait redescendre à chaque page. `tick` d'abord, pour viser la page
    // déjà passée aux squelettes de chargement, à sa hauteur d'arrivée.
    await tick();
    allerAuxResultats();
  }

  /**
   * Fenêtre de pagination : au plus 5 numéros centrés sur la page courante.
   * Les numéros étaient codés en dur (« 1 2 3 ») et sans `on:click`.
   *
   * Sous sm, seuls les 3 numéros de `pagesTelephone` restent affichés : sept
   * boutons de 40 px débordaient d'un écran de 320 px. Les deux autres sont
   * masqués en CSS plutôt que retirés par une requête média en JavaScript :
   * pas d'écouteur à tenir, et l'affichage est juste dès la première image.
   * Masquer suffit, car la fenêtre de 3 est toujours incluse dans celle de 5
   * (même page courante, mêmes bornes 1 et totalPages).
   */
  $: visiblePages = pagesVisibles(currentPage, totalPages);
  $: pagesTelephone = pagesVisibles(currentPage, totalPages, 3);

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
          // Hybride (mots + sens), comme le chat. En « text », la page ne
          // trouvait la bonne loi dans son top 10 que pour 26,5 % des 102
          // questions du jeu d'evaluation, et rien du tout pour 26 d'entre
          // elles ; l'hybride, 82,4 % et aucune page vide
          // (scripts/eval/evaluer_recherche.py, cote backend).
          mode: "hybrid",
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
        const data: SearchResponse = await response.json();

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

<!-- min-h-app (100dvh, repli 100vh, dans app.css) et non `min-h-screen
     min-h-dvh` : Tailwind range ces deux classes par ordre alphabétique, si bien
     que min-h-screen passait APRÈS et que la valeur en dvh n'était jamais
     appliquée. -->
<div
  class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body min-h-app flex flex-col transition-colors duration-300"
>
  <SiteHeader />

  <!-- Main Content -->
  <main id="contenu" class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 sm:pt-8 w-full">
    <!-- Search Header -->
    <div class="mb-6 sm:mb-10">
      <!-- coupe-mots : la requête est recopiée telle quelle dans le titre, et
           une suite sans espace (référence, URL collée) débordait de l'écran. -->
      <h1 class="text-2xl sm:text-3xl font-bold coupe-mots text-slate-900 dark:text-white mb-4 sm:mb-6">
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
      <!-- Sous sm, la bande défile jusqu'aux bords de l'écran (-mx-4 px-4) :
           coupée par la marge de la page, elle cachait le dernier onglet sans
           rien qui invite à la faire glisser. L'aimantation (snap) arrête le
           geste au début d'un onglet, scroll-px-4 tient compte de la marge. -->
      <div class="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 mt-4 sm:mx-0 sm:mt-6 sm:scroll-px-0 sm:gap-3 sm:px-0">
        {#each tabFilters as tab}
          <button
            class="flex min-h-11 shrink-0 snap-start items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all {activeTab ===
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
    <div class="flex flex-col lg:flex-row gap-4 lg:gap-8">
      <!-- Sidebar Filters -->
      <aside class="w-full lg:w-64 flex-shrink-0">
        <!-- Bouton de repli, sous lg seulement. L'aria-label ne fait que
             compléter le libellé visible par le nombre de filtres actifs, que
             la pastille ne montre qu'en chiffre. -->
        <button
          type="button"
          on:click={() => (filtresOuverts = !filtresOuverts)}
          aria-expanded={filtresOuverts}
          aria-controls="filtres-recherche"
          aria-label={nombreFiltresActifs > 0
            ? `${$tr("search.filters")} (${nombreFiltresActifs})`
            : undefined}
          data-testid="search-filters-toggle"
          class="lg:hidden inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-card-dark px-4 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-soft hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span class="material-icons text-lg" aria-hidden="true">tune</span>
          {$tr("search.filters")}
          {#if nombreFiltresActifs > 0}
            <span
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
              >{nombreFiltresActifs}</span
            >
          {/if}
          <span
            class="material-icons text-lg transition-transform motion-reduce:transition-none {filtresOuverts
              ? 'rotate-180'
              : ''}"
            aria-hidden="true">expand_more</span
          >
        </button>

        <!-- Un seul panneau pour toutes les tailles : replié ou non sous lg,
             toujours affiché à partir de lg. Collant sur grand écran, il est
             borné à la hauteur de la fenêtre : avec quatorze catégories, le
             bas sortait de l'écran tant qu'on n'avait pas atteint la fin de
             la liste. Lignes de 44 px sous lg, compactées ensuite. -->
        <div
          id="filtres-recherche"
          class="{filtresOuverts
            ? 'mt-3 block'
            : 'hidden'} lg:mt-0 lg:block bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5 sm:p-6 shadow-soft lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain"
        >
          <div class="flex items-center justify-between mb-2 lg:mb-4">
            <h3 class="font-bold text-slate-900 dark:text-white">
              {$tr("search.filters")}
            </h3>
            <button
              on:click={resetFilters}
              data-testid="search-reset"
              class="-mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm lg:min-h-0 lg:py-1 lg:text-xs text-primary font-medium hover:underline"
              >{$tr("search.reset")}</button
            >
          </div>

          <!-- Date Filter -->
          <div class="mb-4 lg:mb-6">
            <h4
              class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 lg:mb-3"
            >
              {$tr("search.datePublication")}
            </h4>
            <div class="grid sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-1 lg:gap-y-2">
              {#each [{ v: "all", label: $tr("search.allTime") }, { v: "year", label: $tr("search.thisYear") }, { v: "5y", label: $tr("search.last5Years") }] as { v, label }}
                <label class="flex min-h-11 items-center gap-3 lg:min-h-0 lg:gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="date"
                    value={v}
                    bind:group={dateRange}
                    on:change={() => { currentPage = 1; performSearch(); }}
                    class="form-radio text-primary border-slate-300 focus:ring-primary h-5 w-5 shrink-0 lg:h-4 lg:w-4"
                  />
                  <span
                    class="min-w-0 text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    >{label}</span
                  >
                </label>
              {/each}
            </div>
          </div>

          <!-- Category Filter -->
          <!-- Deux colonnes de sm à lg : le panneau y prend toute la largeur. -->
          <div class="mb-6">
            <h4
              class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 lg:mb-3"
            >
              {$tr("search.category")}
            </h4>
            <div class="grid sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-1 lg:gap-y-2">
              {#each categories as category (category.id)}
                <label class="flex min-h-11 items-center gap-3 lg:min-h-0 lg:gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    on:change={() => toggleCategory(category.id)}
                    class="form-checkbox text-primary rounded border-slate-300 focus:ring-primary h-5 w-5 shrink-0 lg:h-4 lg:w-4"
                  />
                  <span
                    class="min-w-0 text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    >{nomCategorie(category.name, $language.current)}</span
                  >
                </label>
              {:else}
                <p class="text-xs text-slate-500">{$tr("common.loading")}</p>
              {/each}
            </div>
          </div>

          <!-- Sous lg, le panneau déplié s'intercale AU-DESSUS des résultats :
               chaque case relance la recherche, mais le résultat arrive hors de
               la vue. Ce bouton referme le panneau et y ramène, sans remonter
               jusqu'au bouton « Filtres ». -->
          <button
            type="button"
            on:click={voirLesResultats}
            data-testid="search-filters-done"
            class="lg:hidden flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            {$tr("search.showResults")}
          </button>
        </div>
      </aside>

      <!-- Results -->
      <!-- min-w-0 : élément flex, la colonne ne descendait pas sous la largeur
           de son contenu, et une carte au titre insécable l'élargissait
           au-delà de l'écran. scroll-mt-4 : de l'air au-dessus quand
           allerAuxResultats y amène. -->
      <div bind:this={resultatsEl} class="min-w-0 flex-1 space-y-4 scroll-mt-4">
        <!-- Results Meta -->
        <!-- Empilée sous sm : à côté du tri, la ligne d'état passait sur deux
             ou trois lignes. -->
        <div
          class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm text-secondary-text-light dark:text-secondary-text-dark pb-2"
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
            <!-- text-base sous sm : sous 16 px, iOS zoome la page au focus et
                 ne la dézoome pas ensuite. -->
            <select
              bind:value={sortBy}
          aria-label={$tr("a11y.sortBy")}
              data-testid="search-sort"
              class="bg-transparent border-none text-slate-900 dark:text-white font-medium focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded cursor-pointer pr-8 min-h-11 sm:min-h-0 text-base sm:text-sm"
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
                class="bg-white dark:bg-card-dark p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft animate-pulse"
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
            class="bg-white dark:bg-card-dark p-8 sm:p-12 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft text-center"
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
            class="bg-white dark:bg-card-dark p-8 sm:p-12 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-soft text-center"
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
              class="mt-4 min-h-11 px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >{$tr("common.retry")}</button
            >
          </div>

          <!-- No Results -->
        {:else if filteredResults.length === 0}
          <div
            class="bg-white dark:bg-card-dark p-8 sm:p-12 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft text-center"
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

          <!-- Pagination : les numeros etaient codes en dur et sans on:click.
               Boutons de 44 px sous sm, et trois numeros seulement (voir
               pagesTelephone) : la rangee tient dans 288 px. -->
          {#if totalPages > 1}
            <nav
              class="flex flex-wrap justify-center items-center gap-1 sm:gap-2 mt-8 pt-4"
              aria-label={$tr("pagination.page")}
            >
              <button
                on:click={() => goToPage(currentPage - 1)}
                data-testid="search-page-prev"
                aria-label={$tr("pagination.prev")}
                class="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                disabled={currentPage === 1}
              >
                <span class="material-icons" aria-hidden="true">chevron_left</span>
              </button>

              {#each visiblePages as n (n)}
                <button
                  on:click={() => goToPage(n)}
                  data-testid="search-page-{n}"
                  aria-current={n === currentPage ? "page" : undefined}
                  class="{pagesTelephone.includes(n)
                    ? 'flex'
                    : 'hidden sm:flex'} h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-xl font-medium transition-colors {n ===
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
                class="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
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

  <!-- Bouton flottant de l'assistant, commun avec l'accueil : la copie locale
       (56 px, bottom-6 right-6) divergeait de celle de (main)/+layout.svelte,
       et aucune des deux ne tenait compte de la barre d'accueil de l'iPhone.
       La place qu'il occupe en fin de défilement est réservée dans le pied de
       page (reserverBouton), toujours rendu sous les résultats : la dernière
       carte et la pagination remontent au-dessus du bouton sans qu'une marge
       vide de plus soit ajoutée à <main>. -->
  <ChatFab />
  <SiteFooter reserverBouton />
</div>

<style>
  /* Smooth transitions for sliding pill */
  .sliding-pill {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
