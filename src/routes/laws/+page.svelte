<script lang="ts">
  /**
   * Liste des documents du corpus.
   *
   * Cette page n'existait pas : hors /search et /admin/documents, rien ne
   * permettait de parcourir le corpus. Le lien "Explorer" de la navigation
   * pointait /categories, qui n'existe pas non plus — il repondait 404.
   *
   * P11 A : une liste à filets, une ligne par texte (repères, puis objet en
   * clair), du plus récent au plus ancien, par lots de 20 (« Afficher 20 de
   * plus », un lien vers `?page=N`, qui marche aussi sans JavaScript). La
   * pagination numérotée est partie : ses boutons n'existaient qu'avec
   * JavaScript, et sans total elle ne pouvait dire où la liste finissait.
   */
  import { goto } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  // Alias : la page a deja une variable locale `language`, qui est le FILTRE de
  // langue des documents. Le store, lui, porte la langue de l'INTERFACE. Deux
  // notions distinctes que le meme nom rendait confuses.
  import { language as langueInterface, tr } from "$lib/stores/language";
  import { nomCategorie } from "$lib/categories";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import ListeDeTextes from "$lib/components/listes/ListeDeTextes.svelte";
  import { adresseDuLot, type EtatDeLaListe } from "$lib/components/listes/lots";
  import { urlCanonique } from "$lib/seo";
  import type { Snapshot } from "@sveltejs/kit";

  /** Rempli par `+page.server.ts`, qui lit filtres et lot dans l'URL. */
  export let data;

  /**
   * Les lots affichés et la position de défilement, gardés dans l'historique :
   * au retour d'un texte, la liste revient entière, à la ligne quittée, et non
   * réduite au lot de l'adresse (ListeDeTextes, `capturer`).
   */
  let liste: ListeDeTextes | undefined;
  export const snapshot: Snapshot<EtatDeLaListe | null> = {
    capture: () => liste?.capturer() ?? null,
    restore: (etat) => liste?.restaurer(etat),
  };

  // Tout est derive de `data` de facon REACTIVE : SvelteKit reutilise ce
  // composant d'une navigation a l'autre, y compris quand seule la requete
  // change.
  $: categories = data.categories;
  // Valeurs affichees par les `<select>`. Purement derivees : c'est la
  // navigation qui change l'URL, donc `data`, donc elles.
  $: language = data.lang;
  $: categoryId = data.category;

  /**
   * Les filtres de l'adresse, sans les valeurs par défaut : `/laws` doit
   * rester `/laws`, et non `/laws?lang=all&category=all&page=1`. Une URL
   * propre est aussi ce que la canonique indexe, et une seule version en cache
   * (ISR) par liste.
   */
  function filtresDe(lang: string, categorie: string): Record<string, string> {
    return { ...(lang !== "all" ? { lang } : {}), ...(categorie !== "all" ? { category: categorie } : {}) };
  }

  $: filtres = filtresDe(data.lang, data.category);

  /**
   * Un filtre changé, avec JavaScript : la liste repart du premier lot.
   * `keepFocus` garde le curseur dans le `<select>` qu'on vient d'utiliser —
   * sans lui, chaque changement de filtre renvoie le focus au debut de la page,
   * ce qui rend le filtrage au clavier impraticable. `noScroll` evite le saut en
   * haut de page. Sans JavaScript, le formulaire part par son bouton.
   */
  function changerFiltre(champs: { lang?: string; category?: string }) {
    const suivants = filtresDe(champs.lang ?? data.lang, champs.category ?? data.category);
    goto(adresseDuLot("/laws", suivants, 1), { keepFocus: true, noScroll: true });
  }

  // Une vue filtree ou un lot suivant est du contenu quasi duplique pour un
  // moteur : seule la liste nue entre dans l'index. La canonique pointe deja
  // `/laws`, `noindex` evite en plus de gaspiller le budget d'exploration. Les
  // liens « Afficher 20 de plus » restent suivis (`follow`) : chaque texte du
  // corpus est atteint.
  $: indexable = language === "all" && categoryId === "all" && data.page === 1;
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
     sur le logo jusqu'à 1 248 px de large), puis 1 152 px au plus, centrés. -->
