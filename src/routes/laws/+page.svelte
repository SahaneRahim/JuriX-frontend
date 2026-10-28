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
  import { nomCategorie } from "$lib/categories";
  import { formatDate } from "$lib/format";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import { classesBadgeDeType, typeDeTexte } from "$lib/type-de-texte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { urlCanonique } from "$lib/seo";

  /** Rempli par `+page.server.ts`, qui lit filtres et pagination dans l'URL. */
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

  /**
   * Numéros de la pagination (pages comptées depuis 0, affichées depuis 1).
   *
   * Même dessin que la recherche (guide, § 4.7) : flèches, numéros, page
   * courante inversée et `aria-current`. La liste n'avait que « Précédent |
   * Page 1 | Suivant », sans aucun numéro où sauter. L'API ne rend pas de
   * total (`hasMore` vient d'une ligne de plus demandée) : on montre deux
   * pages avant la courante au plus, puis la suivante quand elle existe. Au
   * plus six boutons de 44 px, qui tiennent dans un écran de 320 px.
   */
  function numerosDePage(courante: number, suite: boolean): number[] {
    const numeros: number[] = [];
    for (let n = Math.max(0, courante - 2); n <= courante; n++) numeros.push(n);
    if (suite) numeros.push(courante + 1);
    return numeros;
  }

  $: numeros = numerosDePage(page, hasMore);

  /**
   * Élément de la ligne de méta d'une carte (cote • date • articles).
   *
   * Le « • » est dessiné AVANT chaque élément, centré dans l'écart de 16 px
   * qui le sépare du précédent, et la ligne est décalée de cet écart vers la
   * gauche (`-ml-4`) dans un cadre qui coupe ce qui dépasse
   * (`overflow-hidden`) : en début de ligne, le point tombe hors du cadre.
   * Écrits en <span> à part, les points restaient seuls en bout ou en début
   * de ligne sur téléphone (« PRC-6803 • 10 décembre 2018 • », puis
   * « 4 articles » dessous).
   */
  const ELEMENT_SEPARE =
    "relative ml-4 before:absolute before:-left-4 before:w-4 before:text-center before:text-zinc-400 before:content-['•'] dark:before:text-zinc-600";

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

<!-- `px-zone-sure` : marges de l'encoche d'un iPhone en paysage
     (`viewport-fit=cover`) ; 0 partout ailleurs. -->
<main id="contenu" class="px-zone-sure">
<!-- Colonne commune aux pages de la section (Documents, catégorie, Recherche,
     Comparer) : marges de l'en-tête (16, 24 puis 48 px : le titre s'aligne
     sur le logo jusqu'à 1 248 px de large), puis 1 152 px au plus, centrés.
     En max-w-5xl, le titre commençait à 232 px en 1 440, 160 sur /compare et
     112 sur /search : le contenu sautait de côté d'une page à l'autre. -->
