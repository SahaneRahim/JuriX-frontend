<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import { tr, language } from "$lib/stores/language";
  import { descriptionCategorie, nomCategorie } from "$lib/categories";
  import type { Category } from "$lib/types";

  /** Rempli par `+page.server.ts`. */
  export let data;

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
  // Le type était déclaré ici, en local, alors que trois autres pages lisent la
  // même forme. Il vit maintenant dans `$lib/types` avec le reste du modèle.
  //
  // Réactif et non simplement affecté : SvelteKit réutilise ce composant d'une
  // navigation à l'autre, et une affectation unique laisserait les catégories du
  // rendu précédent à l'écran après un `invalidateAll()`.
  $: categories = data.categories as Category[];
  $: categoriesError = data.erreur ? $tr(data.erreur) : "";

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

</script>

<MetaSeo
  titre={$tr("title.home")}
  description={$tr("hero.subtitle")}
  canonique={urlCanonique($page.url)}
/>

<!--
  Pas de transition propre à la page : le layout fait déjà entrer le contenu
  en glissant à chaque changement de chemin, et un second fondu, décalé,
  doublait le temps d'apparition sans respecter le réglage « mouvement
  réduit ».
-->
<div class="w-full max-w-7xl flex flex-col items-center pb-16 sm:pb-20">
  <!-- Search Bar. `data-hero-recherche` : le layout la suit, et retire le
       bouton flottant de l'assistant tant qu'elle est à l'écran. Sur les
       téléphones courts, il se posait sur le bouton « Rechercher ». -->
  <div class="w-full max-w-3xl relative group z-20 mb-10 md:mb-16" data-hero-recherche>
    <div
      class="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-300"
    ></div>
    <div
      class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 border border-slate-100 dark:border-slate-700/50 focus-within:ring-2 focus-within:ring-primary"
    >
      <div class="shrink-0 pl-2 sm:pl-4 text-slate-500">
        <span class="material-icons text-xl sm:text-2xl" aria-hidden="true">search</span>
      </div>
      <!--
        `min-w-0 flex-1` : à 320 px, il restait environ 35 px de saisie entre
        l'icône et le bouton. `type=search` et `enterkeyhint=search` affichent
        la touche « Rechercher » du clavier mobile, qu'Entrée traite déjà.
        16 px au moins (`text-base`) : en dessous, iOS zoome sur le champ.
      -->
      <input
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        bind:value={searchQuery}
          aria-label={$tr("a11y.searchField")}
        on:keydown={handleKeydown}
        placeholder={$tr("search.placeholder")}
        class="min-w-0 flex-1 bg-transparent border-none text-base sm:text-lg text-slate-800 dark:text-white placeholder-slate-400 focus:ring-0 focus:outline-none px-2 sm:px-4 py-3"
      />
      <!-- Icône seule sous sm, pour laisser la place au texte saisi ; le nom
           accessible reste « Rechercher ». -->
      <button
        type="button"
        on:click={handleSearch}
        aria-label={$tr("search.button")}
        class="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95"
      >
        <span class="material-icons sm:hidden" aria-hidden="true">arrow_forward</span>
        <span class="hidden sm:inline">{$tr("search.button")}</span>
      </button>
    </div>
  </div>

  <!-- Section Title -->
  <div class="text-center mb-6 md:mb-10 w-full">
    <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
      {$tr("categories.title")}
    </h2>
    <p class="text-sm sm:text-base text-slate-500 dark:text-slate-400">
      {$tr("categories.subtitle")}
    </p>
  </div>

  <!--
    L'état « chargement » a disparu avec le `onMount` : la page n'est plus rendue
    avant que ses données soient là, donc un indicateur de chargement ne serait
    jamais vrai — un état mort de plus dans le balisage.

    L'erreur, elle, reste, et gagne enfin sa reprise. `invalidateAll()` rejoue le
    `load` : c'est le pendant exact de l'ancien appel manuel, sans dupliquer la
    requête dans le composant.
  -->
  {#if categoriesError}
    <div role="alert" class="flex flex-col items-center gap-3 mb-6">
      <p class="text-red-600 dark:text-red-400">{categoriesError}</p>
      <button
        type="button"
        on:click={() => invalidateAll()}
        data-testid="home-retry"
        class="min-h-11 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-colors"
      >
        {$tr("common.retry")}
      </button>
    </div>
  {/if}

  <!-- Categories Grid. Sans marge latérale propre sur téléphone : celle du
       layout suffit, et la grille s'aligne sur la barre de recherche. Deux
       colonnes dès sm : de 640 à 767 px, une colonne donnait des cartes de
       600 px de large. -->
  <div
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full sm:px-4"
  >
    {#each categories as cat, i (cat.id)}
      <!--
        Les categories vides restent affichees mais attenuees. Les masquer
        ferait apparaitre et disparaitre des cases au fil des ingestions : le
        plan de la page changerait a chaque visite, et un utilisateur cherchant
        « Droit Pénal » conclurait que la plateforme ne le couvre pas.

        L'attenuation passait par `opacity-55` sur la carte entiere. L'intention
        etait juste, le moyen non : l'opacite s'applique au TEXTE comme au reste
        et faisait tomber le titre et le compteur a 2,13:1 — sous le seuil de
        lisibilite, pour tout le monde. Le fond grise et la bordure attenuee
        rendent le meme signal visuel sans toucher au contraste du texte.
      -->
      <a
        href="/categories/{cat.id}"
        class="group relative flex flex-col p-4 sm:p-5 rounded-2xl border shadow-sm hover:shadow-lg motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98] active:bg-slate-50 dark:active:bg-slate-700/60 transition-all duration-300 {cat.law_count ===
        0
          ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/40'
          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50'}"
      >
        <div class="mb-3 flex items-center justify-between">
          <div
            class="w-10 h-10 rounded-xl {PALETTE[i % PALETTE.length]} flex items-center justify-center text-xl motion-safe:group-hover:scale-110 transition-transform duration-300"
          >
            {cat.icon || "📄"}
          </div>
          <span
            class="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums"
          >
            {cat.law_count}
            {$tr("categories.documentsShort")}
          </span>
        </div>

        <div>
          <h3
            class="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          >
            {nomCategorie(cat.name, $language.current)}
          </h3>
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2"
          >
            {descriptionCategorie(cat.name, cat.description, $language.current)}
          </p>
        </div>
      </a>
    {/each}
  </div>
</div>