<div class="max-w-[78rem] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 court:py-3">
  <!-- Titre de page en Literata (Q5 A : la serif des titres de page), 600,
       interlettrage nul (jamais tracking-tight sur la serif), équilibré sur
       ses lignes. 24 px sur écran court : à 36 px, en 740×360, le titre et
       son sous-titre prenaient 110 px et la première ligne de la liste
       commençait sous le pli (/compare et la page d'un domaine passaient
       déjà à 24 px). -->
  <h1
    class="text-3xl sm:text-4xl court:text-2xl font-titre font-semibold leading-[1.2] text-balance text-zinc-950 dark:text-white mb-2 court:mb-1"
  >
    {$tr("laws.title")}
  </h1>
  <p class="text-zinc-500 dark:text-zinc-400 mb-6 court:mb-3">{$tr("laws.subtitle")}</p>

  <!--
    Filtres : un formulaire GET vers cette même page (P8). Avec JavaScript,
    chaque liste déroulante navigue dès qu'elle change (`changerFiltre`) ;
    sans lui, le bouton « Filtrer » (dans un <noscript> : il n'existe que si le
    JavaScript est coupé, et ne bouge donc rien à l'hydratation) envoie le
    formulaire, et le serveur rend la liste filtrée.

    Filtres empilés sur téléphone. Un <select> sans largeur prend celle de sa
    plus longue option : « Droit des personnes, de la famille et état civil »
    le portait à environ 380 px, plus large que l'écran, et toute la page
    glissait de côté. Pleine largeur sur téléphone ; au-delà, des largeurs
    bornées par la ligne (voir plus bas).
    `text-base` (16 px) : en dessous, iOS zoome sur le champ touché.
    `pl-4 pr-10` et non `px-4`, qui écrasait la marge droite du chevron que
    pose @tailwindcss/forms : le texte passait sous la flèche.

    Hauteur des champs du site : 44 px à partir de sm (`min-h-11`), 46 en
    dessous, où le texte passe à 16 px.

    De sm à md, les deux listes se partagent la première ligne et le bouton
    prend toute la seconde (`sm:basis-full`) ; à partir de md, tout tient sur
    une ligne, la liste des catégories prenant la place libre (320 px au
    plus) et le bouton calé à droite. Les trois côte à côte demandent 694 px
    en français : entre 640 et 768 px (740×360), le bouton tombait seul sur
    une deuxième ligne, poussé à droite, à côté d'un grand vide.
  -->
  <form
    method="get"
    action="/laws"
    class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center md:flex-nowrap gap-3 mb-6 court:mb-3"
  >
    <!--
      `value=` et non `bind:value=` : la valeur du filtre vit dans l'URL, et une
      liaison bidirectionnelle sur une valeur derivee est un aller sans retour.
      `name` : ce que le formulaire envoie sans JavaScript.
    -->
    <select
      name="lang"
      value={language}
      aria-label={$tr("a11y.filterLanguage")}
      on:change={(e) => changerFiltre({ lang: e.currentTarget.value })}
      class="min-h-11 w-full min-w-0 truncate rounded-xl border border-zinc-200 bg-white py-2.5 pl-4 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:w-auto sm:flex-1 sm:text-sm md:flex-none"
    >
      <option value="all">{$tr("laws.allLanguages")}</option>
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>

    <!-- « Domaine », comme l'accueil (« Parcourir par domaine »), la colonne
         de /search et son état vide : « catégorie » ne restait qu'ici
         (`a11y.filterCategory` garde le mot de l'administration). -->
    <select
      name="category"
      value={categoryId}
      aria-label={$tr("a11y.filterDomain")}
      on:change={(e) => changerFiltre({ category: e.currentTarget.value })}
      class="min-h-11 w-full min-w-0 truncate rounded-xl border border-zinc-200 bg-white py-2.5 pl-4 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:w-auto sm:flex-1 sm:text-sm md:max-w-xs"
    >
      <option value="all">{$tr("laws.allCategories")}</option>
      {#each categories as category (category.id)}
        <option value={String(category.id)}>{nomCategorie(category.name, $langueInterface.current)}</option>
      {/each}
    </select>

    <noscript>
      <button
        type="submit"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:w-auto"
      >
        {$tr("listes.filtrer")}
      </button>
    </noscript>

    <!-- « Rechercher un texte » dans les deux langues (`laws.searchForText`).
         L'ancienne clé disait « Search instead » en anglais : « plutôt
         chercher », qui ne se comprenait qu'à côté des filtres et ne
         traduisait pas le français. -->
    <a
      href="/search"
      class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-950 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-4 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-colors shadow-sm dark:shadow-none sm:basis-full md:ml-auto md:w-auto md:shrink-0 md:basis-auto"
    >
      {$tr("laws.searchForText")}
    </a>
  </form>

  <!-- Les lignes et leurs lots (P11). Une panne de l'API ne passe plus par
       ici : le `load` lève un 503, et la page d'erreur du site offre
       « Réessayer ». -->
  <ListeDeTextes
    bind:this={liste}
    lignes={data.lignes}
    page={data.page}
    parPage={data.parPage}
    total={data.total}
    suivante={data.suivante}
    tri={data.tri}
    chemin="/laws"
    {filtres}
    vide={$tr("laws.empty")}
  />
</div>

</main>

<!-- Le bouton de l'assistant, comme sur la recherche et l'accueil. Il se
     retire quand la liste passe dessous (`eviter`), et le pied de page lui
     réserve sa place en fin de défilement. -->
<ChatFab eviter="[data-hors-du-bouton]" />
<SiteFooter reserverBouton />