<div class="max-w-[78rem] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
  <!-- Titre de page du guide (§ 4.2), le même sur toutes les pages : il
       restait en 30 px ici quand la catégorie et la fiche montaient à 36. -->
  <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white mb-2">
    {$tr("laws.title")}
  </h1>
  <p class="text-zinc-500 dark:text-zinc-400 mb-6">{$tr("laws.subtitle")}</p>

  <!--
    Filtres empilés sur téléphone. Un <select> sans largeur prend celle de sa
    plus longue option : « Droit des personnes, de la famille et état civil »
    le portait à environ 380 px, plus large que l'écran, et toute la page
    glissait de côté. Pleine largeur sur téléphone ; au-delà, des largeurs
    bornées par la ligne (voir plus bas).
    `text-base` (16 px) : en dessous, iOS zoome sur le champ touché.
    `pl-4 pr-10` et non `px-4`, qui écrasait la marge droite du chevron que
    pose @tailwindcss/forms : le texte passait sous la flèche.

    Hauteur des champs du site : 44 px à partir de sm (`min-h-11`), 46 en
    dessous, où le texte passe à 16 px. C'est celle des champs de /compare
    et de la page d'une catégorie ; la même recette (guide, § 4.5) donnait
    38 px ici (`sm:py-2`), 44 sur /compare et 46 sur la catégorie. Le bouton
    suit les listes, sans son ancien `sm:min-h-0` : à 36 px, il flottait au
    milieu d'une ligne de champs de 44.

    De sm à md, les deux listes se partagent la première ligne et le bouton
    prend toute la seconde (`sm:basis-full`) ; à partir de md, tout tient sur
    une ligne, la liste des catégories prenant la place libre (320 px au
    plus) et le bouton calé à droite. Les trois côte à côte demandent 694 px
    en français : entre 640 et 768 px (740×360), le bouton tombait seul sur
    une deuxième ligne, poussé à droite, à côté d'un grand vide.
  -->
  <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center md:flex-nowrap gap-3 mb-6">
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
      class="min-h-11 w-full min-w-0 truncate rounded-xl border border-zinc-200 bg-white py-2.5 pl-4 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:w-auto sm:flex-1 sm:text-sm md:flex-none"
    >
      <option value="all">{$tr("laws.allLanguages")}</option>
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>

    <select
      value={categoryId}
      aria-label={$tr("a11y.filterCategory")}
      on:change={(e) => changeFilters({ category: e.currentTarget.value })}
      class="min-h-11 w-full min-w-0 truncate rounded-xl border border-zinc-200 bg-white py-2.5 pl-4 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:w-auto sm:flex-1 sm:text-sm md:max-w-xs"
    >
      <option value="all">{$tr("laws.allCategories")}</option>
      {#each categories as category (category.id)}
        <option value={String(category.id)}>{nomCategorie(category.name, $langueInterface.current)}</option>
      {/each}
    </select>

    <a
      href="/search"
      class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-950 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-4 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-colors shadow-sm dark:shadow-none sm:basis-full md:ml-auto md:w-auto md:shrink-0 md:basis-auto"
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
    <!-- Le rouge dit l'erreur (texte red-700 : red-600 n'atteint que 4,4:1
         sur red-50) ; « Réessayer » n'est pas destructeur et reste neutre,
         comme sur l'accueil. -->
    <div
      role="alert"
      class="flex gap-3 p-6 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
    >
      <Icone nom="circle-alert" class="mt-0.5 text-xl" />
      <div class="min-w-0">
        <p class="mb-3">{error}</p>
        <button
          type="button"
          on:click={() => invalidateAll()}
          data-testid="laws-retry"
          class="min-h-11 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white text-sm font-medium transition-colors"
        >
          {$tr("common.retry")}
        </button>
      </div>
    </div>
  {:else if laws.length === 0}
    <div class="p-10 text-center text-zinc-500 dark:text-zinc-400">
      {$tr("laws.empty")}
    </div>
  {:else}
    <!-- `coupe-mots` sur le titre et la cote : une référence sans espace
         (« N°2018/9387/CAB/PM ») élargissait la carte au-delà de l'écran. -->
    <div class="grid gap-3 sm:gap-4" data-hors-du-bouton>
      {#each laws as law (law.id)}
        {@const type = typeDeTexte(law.type, law.title)}
        <a
          href="/laws/{law.id}"
          class="group block bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 hover:border-zinc-950 dark:hover:border-zinc-400 motion-safe:hover:-translate-y-0.5 active:bg-zinc-50 dark:active:bg-zinc-800/60 transition-all"
        >
          <!-- Sous sm, le badge du type passe AU-DESSUS du titre
               (`flex-col-reverse` : le titre reste premier pour les lecteurs
               d'écran) et lui rend toute la largeur. À droite du titre, il
               ne lui laissait que 250 px sur deux lignes : chaque carte
               s'arrêtait à « Décret N°2018/763 du 10 décembre 2018
               portant… », l'objet du texte toujours coupé. Trois lignes sur
               téléphone, deux à partir de sm, où la colonne est large. -->
          <div class="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
            <div class="w-full min-w-0 sm:w-auto">
              <!-- Le survol passe par la bordure de la carte, plus par le
                   titre : passé au jeton `primary` (zinc-900), il s'éteignait
                   en sombre, où il est blanc. -->
              <h2
                class="font-semibold text-zinc-950 dark:text-white line-clamp-3 sm:line-clamp-2 coupe-mots"
              >
                {law.title}
              </h2>
              <!-- Séparateurs « • » dessinés par `ELEMENT_SEPARE`. Méta du
                   guide (§ 4.2) : cote, date et nombre d'articles en chasse
                   fixe, 12 px, comme les dates et cotes de /search, de
                   /compare et du blog. En sans-serif de 14 px, la même cote
                   changeait de dessin d'une page à l'autre. -->
              <div class="mt-2 overflow-hidden font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                <div class="-ml-4 flex flex-wrap items-center gap-y-1">
                  <span class="{ELEMENT_SEPARE} min-w-0 coupe-mots">{law.reference}</span>
                  {#if law.publication_date}
                    <span class={ELEMENT_SEPARE}>{formatDate(law.publication_date, $langueInterface.current)}</span>
                  {/if}
                  {#if law.article_count}
                    <span class={ELEMENT_SEPARE}>{law.article_count} {$tr("laws.articles")}</span>
                  {/if}
                </div>
              </div>
            </div>
            <!-- Le type traduit, avec son icône, comme sur la fiche du texte
                 et sur /search ($lib/type-de-texte) : c'était la valeur brute
                 de l'API, en minuscules (« décret », « arrêté »), même dans
                 l'interface anglaise. -->
            <span class={classesBadgeDeType(type)}>
              <Icone nom={type.icone} class="text-sm" />
              {$tr(type.cle)}
            </span>
          </div>
        </a>
      {/each}
    </div>

    <!-- Pagination, au dessin de celle de la recherche (guide, § 4.7) :
         carrés de 44 px à toutes les tailles, comme sur la recherche (ils
         passaient à 40 dès sm, sur un téléphone en paysage ou une tablette
         tactiles), page courante inversée et
         `aria-current`, flèches nommées par aria-label. Voir
         `numerosDePage`. Survol en `enabled:` : un bouton désactivé
         (première ou dernière page) ne doit pas réagir comme s'il menait
         quelque part. Absente quand tout tient sur une page, comme sur la
         recherche. -->
    {#if page > 0 || hasMore}
    <nav class="flex flex-wrap items-center justify-center gap-1 sm:gap-2 mt-8" aria-label={$tr("a11y.pagination")} data-hors-du-bouton>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={page === 0}
        on:click={() => allerPage(page - 1)}
        aria-label={$tr("laws.previous")}
      >
        <Icone nom="chevron-left" class="text-2xl" />
      </button>
      {#each numeros as n (n)}
        <button
          type="button"
          aria-current={n === page ? "page" : undefined}
          on:click={() => {
            if (n !== page) allerPage(n);
          }}
          class="flex h-11 min-w-11 items-center justify-center rounded-xl px-2 font-medium tabular-nums transition-colors {n ===
          page
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm dark:shadow-none'
            : 'border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white'}"
          >{n + 1}</button
        >
      {/each}
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!hasMore}
        on:click={() => allerPage(page + 1)}
        aria-label={$tr("laws.next")}
      >
        <Icone nom="chevron-right" class="text-2xl" />
      </button>
    </nav>
    {/if}
  {/if}
</div>

</main>

<!-- Le bouton de l'assistant, comme sur la recherche et l'accueil : il
     manquait ici, et l'accès au chat changeait d'une page à l'autre de la
     section. Il se retire quand la liste passe dessous (`eviter`), et le
     pied de page lui réserve sa place en fin de défilement. -->
<ChatFab eviter="[data-hors-du-bouton]" />
<SiteFooter reserverBouton />
