<script lang="ts">
  /**
   * Liste des documents du corpus.
   *
   * Cette page n'existait pas : hors /search et /admin/documents, rien ne
   * permettait de parcourir le corpus. Le lien "Explorer" de la navigation
   * pointait /categories, qui n'existe pas non plus — il repondait 404.
   */
  import { goto, invalidateAll } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  // Alias : la page a deja une variable locale `language`, qui est le FILTRE de
  // langue des documents. Le store, lui, porte la langue de l'INTERFACE. Deux
  // notions distinctes que le meme nom rendait confuses.
  import { language as langueInterface, tr } from "$lib/stores/language";
  import { formatDate } from "$lib/format";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { urlCanonique } from "$lib/seo";

  /** Rempli par `+page.ts`, qui lit filtres et pagination dans l'URL. */
  export let data;

  // Tout est derive de `data` de facon REACTIVE. Une simple affectation
  // laisserait la liste precedente a l'ecran : SvelteKit reutilise ce composant
  // d'une navigation a l'autre, y compris quand seule la requete change.
  $: laws = data.laws;
  $: categories = data.categories;
  $: hasMore = data.hasMore;
  $: page = data.page;
  $: error = data.erreur ? $tr(data.erreur) : "";

  // Valeurs affichees par les `<select>`. Purement derivees : rien ne leur est
  // jamais affecte, c'est la navigation qui change l'URL, donc `data`, donc
  // elles.
  $: language = data.lang;
  $: categoryId = data.category;

  /**
   * Filtres et pagination portes par l'URL.
   *
   * `keepFocus` garde le curseur dans le `<select>` qu'on vient d'utiliser —
   * sans lui, chaque changement de filtre renvoie le focus au debut de la page,
   * ce qui rend le filtrage au clavier impraticable. `noScroll` evite le saut en
   * haut de page a chaque changement de page.
   */
  function naviguer(champs: Record<string, string>) {
    const params = new URLSearchParams($pageStore.url.searchParams);
    for (const [cle, valeur] of Object.entries(champs)) {
      // Les valeurs par defaut ne sont pas ecrites : `/laws` doit rester
      // `/laws`, et non `/laws?lang=all&category=all&page=0`. Une URL propre est
      // aussi ce que la canonique indexe.
      if (valeur === "all" || valeur === "0") params.delete(cle);
      else params.set(cle, valeur);
    }
    const requete = params.toString();
    goto(requete ? `?${requete}` : "?", { keepFocus: true, noScroll: true });
  }

  // Changer un filtre ramene a la premiere page : rester en page 4 apres avoir
  // restreint la liste a trois resultats afficherait une page vide.
  const changeFilters = (champs: Record<string, string>) =>
    naviguer({ ...champs, page: "0" });
  const allerPage = (n: number) => naviguer({ page: String(n) });

  // Une vue filtree ou paginee est du contenu quasi duplique pour un moteur :
  // seule la liste nue entre dans l'index. La canonique pointe deja `/laws` dans
  // les deux cas, `noindex` evite en plus de gaspiller le budget d'exploration.
  $: indexable = language === "all" && categoryId === "all" && page === 0;
</script>

<MetaSeo
  titre={$tr("laws.title")}
  description={$tr("laws.subtitle")}
  canonique={urlCanonique($pageStore.url)}
  {indexable}
/>

<SiteHeader />

<main id="contenu">
<div class="max-w-5xl mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">
    {$tr("laws.title")}
  </h1>
  <p class="text-slate-500 mb-6">{$tr("laws.subtitle")}</p>

  <!-- Filtres -->
  <div class="flex flex-wrap gap-3 mb-6">
    <!--
      `value=` et non `bind:value=` : la valeur du filtre vit dans l'URL, et une
      liaison bidirectionnelle sur une valeur derivee est un aller sans retour —
      le `<select>` ecrirait dans une variable que le prochain `load` ecrase,
      d'ou deux sources de verite pour un seul etat.
    -->
    <select
      value={language}
      aria-label={$tr("a11y.filterLanguage")}
      on:change={(e) => changeFilters({ lang: e.currentTarget.value })}
      class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
    >
      <option value="all">{$tr("laws.allLanguages")}</option>
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>

    <select
      value={categoryId}
      aria-label={$tr("a11y.filterCategory")}
      on:change={(e) => changeFilters({ category: e.currentTarget.value })}
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

  <!--
    Les squelettes de chargement ont disparu avec le `onMount` : la page n'est
    plus rendue avant que ses donnees soient la. Les garder aurait laisse une
    branche que rien ne peut plus atteindre.
  -->
  {#if error}
    <div
      role="alert"
      class="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
    >
      <p class="mb-3">{error}</p>
      <button
        type="button"
        on:click={() => invalidateAll()}
        data-testid="laws-retry"
        class="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
      >
        {$tr("common.retry")}
      </button>
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
                  <span>•</span><span>{formatDate(law.publication_date, $langueInterface.current)}</span>
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
        on:click={() => allerPage(page - 1)}
      >
        {$tr("laws.previous")}
      </button>
      <span class="text-sm text-slate-500">{$tr("laws.page")} {page + 1}</span>
      <button
        class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40"
        disabled={!hasMore}
        on:click={() => allerPage(page + 1)}
      >
        {$tr("laws.next")}
      </button>
    </div>
  {/if}
</div>

</main>

<SiteFooter />
