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
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import type { NomIcone } from "$lib/icones";
  import { BADGE_DE_TYPE_EMPHASE, BADGE_DE_TYPE_NEUTRE, typeDeTexte } from "$lib/type-de-texte";
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
  /** Panneau des filtres : déplié sous lg, il passe aussi sous le bouton flottant. */
  let filtresEl: HTMLElement | undefined;

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

  /**
   * Le bouton flottant de l'assistant et les résultats.
   *
   * Fixé en bas à droite, il se posait sur les cartes : la fin de « Lire le
   * texte complet » du premier résultat dès le premier écran en 1024×768, le
   * texte de la deuxième carte en 768×1024, le bord droit de la première en
   * 390×844.
   *
   * Il se retire donc tant qu'un résultat, ou le panneau des filtres déplié,
   * passe dessous, et revient dès qu'on remonte la page, le geste de qui
   * cherche autre chose, ou quand la liste est finie : le pied de page lui
   * réserve sa place. Ainsi sous 1 440 px, à toutes les hauteurs. Au-delà, la
   * colonne de la page s'arrête avant lui, et il reste affiché.
   *
   * La rangée des filtres et des résultats lui réservait une gouttière de
   * 80 px à droite, de 640 à 1 439 px : les cartes s'arrêtaient 32 px avant
   * la barre de recherche, en escalier, une bande vide de 80 à 105 px à leur
   * droite et la pagination centrée sur la colonne réduite. En paysage
   * (740×360), où le bouton se retirait de toute façon, la place était
   * perdue pour rien. Le panneau des filtres déplié (sous lg) compte aussi :
   * le bouton se posait sur ses cases (« Droit foncier… », 390×844).
   *
   * Retiré d'emblée au rendu serveur, comme sur l'accueil : affiché par
   * défaut, il aurait glissé hors de l'écran juste après l'hydratation sur un
   * téléphone. Ailleurs, il apparaît au montage. Un bouton qui a le focus ne
   * se retire pas (ChatFab).
   */
  const ECRAN_SANS_GOUTTIERE = "(max-width: 1439.98px), (max-height: 500px)";
  /**
   * Bande du bas, et du bord droit, où se pose le bouton : 56 à 64 px, sa
   * marge, la zone sûre de l'iPhone.
   */
  const BANDE_DU_BOUTON = 120;
  /** Défilement qui compte comme un geste : ni le rebond d'iOS ni un arrondi. */
  const SEUIL_DE_DEFILEMENT = 8;

  let boutonMasque = true;
  let ecranSansGouttiere: MediaQueryList | null = null;
  let dernierDefilement = 0;
  let remonte = false;
  let imagePrevue = 0;

  function majBoutonFlottant() {
    imagePrevue = 0;
    if (!ecranSansGouttiere?.matches) {
      boutonMasque = false;
      return;
    }
    const y = window.scrollY;
    if (Math.abs(y - dernierDefilement) >= SEUIL_DE_DEFILEMENT) {
      remonte = y < dernierDefilement;
      dernierDefilement = y;
    }
    const hauteur = window.innerHeight;
    const largeur = window.innerWidth;
    // Un panneau replié (`hidden`) a une boîte vide : il ne compte pas. Le
    // coin du bas à droite seulement : à partir de lg, la colonne des
    // filtres, collante à GAUCHE, descend aussi dans la bande du bas, et
    // aurait retenu le bouton en fin de liste.
    const passeDessous = (element: HTMLElement | undefined) => {
      const zone = element?.getBoundingClientRect();
      return (
        !!zone &&
        zone.height > 0 &&
        zone.top < hauteur &&
        zone.bottom > hauteur - BANDE_DU_BOUTON &&
        zone.right > largeur - BANDE_DU_BOUTON
      );
    };
    boutonMasque = (passeDessous(resultatsEl) || passeDessous(filtresEl)) && !remonte;
  }

  /** Une mesure par image au plus : le défilement émet bien plus d'événements. */
  function planifierBoutonFlottant() {
    if (!imagePrevue) imagePrevue = requestAnimationFrame(majBoutonFlottant);
  }

  onMount(() => {
    ecranSansGouttiere = window.matchMedia?.(ECRAN_SANS_GOUTTIERE) ?? null;
    dernierDefilement = window.scrollY;
    majBoutonFlottant();
    window.addEventListener("scroll", planifierBoutonFlottant, { passive: true });
    window.addEventListener("resize", planifierBoutonFlottant);
    ecranSansGouttiere?.addEventListener?.("change", planifierBoutonFlottant);
    return () => {
      window.removeEventListener("scroll", planifierBoutonFlottant);
      window.removeEventListener("resize", planifierBoutonFlottant);
      ecranSansGouttiere?.removeEventListener?.("change", planifierBoutonFlottant);
      if (imagePrevue) cancelAnimationFrame(imagePrevue);
    };
  });

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

  /**
   * Un onglet de type de texte. Le type est déclaré pour `icon` : inféré, le
   * tableau donnerait `string`, et un nom absent du registre d'icônes
   * (src/lib/icones.ts) passerait la vérification pour finir en icône vide.
   *
   * Icônes : une pile de documents pour « tous », les mêmes que les badges
   * des cartes pour les lois (parchemin) et les décrets (acte signé), et le
   * « § » pour les articles : ce sont des articles DE LOI, que le journal
   * (newspaper), réservé au blog, aurait confondus avec ses billets.
   */
  type OngletRecherche = {
    id: string;
    icon: NomIcone;
    label: string;
    filter: string | null;
  };

  let tabFilters: OngletRecherche[] = [];
  $: tabFilters = [
    {
      id: "all",
      icon: "files",
      label: $tr("search.allTexts"),
      filter: null,
    },
    { id: "laws", icon: "scroll-text", label: $tr("search.laws"), filter: "loi" },
    {
      id: "decrees",
      icon: "file-pen-line",
      label: $tr("search.decrees"),
      filter: "decret",
    },
    {
      id: "articles",
      icon: "section",
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

  // Lois et décrets : le TYPE que donne l'API, celui du badge de la carte
  // (getBadgeInfo). Cherché dans le titre, « loi » retenait toute
  // « Ordonnance … de la loi de finances » et tout titre où paraît
  // « emploi », et « decret », sans accent, manquait « Décret N°… ».
  $: tabFiltered =
    activeTab === "all"
      ? results
      : results.filter((r) => {
          const tab = tabFilters.find((t) => t.id === activeTab);
          if (!tab?.filter) return true;
          if (tab.id === "laws") return r.type === "loi";
          if (tab.id === "decrees") return r.type === "décret";
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
  // Durée de la recherche dans la notation de la langue de l'interface :
  // « 0,31 » en français, « 0.31 » en anglais (`toFixed` écrivait toujours
  // un point).
  $: dureeAffichee = new Intl.NumberFormat($language.current, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(searchTimeMs / 1000);

  $: titleMatches = filteredResults.filter((r) => r.match_scope === "title");
  $: bodyMatches = filteredResults.filter((r) => r.match_scope !== "title");

  // Le bouton flottant (voir majBoutonFlottant) : la colonne des résultats
  // bouge sans que la page défile quand les résultats arrivent, qu'un onglet
  // raccourcit la liste ou que le panneau des filtres s'ouvre au-dessus
  // d'elle. Ces variables ne servent qu'à déclencher une nouvelle mesure.
  $: if (browser && ecranSansGouttiere) {
    void [isLoading, filteredResults, filtresOuverts];
    planifierBoutonFlottant();
  }

  /**
   * Le badge d'un résultat, d'après le TYPE que renvoie l'API (`result.type`),
   * lu à l'ingestion sur le premier mot du titre puis reclassé. Deviné ici sur
   * le titre entier, il se trompait : `includes("loi")` passait avant
   * « ordonnance ». Libellé, icône et emphase (la Constitution) viennent de
   * $lib/type-de-texte, la table commune à /laws, à la fiche d'un texte et à
   * la page d'une catégorie : le même type s'y affichait de trois façons.
   */
  function getBadgeInfo(result: SearchResult): {
    color: string;
    labelKey: string;
    icon: NomIcone;
  } {
    const type = typeDeTexte(result.type, result.title);
    return {
      color: `border ${type.emphase ? BADGE_DE_TYPE_EMPHASE : BADGE_DE_TYPE_NEUTRE}`,
      labelKey: type.cle,
      icon: type.icone,
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

  <!-- Main Content. Colonne commune aux pages de la section (Documents,
       catégorie, Recherche, Comparer) : marges de l'en-tête (16, 24 puis
       48 px : le titre s'aligne sur le logo jusqu'à 1 248 px de large), puis
       1 152 px de contenu au plus, centrés. Le titre commençait à 112 px en
       1 440 (max-w-7xl), contre 232 sur /laws et 160 sur /compare : le
       contenu sautait de côté d'une entrée du menu à l'autre. -->
  <main id="contenu" class="flex-grow w-full max-w-[78rem] mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-8 sm:pt-8 court:pt-2">
    <!-- Search Header.
         Écran court (`court:`, téléphone en paysage) : en 740×360, l'en-tête
         du site, le titre, la barre, les onglets, le bouton « Filtres » et la
         ligne d'état remplissaient l'écran, et le premier résultat commençait
         à 452 px. Marges resserrées (8 à 12 px au lieu de 16 à 40), titre pour
         les lecteurs d'écran seulement (la requête est dans le champ, juste
         dessous) et bouton « Filtres » à côté de la ligne d'état (voir la
         rangée, plus bas) : le premier résultat commence vers 250 px, son
         titre à l'écran. -->
    <div class="mb-6 sm:mb-10 court:mb-1">
      <!-- coupe-mots : la requête est recopiée telle quelle dans le titre, et
           une suite sans espace (référence, URL collée) débordait de l'écran.
           Titre de page du guide (§ 4.2) : 30 puis 36 px, comme « Documents »
           et la page d'une catégorie ; en 24 puis 30 px, le titre perdait
           6 px d'une entrée du menu à l'autre. Guillemets de la langue
           (« travail » en français, “work” en anglais), et non des
           guillemets droits. -->
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight coupe-mots text-zinc-950 dark:text-white mb-4 sm:mb-6 court:sr-only">
        {#if searchQuery}
          <!-- Remplacement par une fonction : une requête qui contiendrait
               « $& » ou « $1 » serait sinon lue comme un motif de `replace`. -->
          {$tr("search.resultsForQuery").replace("{q}", () => searchQuery)}
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
      <div class="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 mt-4 sm:mx-0 sm:mt-6 sm:scroll-px-0 sm:gap-3 sm:px-0 court:mt-2">
        <!-- La bordure est posée sur les deux états : portée par les seuls
             onglets inactifs, elle faisait perdre 2 px de large à l'onglet
             choisi, et la bande se décalait à chaque changement d'onglet. -->
        {#each tabFilters as tab}
          <button
            class="flex min-h-11 shrink-0 snap-start items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors {activeTab ===
            tab.id
              ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
              : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-400 dark:hover:text-white'}"
            on:click={() => (activeTab = tab.id)}
          >
            <Icone nom={tab.icon} class="text-lg" />
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Layout. Sans gouttière pour le bouton flottant : il se retire quand
         un résultat ou le panneau des filtres passe dessous
         (majBoutonFlottant). -->
    <!-- Écran court, de 480 px de large à lg : le bouton « Filtres » flotte à
         gauche, et la ligne d'état et le tri, boîte flexible donc rangée à
         côté d'un flottant, se placent à sa droite au lieu de passer
         dessous : une rangée de 44 px en moins. La rangée passe en `block`,
         un flottant n'ayant pas cours dans une boîte flexible ; ce qui suit
         la ligne d'état passe sous le bouton (`clear-left`). Panneau déplié,
         plus de flottant : il reprend toute la largeur au-dessus des
         résultats, comme ailleurs (12 px dessous, le `gap` ne jouant plus).
         Sous 480 px, la ligne d'état et le tri n'auraient plus la place à
         côté du bouton. -->
    <div class="flex flex-col lg:flex-row gap-4 lg:gap-8 court:min-[480px]:max-lg:block">
      <!-- Sidebar Filters -->
      <aside
        class="w-full lg:w-64 flex-shrink-0 {filtresOuverts
          ? 'court:min-[480px]:max-lg:mb-3'
          : 'court:min-[480px]:max-lg:float-left court:min-[480px]:max-lg:mr-3 court:min-[480px]:max-lg:w-auto'}"
      >
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
          class="lg:hidden inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200 shadow-sm dark:shadow-none hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white transition-colors"
        >
          <Icone nom="sliders-horizontal" class="text-lg" />
          {$tr("search.filters")}
          {#if nombreFiltresActifs > 0}
            <span
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-1.5 text-xs font-mono font-semibold tabular-nums"
              >{nombreFiltresActifs}</span
            >
          {/if}
          <Icone
            nom="chevron-down"
            class="text-lg transition-transform motion-reduce:transition-none {filtresOuverts
              ? 'rotate-180'
              : ''}"
          />
        </button>

        <!-- Un seul panneau pour toutes les tailles : replié ou non sous lg,
             toujours affiché à partir de lg. Collant sur grand écran, il est
             borné à la hauteur de la fenêtre : avec quatorze catégories, le
             bas sortait de l'écran tant qu'on n'avait pas atteint la fin de
             la liste. Lignes de 44 px, compactées à partir de lg sous un
             pointeur fin (souris, pavé) seulement : compactées à toute
             taille dès lg, les cases et boutons radio de 16 px l'étaient
             aussi sur une tablette de 1 024 px tenue en paysage. -->
        <div
          id="filtres-recherche"
          bind:this={filtresEl}
          class="{filtresOuverts
            ? 'mt-3 block'
            : 'hidden'} lg:mt-0 lg:block bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm dark:shadow-none lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain"
        >
          <div class="flex items-center justify-between mb-2 lg:mb-4">
            <h3 class="font-bold text-zinc-950 dark:text-white">
              {$tr("search.filters")}
            </h3>
            <!-- La recette des liens du guide (§ 4.3), soulignée au repos : en
                 12 px noir, soulignée au seul survol, l'action ne se lisait
                 pas comme telle. 44 px de haut sauf à partir de lg sous un
                 pointeur fin (voir les cases, plus bas). -->
            <button
              on:click={resetFilters}
              data-testid="search-reset"
              class="-mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white transition-colors lg:py-1 lg:[@media(pointer:fine)]:min-h-0"
              >{$tr("search.reset")}</button
            >
          </div>

          <!-- Date Filter -->
          <!-- Intertitres en zinc-400 en sombre : zinc-500 n'y fait que 3,7:1
               sur le panneau zinc-900. -->
          <div class="mb-4 lg:mb-6">
            <h4
              class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1 lg:mb-3"
            >
              {$tr("search.datePublication")}
            </h4>
            <div class="grid sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-1 lg:gap-y-2">
              {#each [{ v: "all", label: $tr("search.allTime") }, { v: "year", label: $tr("search.thisYear") }, { v: "5y", label: $tr("search.last5Years") }] as { v, label }}
                <label class="flex min-h-11 items-center gap-3 lg:gap-2 lg:[@media(pointer:fine)]:min-h-0 cursor-pointer group">
                  <!-- Ni `form-radio` (inerte depuis la stratégie `base` du
                       module des formulaires) ni couleur de bordure : app.css
                       trace le contour en zinc-500, visible sur blanc (4,8:1),
                       là où un zinc-300 effaçait presque un bouton vide. -->
                  <input
                    type="radio"
                    name="date"
                    value={v}
                    bind:group={dateRange}
                    on:change={() => { currentPage = 1; performSearch(); }}
                    class="text-zinc-900 dark:text-white focus:ring-zinc-950 dark:focus:ring-white h-5 w-5 shrink-0 lg:h-4 lg:w-4"
                  />
                  <span
                    class="min-w-0 text-sm text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors"
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
              class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1 lg:mb-3"
            >
              {$tr("search.category")}
            </h4>
            <div class="grid sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-1 lg:gap-y-2">
              {#each categories as category (category.id)}
                <label class="flex min-h-11 items-center gap-3 lg:gap-2 lg:[@media(pointer:fine)]:min-h-0 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    on:change={() => toggleCategory(category.id)}
                    class="rounded text-zinc-900 dark:text-white focus:ring-zinc-950 dark:focus:ring-white h-5 w-5 shrink-0 lg:h-4 lg:w-4"
                  />
                  <span
                    class="min-w-0 text-sm text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors"
                    >{nomCategorie(category.name, $language.current)}</span
                  >
                </label>
              {:else}
                <p class="text-xs text-zinc-500 dark:text-zinc-400">{$tr("common.loading")}</p>
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
            class="lg:hidden flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 text-sm font-semibold hover:bg-black dark:hover:bg-zinc-200 transition-colors shadow-sm dark:shadow-none"
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
      <div
        bind:this={resultatsEl}
        class="min-w-0 flex-1 space-y-4 scroll-mt-4 court:space-y-3 court:min-[480px]:max-lg:[&>*+*]:clear-left"
      >
        <!-- Results Meta -->
        <!-- Empilée sous sm : à côté du tri, la ligne d'état passait sur deux
             ou trois lignes. Sans marge basse sur écran court : les 16 px de
             `space-y-4` suffisent avant la première carte. -->
        <div
          class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm text-zinc-500 dark:text-zinc-400 pb-2 court:pb-0"
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
            <!-- red-600 et non red-500 : 3,6:1 seulement sur le fond de page,
                 sous le seuil AA que vérifie axe. -->
            <span class="text-red-600 dark:text-red-400">{errorMessage}</span>
          {:else}
            <!-- Durée dans la notation de la langue (« 0,31 s » en
                 français) : `toFixed` écrivait toujours « 0.31 ». Espace
                 insécable avant l'unité. -->
            <span
              >{$tr("search.aboutResults")}
              {totalResults}
              {$tr("search.resultsFound")} ({dureeAffichee}&nbsp;{$tr("search.seconds")})</span
            >
          {/if}
          </span>
          <div class="flex items-center gap-2">
            <span>{$tr("search.sortBy")}</span>
            <!-- text-base sous sm : sous 16 px, iOS zoome la page au focus et
                 ne la dézoome pas ensuite. 44 px de haut sauf à partir de lg
                 sous un pointeur fin : réduite dès sm, la liste n'avait plus
                 que la hauteur de son texte sur les écrans tactiles de 640 à
                 1 024 px. -->
            <select
              bind:value={sortBy}
          aria-label={$tr("a11y.sortBy")}
              data-testid="search-sort"
              class="bg-transparent border-none text-zinc-950 dark:text-white font-medium focus:ring-0 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-white focus-visible:rounded cursor-pointer pr-8 min-h-11 lg:[@media(pointer:fine)]:min-h-0 text-base sm:text-sm"
            >
              <option value="relevance">{$tr("search.relevance")}</option>
              <option value="date_desc">{$tr("search.recentDate")}</option>
              <option value="date_asc">{$tr("search.oldestDate")}</option>
            </select>
          </div>
        </div>

        <!-- Loading State -->
        <!-- Squelettes au gabarit de la carte de résultat (SearchResultCard :
             16 puis 20 px de marge, sans ombre), pour que la liste ne saute
             pas quand les résultats arrivent. -->
        {#if isLoading}
          <div class="space-y-4 court:space-y-3">
            {#each [1, 2, 3] as _}
              <div
                class="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 motion-safe:animate-pulse"
              >
                <div
                  class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-20 mb-3"
                ></div>
                <div
                  class="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-4"
                ></div>
                <div
                  class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full mb-2"
                ></div>
                <div
                  class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"
                ></div>
              </div>
            {/each}
          </div>

          <!-- Empty State -->
        {:else if !searchQuery}
          <div
            class="bg-white dark:bg-zinc-900 p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none text-center"
          >
            <Icone nom="search" class="text-6xl text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3
              class="text-xl font-semibold text-zinc-950 dark:text-white mb-2"
            >
              {$tr("search.startTitle")}
            </h3>
            <p class="text-zinc-600 dark:text-zinc-400">
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
            class="bg-white dark:bg-zinc-900 p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none text-center"
          >
            <Icone nom="cloud-off" class="text-6xl text-zinc-400 dark:text-zinc-500 mb-4" />
            <h3 class="text-xl font-semibold text-zinc-950 dark:text-white mb-2">
              {errorMessage}
            </h3>
            <button
              on:click={() => performSearch()}
              data-testid="search-retry"
              class="mt-4 min-h-11 px-6 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold rounded-xl hover:bg-black dark:hover:bg-zinc-200 transition-colors shadow-sm dark:shadow-none"
              >{$tr("common.retry")}</button
            >
          </div>

          <!-- No Results -->
        {:else if filteredResults.length === 0}
          <div
            class="bg-white dark:bg-zinc-900 p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none text-center"
          >
            <Icone nom="search-x" class="text-6xl text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3
              class="text-xl font-semibold text-zinc-950 dark:text-white mb-2"
            >
              {$tr("search.noResultsTitle")}
            </h3>
            <p class="text-zinc-600 dark:text-zinc-400">
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
          <!-- Intitulés des deux groupes à la recette du surtitre (guide,
               § 4.2 : mono, capitales, espacé), comme « Date de publication »
               et « Catégorie » dans les filtres ; « Mentions dans le texte »
               était en sans-serif semi-gras. Le premier groupe a le sien dès
               que les deux existent : sans lui, la coupure ne se comprenait
               qu'en arrivant au second. -->
          {#if titleMatches.length > 0 && bodyMatches.length > 0}
            <div class="flex items-center gap-3 pb-1">
              <span
                class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
              >
                {$tr("search.titleMatches")}
              </span>
              <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
            </div>
          {/if}
          {#each titleMatches as result}
            <SearchResultCard
              {result}
              badge={getBadgeInfo(result)}
              copied={copiedId === result.law_id}
              onCopy={copyResultLink}
            />
          {/each}

          {#if bodyMatches.length > 0}
            <div class="flex items-center gap-3 pt-4 pb-1">
              <span
                class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
              >
                {$tr("search.bodyMatches")}
              </span>
              <div class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
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
               Boutons de 44 px, et trois numeros seulement sous sm (voir
               pagesTelephone) : la rangee tient dans 288 px. 44 px à toute
               taille : réduits à 40 px dès sm, ils l'étaient aussi sur un
               téléphone en paysage et sur une tablette ; à cinq numéros, la
               rangée tient dans 356 px. -->
          {#if totalPages > 1}
            <nav
              class="flex flex-wrap justify-center items-center gap-1 sm:gap-2 mt-8 pt-4"
              aria-label={$tr("pagination.page")}
            >
              <button
                on:click={() => goToPage(currentPage - 1)}
                data-testid="search-page-prev"
                aria-label={$tr("pagination.prev")}
                class="h-11 w-11 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPage === 1}
              >
                <Icone nom="chevron-left" class="text-2xl" />
              </button>

              {#each visiblePages as n (n)}
                <button
                  on:click={() => goToPage(n)}
                  data-testid="search-page-{n}"
                  aria-current={n === currentPage ? "page" : undefined}
                  class="{pagesTelephone.includes(n)
                    ? 'flex'
                    : 'hidden sm:flex'} h-11 w-11 items-center justify-center rounded-xl font-medium transition-colors {n ===
                  currentPage
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm dark:shadow-none'
                    : 'border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white'}"
                  >{n}</button
                >
              {/each}

              <button
                on:click={() => goToPage(currentPage + 1)}
                data-testid="search-page-next"
                aria-label={$tr("pagination.next")}
                class="h-11 w-11 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages}
              >
                <Icone nom="chevron-right" class="text-2xl" />
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
       vide de plus soit ajoutée à <main>. Avant la fin, il cède la place aux
       résultats (boutonMasque, voir majBoutonFlottant). -->
  <ChatFab masque={boutonMasque} />
  <SiteFooter reserverBouton />
</div>

<style>
  /* Smooth transitions for sliding pill */
  .sliding-pill {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
