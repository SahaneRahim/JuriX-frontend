<script lang="ts">
  import { onMount } from "svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import { tr, language } from "$lib/stores/language";
  import { descriptionCategorie, nomCategorie } from "$lib/categories";
  import type { Category } from "$lib/types";
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import Icone from "$lib/components/Icone.svelte";

  /** Rempli par `+page.ts`. */
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

  /**
   * Texte indicatif de la barre : la phrase complète à partir de sm, une
   * phrase courte en dessous. Sur téléphone, le champ ne laisse que 220 px
   * de texte à 390 px de large (150 à 320) : « Rechercher une loi, un
   * mot-clé... » (246 px) s'y arrêtait sur « un m… ». « Rechercher un
   * texte… » (164 px) tient à partir de 334 px. Même procédé que la
   * recherche d'une catégorie (categories/[id]) : le rendu serveur pose la
   * phrase courte, qui tient partout ; la longue la remplace après
   * l'hydratation sur un écran assez large.
   */
  const REQUETE_CHAMP_LARGE = "(min-width: 640px)";
  let champLarge = false;

  onMount(() => {
    const requete = window.matchMedia(REQUETE_CHAMP_LARGE);
    const suivre = () => (champLarge = requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  });

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
  $: categories = (data.categories || []) as Category[];
  $: categoriesError = data.erreur ? $tr(data.erreur) : "";

  // « 0 texte » en français mais « 0 texts » en anglais : la règle du pluriel
  // dépend de la langue, qu'un simple `> 1` ne suit pas. Les catégories vides
  // restent affichées (voir la grille), le cas du zéro se voit donc.
  $: pluriel = new Intl.PluralRules($language.current);

  // Séparateur de milliers de la langue : « 1277 textes » se lisait mal, quand
  // le reste du site écrit « 2 200 lois ». « 1 277 » en français, « 1,277 » en
  // anglais. Espace insécable (U+00A0) avant l'unité : le nombre et son mot
  // restent sur la même ligne. Un compteur par domaine, recalculé quand la
  // langue ou les domaines changent ; affiché deux fois (pastille de la
  // carte, ligne du téléphone). Nombre et mot à part : dans la pastille, la
  // chasse fixe ne sert qu'au nombre (badge du guide, § 4.8), le mot reste
  // en Inter.
  const INSECABLE = String.fromCharCode(0xa0);
  $: nombre = new Intl.NumberFormat($language.current);
  $: compteurs = new Map(
    categories.map((cat): [number, { nombre: string; mot: string }] => [
      cat.id,
      {
        nombre: nombre.format(cat.law_count),
        mot: $tr(pluriel.select(cat.law_count) === "one" ? "categories.textCount.one" : "categories.textCount.other"),
      },
    ]),
  );

  // Tuile « Tous les textes » en fin de grille : 14 domaines sur trois
  // colonnes laissaient une case vide en bas à droite, qu'on prenait pour une
  // carte manquante. Elle prend les cases restantes de la dernière rangée, à
  // deux colonnes (sm) comme à trois (lg), et toute une rangée quand la
  // précédente est pleine : le nombre de domaines vient de la base, il peut
  // changer. Classes écrites en entier, pour que Tailwind les trouve.
  const ETENDUE_SM = ["sm:col-span-2", "sm:col-span-1"];
  const ETENDUE_LG = ["lg:col-span-3", "lg:col-span-2", "lg:col-span-1"];
  $: etendueTousLesTextes = `${ETENDUE_SM[categories.length % 2]} ${ETENDUE_LG[categories.length % 3]}`;
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
<!-- Sans marge basse propre : celle du layout (32 px, puis 48) est la même
     que sur les autres pages. -->
<div class="w-full max-w-6xl flex flex-col items-center">
  <!-- Barre de Recherche Monochrome & Aérée. `data-hero-recherche` : le layout
       la suit, et retire le bouton flottant de l'assistant tant qu'elle est à
       l'écran. Sur les téléphones courts, il se posait sur le bouton
       « Rechercher ». -->
  <div class="w-full max-w-3xl relative z-20 mb-12 md:mb-16" data-hero-recherche>
    <!-- Cadre du champ : la recette des champs (guide § 4.5). En sombre, fond
         zinc-950 et bordure zinc-500 : en zinc-900 bordé de zinc-800, la barre
         se perdait dans la page. -->
    <div
      class="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-xl shadow-zinc-200/60 dark:shadow-none flex items-center gap-2 p-2 sm:p-2.5 border border-zinc-200 dark:border-zinc-500 focus-within:border-zinc-950 dark:focus-within:border-zinc-200 focus-within:ring-1 focus-within:ring-zinc-950 dark:focus-within:ring-zinc-200 transition-all duration-200"
    >
      <div class="shrink-0 pl-3 sm:pl-4 text-zinc-400 dark:text-zinc-500">
        <Icone nom="search" class="text-xl sm:text-2xl" />
      </div>

      <!--
        `min-w-0 flex-1` : à 320 px, il restait environ 35 px de saisie entre
        l'icône et le bouton. `type=search` et `enterkeyhint=search` affichent
        la touche « Rechercher » du clavier mobile, qu'Entrée traite déjà.
        16 px au moins (`text-base`) : en dessous, iOS zoome sur le champ.
        `text-ellipsis` : sur téléphone, le texte indicatif était coupé net au
        milieu d'un mot (« un mot- ») ; il finit maintenant par « … ». Le
        texte court du téléphone (`champLarge`) évite la coupe elle-même.
      -->
      <input
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        bind:value={searchQuery}
        aria-label={$tr("a11y.searchField")}
        on:keydown={handleKeydown}
        placeholder={$tr(champLarge ? "search.placeholder" : "categories.searchPlaceholderShort")}
        class="min-w-0 flex-1 bg-transparent border-none text-base sm:text-lg text-ellipsis text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-0 focus:outline-none px-2 sm:px-3 py-3 font-normal"
      />

      <!-- Raccourci clavier discret, réservé aux écrans larges à pointeur fin
           (souris, pavé tactile) : sur une tablette tactile sans clavier, il
           ne voulait rien dire et prenait la place du texte saisi. Même
           libellé que dans l'en-tête. Texte en zinc-600 : sur ce fond
           zinc-100, le zinc-400 ne faisait que 2,3:1. -->
      <kbd
        class="hidden lg:[@media(pointer:fine)]:inline-flex shrink-0 items-center px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-mono font-medium border border-zinc-200/70 dark:border-zinc-700/70 select-none"
        aria-hidden="true">Ctrl K</kbd
      >

      <!-- Icône seule sous sm, pour laisser la place au texte saisi ; le nom
           accessible reste « Rechercher ». -->
      <button
        type="button"
        on:click={handleSearch}
        aria-label={$tr("search.button")}
        class="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center bg-zinc-950 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-4 sm:px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm dark:shadow-none motion-safe:active:scale-95"
      >
        <Icone nom="arrow-right" class="text-2xl sm:hidden" />
        <span class="hidden sm:inline">{$tr("search.button")}</span>
      </button>
    </div>
  </div>

  <!-- Titre de la Section Catégories -->
  <div class="flex flex-col items-center text-center mb-8 md:mb-10 w-full">
    <span class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
      {$tr("categories.eyebrow")}
    </span>
    <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
      {$tr("categories.title")}
    </h2>
    <p class="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-xl mt-2 font-normal leading-relaxed">
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
    <div role="alert" class="flex flex-col items-center gap-3 mb-8">
      <p class="text-red-600 dark:text-red-400 text-sm">{categoriesError}</p>
      <button
        type="button"
        on:click={() => invalidateAll()}
        data-testid="home-retry"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white"
      >
        {$tr("common.retry")}
      </button>
    </div>
  {/if}

  <!-- Grille de Catégories Noir & Blanc, Aérée et Épurée. Sans marge latérale
       propre : celle du layout suffit, et la grille s'aligne sur la barre de
       recherche. Deux colonnes dès sm : de 640 à 767 px, une colonne donnait
       des cartes de 600 px de large.
       Sous sm, une liste compacte : une ligne par domaine (tuile, nom,
       compteur, flèche). Les cartes complètes, de 260 px de haut chacune,
       portaient la page à près de six écrans avant le pied de page.
       Sur écran court (`court:`, téléphone en paysage), la même liste, sur
       deux colonnes : les cartes complètes y revenaient avec sm, une rangée
       de 290 à 310 px pour 360 de haut, une seule rangée de domaines par
       écran et 3 305 px de page (2 672 en portrait). La variante `court:`
       l'emporte sur sm/lg (tailwind.config.js). La ligne est centrée dans
       sa carte (`court:justify-center`) : étirée à la hauteur de sa voisine
       de rangée, une carte au titre court gardait sa ligne en haut. -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 court:gap-3 w-full">
    {#each categories as cat (cat.id)}
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

        Retour au toucher (`active:`) : sur téléphone, sans survol, rien ne
        montrait que l'appui avait pris.
      -->
      <a
        href="/categories/{cat.id}"
        class="group relative flex flex-col justify-between court:justify-center p-4 sm:p-7 court:p-4 rounded-2xl border transition-all duration-200 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98] active:bg-zinc-50 dark:active:bg-zinc-800/60 {cat.law_count === 0
          ? 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200/60 dark:border-zinc-800/40'
          : 'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-950 dark:hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-none'}"
      >
        <!-- Une ligne sous sm et sur écran court (tuile, nom et compteur,
             flèche) ; la carte complète ailleurs, où ce bloc redevient un
             simple bloc. -->
        <div class="flex items-center gap-4 sm:block court:flex">
          <!-- En-tête de carte : Icône sobre & Compteur de textes. La tuile
               porte la couleur, et l'icône (currentColor) la suit jusque dans
               l'inversion au survol. -->
          <div class="flex shrink-0 items-center justify-between sm:mb-5 court:mb-0">
            <div
              class="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 group-hover:bg-zinc-950 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-950 transition-colors duration-200"
            >
              <CategoryIcon category={cat.name} class="w-5 h-5" />
            </div>
            <!-- Badge du guide (§ 4.8) : `py-0.5`, Inter, la chasse fixe pour
                 le nombre seul. Il était plus haut (`py-1`) et entièrement en
                 Geist Mono, mot compris, à côté des badges du blog. -->
            <span
              class="hidden sm:inline-flex court:hidden items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
            >
              <span class="font-mono tabular-nums">{compteurs.get(cat.id)?.nombre}</span>
              {compteurs.get(cat.id)?.mot}
            </span>
          </div>

          <!-- Nom et description. Description sur trois lignes au plus, et
               non deux : de 740 à 1 024 px, deux lignes la coupaient en plein
               milieu (« …et accords de… »). Elle n'est pas affichée dans la
               liste du téléphone, où le compteur passe sous le nom. -->
          <div class="min-w-0 flex-1">
            <h3
              class="text-base sm:text-lg court:text-base font-bold text-zinc-950 dark:text-white sm:mb-2 court:mb-0 leading-snug group-hover:text-black dark:group-hover:text-white transition-colors"
            >
              {nomCategorie(cat.name, $language.current)}
            </h3>
            <p class="mt-0.5 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400 sm:hidden court:block">
              {compteurs.get(cat.id)?.nombre}{INSECABLE}{compteurs.get(cat.id)?.mot}
            </p>
            <p class="hidden text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed sm:line-clamp-3 court:hidden font-normal">
              {descriptionCategorie(cat.name, cat.description, $language.current)}
            </p>
          </div>

          <Icone
            nom="arrow-right"
            class="text-lg text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors sm:hidden court:inline-block"
          />
        </div>

        <!-- Pied de carte : flèche d'accès minimale. Filet zinc-200, le
             séparateur du guide : en zinc-100 (1,05:1 sur blanc), il ne se
             voyait presque pas. -->
        <div class="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 hidden sm:flex court:hidden items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-200 transition-colors">
          <span class="font-medium">{$tr("categories.browseTexts")}</span>
          <Icone nom="arrow-right" class="text-base motion-safe:group-hover:translate-x-1 transition-transform duration-200" />
        </div>
      </a>
    {/each}

    <!-- « Tous les textes » : complète la dernière rangée (voir
         `etendueTousLesTextes`) et mène à la liste complète, /laws. Même
         carte que les domaines, sans compteur : la somme des domaines ne
         compterait pas les textes qui n'en ont pas. -->
    {#if categories.length > 0}
      <a
        href="/laws"
        class="group relative flex flex-col justify-between court:justify-center p-4 sm:p-7 court:p-4 rounded-2xl border transition-all duration-200 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98] active:bg-zinc-50 dark:active:bg-zinc-800/60 bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-950 dark:hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-none {etendueTousLesTextes}"
      >
        <div class="flex items-center gap-4 sm:block court:flex">
          <div class="flex shrink-0 items-center sm:mb-5 court:mb-0">
            <div
              class="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 group-hover:bg-zinc-950 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-950 transition-colors duration-200"
            >
              <Icone nom="files" class="w-5 h-5" />
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-base sm:text-lg court:text-base font-bold text-zinc-950 dark:text-white sm:mb-2 court:mb-0 leading-snug">
              {$tr("search.allTexts")}
            </h3>
            <p class="mt-0.5 text-xs sm:mt-0 sm:text-sm court:mt-0.5 court:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {$tr("laws.subtitle")}
            </p>
          </div>
          <Icone
            nom="arrow-right"
            class="text-lg text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors sm:hidden court:inline-block"
          />
        </div>
        <div class="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 hidden sm:flex court:hidden items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-200 transition-colors">
          <span class="font-medium">{$tr("categories.browseTexts")}</span>
          <Icone nom="arrow-right" class="text-base motion-safe:group-hover:translate-x-1 transition-transform duration-200" />
        </div>
      </a>
    {/if}
  </div>
</div>
