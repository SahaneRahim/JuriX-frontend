<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import { tr, language } from "$lib/stores/language";
  import {
    descriptionCategorie,
    nomCategorie,
    nombreDeTextesDuCorpus,
    ordonnerLesDomaines,
    pharesCategorie,
  } from "$lib/categories";
  import type { Category } from "$lib/types";
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import Icone from "$lib/components/Icone.svelte";

  /** Rempli par `+page.server.ts`. */
  export let data;

  /**
   * RECHERCHE SANS JAVASCRIPT (proposition P8, variante A). La barre était un
   * champ suivi d'un bouton `type=button` qui appelait `goto()` : avant
   * l'hydratation, sur un téléphone lent, ou dans Opera Mini en mode Extreme,
   * l'appui ne faisait rien. C'est maintenant un vrai formulaire GET vers
   * /search, champ `q` : sans script, le navigateur l'envoie lui-même
   * (/search?q=…) ; avec, SvelteKit le traite comme un lien et navigue sans
   * recharger. Entrée, la touche « Rechercher » du clavier mobile et le bouton
   * l'envoient tous trois, sans gestionnaire de touche : un Entrée tapé
   * pendant une composition (clavier à suggestions) ne part plus.
   *
   * Ce gestionnaire n'est qu'une amélioration : une requête vide ne quitte
   * pas la page (le champ reprend le focus), et les espaces des bords sont
   * retirés avant l'envoi. Il écrit dans le champ lui-même, et non dans une
   * variable : SvelteKit lit le formulaire juste après, dans le même
   * événement, avant tout rendu.
   */
  function envoyerLaRecherche(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    const champ = event.currentTarget.elements.namedItem("q");
    if (!(champ instanceof HTMLInputElement)) return;
    const requete = champ.value.trim();
    if (!requete) {
      event.preventDefault();
      champ.focus();
      return;
    }
    champ.value = requete;
  }

  /**
   * Texte indicatif de la barre : la phrase complète à partir de sm, une
   * phrase courte en dessous. Sur téléphone, le champ ne laisse que 220 px
   * de texte à 390 px de large (150 à 320) : « Rechercher une loi, un
   * mot-clé... » (246 px) s'y arrêtait sur « un m… ». « Rechercher un
   * texte… » (164 px) tient à partir de 334 px. Même procédé que la
   * recherche d'une catégorie (categories/[id]) : le rendu serveur pose la
   * phrase courte, qui tient partout ; la longue la remplace après
   * l'hydratation sur un écran assez large, et suit le redimensionnement.
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

  // Les catégories viennent de la BASE, plus d'une liste écrite en dur : celle
  // d'avant mélangeait domaines juridiques et types de texte (« Lois »,
  // « Décrets »), et un décret fiscal n'avait aucune case correcte.
  //
  // Réactif et non simplement affecté : SvelteKit réutilise ce composant d'une
  // navigation à l'autre, et une affectation unique laisserait les catégories du
  // rendu précédent à l'écran après un `invalidateAll()`.
  //
  // Ordre PROVISOIRE de la proposition Q2 (travail, pénal, famille, foncier,
  // affaires, civil, impôts, Constitution, puis les autres), en attendant des
  // statistiques de consultation : `ordonnerLesDomaines` ($lib/categories).
  $: domaines = ordonnerLesDomaines((data.categories || []) as Category[]);
  $: categoriesError = data.erreur ? $tr(data.erreur) : "";
  $: langue = $language.current;

  /**
   * Chiffres du corpus (`GET /corpus`) que le `load` passe à la page : le
   * nombre de textes de la ligne « Tous les textes » et de la description.
   * Lus sans les exiger, dans `$page.data` comme le fait le hero du layout :
   * l'ancienne API n'a pas la route, et le `load` peut ne pas encore les
   * demander. Sans eux, les phrases s'écrivent sans chiffre.
   */
  $: totalDesTextes = nombreDeTextesDuCorpus($page.data?.corpus);
  $: nombreAffiche = totalDesTextes === null ? "" : new Intl.NumberFormat(langue).format(totalDesTextes);
  $: sousTitre =
    totalDesTextes === null
      ? $tr("accueil.sousTitreSansChiffre")
      : $tr("accueil.sousTitre").replace("{n}", nombreAffiche);
  $: ligneTousLesTextes =
    totalDesTextes === null
      ? $tr("accueil.domaines.tousSansChiffre")
      : $tr("accueil.domaines.tous").replace("{n}", nombreAffiche);

  /**
   * « Tous les textes » termine la liste. Sur deux colonnes, il prend la
   * rangée entière quand les domaines la remplissent (14), la case restante
   * sinon : le nombre de domaines vient de la base, il peut changer, et une
   * case vide se lirait comme une ligne manquante (fond gris des filets).
   * Classes écrites en entier, pour que Tailwind les trouve.
   */
  const ETENDUE_SM = ["sm:col-span-2", "sm:col-span-1"];
  $: etendueTousLesTextes = ETENDUE_SM[domaines.length % 2];

  /**
   * Une ligne de la liste des domaines (Q2 A et Q3 A).
   *
   * Une seule liste bordée, aux lignes séparées par des filets : les filets
   * sont le fond zinc-200 de la liste, vu à travers un écart d'un pixel
   * (`gap-px`). 64 px de haut au moins sur téléphone, 72 à partir de sm
   * (deux colonnes) : une cible tactile large, sans les 15 cadres de 76 à
   * 94 px empilés d'avant. Sur écran court (téléphone en paysage, deux
   * colonnes), 64 px : une rangée de plus dans les 360 px.
   *
   * `relative` : la ligne contient le `::after` du lien, étendu à toute sa
   * surface. `group` : le chevron se fonce au survol de la ligne. Survol et
   * appui en zinc-50 et zinc-100 : la ligne entière réagit, comme le lien
   * qui la couvre. Le survol n'existe qu'avec une souris
   * (`hoverOnlyWhenSupported`, tailwind.config.js).
   */
  const LIGNE =
    "group relative flex min-h-16 items-center gap-4 bg-white px-4 py-2.5 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800/60 dark:active:bg-zinc-800 sm:min-h-[72px] sm:py-3.5 court:min-h-16 court:py-2.5";

  /**
   * Le lien d'une ligne : posé sur le NOM seul (h3 > a), son `::after` couvre
   * toute la ligne (le « lien étendu » du DSFR). La carte entière dans un
   * <a> donnait un nom accessible interminable (compteur, nom, description,
   * « Consulter les textes »), répété quatorze fois ; ici le nom du lien est
   * le nom du domaine, et la ligne secondaire sa description
   * (`aria-describedby`).
   *
   * Le contour de focus est dessiné sur le `::after`, donc autour de la
   * ligne, et non sur le seul nom. En retrait de 4 px et arrondi : la liste
   * coupe ce qui dépasse de ses coins arrondis (`overflow-hidden`), et un
   * contour posé au bord y serait rogné. Un `outline` et non une ombre : il
   * reste visible en contraste élevé (Windows), qui efface les ombres.
   */
  const LIEN =
    "after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-zinc-950 dark:focus-visible:after:outline-white";

  /** Icône du domaine : 20 px, sans tuile, en gris secondaire (Q2 A). */
  const ICONE = "text-xl shrink-0 text-zinc-500 dark:text-zinc-400";

  /** Chevron décoratif : le lien est déjà nommé, il ne dit rien de plus. */
  const CHEVRON =
    "text-base shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-950 dark:text-zinc-500 dark:group-hover:text-white";
</script>

<MetaSeo
  titre={$tr("title.home")}
  description={`${$tr("accueil.titre")} ${sousTitre}`}
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
  <!--
    Barre de recherche : un vrai formulaire GET (voir `envoyerLaRecherche`).
    `role="search"` en fait le repère de recherche de la page.
    `data-hero-recherche` : le layout la suit, et retire le bouton flottant
    de l'assistant tant qu'elle est à l'écran ; sur les téléphones courts, il
    se posait sur le bouton « Rechercher ».
  -->
  <form
    method="get"
    action="/search"
    role="search"
    class="w-full max-w-3xl relative z-20 mb-12 md:mb-16"
    data-hero-recherche
    on:submit={envoyerLaRecherche}
  >
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
        `name="q"` : le paramètre que lit /search, envoyé tel quel sans
        JavaScript. `min-w-0 flex-1` : à 320 px, il restait environ 35 px de
        saisie entre l'icône et le bouton. `type=search` et
        `enterkeyhint=search` affichent la touche « Rechercher » du clavier
        mobile. 16 px au moins (`text-base`) : en dessous, iOS zoome sur le
        champ. `text-ellipsis` : un texte indicatif trop long finit par « … »
        au lieu d'être coupé au milieu d'un mot.
      -->
      <input
        type="search"
        name="q"
        enterkeyhint="search"
        autocomplete="off"
        aria-label={$tr("a11y.searchField")}
        placeholder={$tr(champLarge ? "search.placeholder" : "categories.searchPlaceholderShort")}
        class="min-w-0 flex-1 bg-transparent border-none text-base sm:text-lg text-ellipsis text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-0 focus:outline-none px-2 sm:px-3 py-3 font-normal"
      />

      <!-- Raccourci clavier discret, réservé aux écrans larges à pointeur fin
           (souris, pavé tactile) : sur une tablette tactile sans clavier, il
           ne voulait rien dire et prenait la place du texte saisi. Même
           libellé que dans l'en-tête. Texte en zinc-600 : sur ce fond
           zinc-100, le zinc-400 ne faisait que 2,3:1. La chasse fixe reste
           réservée à ce genre de code court (Q5). -->
      <kbd
        class="hidden lg:[@media(pointer:fine)]:inline-flex shrink-0 items-center px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-mono font-medium border border-zinc-200/70 dark:border-zinc-700/70 select-none"
        aria-hidden="true">Ctrl K</kbd
      >

      <!-- Bouton d'envoi du formulaire. Icône seule sous sm, pour laisser la
           place au texte saisi ; le nom accessible reste « Rechercher ». -->
      <button
        type="submit"
        aria-label={$tr("search.button")}
        class="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center bg-zinc-950 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-4 sm:px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm dark:shadow-none motion-safe:active:scale-95"
      >
        <Icone nom="arrow-right" class="text-2xl sm:hidden" />
        <span class="hidden sm:inline">{$tr("search.button")}</span>
      </button>
    </div>
  </form>

  <!--
    Parcourir par domaine (Q2 A, Q3 A) : une seule liste à filets, et non une
    grille de cartes. Sur téléphone, les quinze cartes faisaient environ
    1 500 px de défilement (3 680 en r1) ; la liste en fait moins de 1 000.
    Sur ordinateur, deux colonnes de sept lignes (2 × 7 + « Tous les
    textes »), sans la case vide de la grille à trois colonnes. Les compteurs
    sont retirés : « 6 textes » contre « 1 277 » se lisait comme une mesure de
    couverture, alors que la fonction publique compte surtout des nominations.
    Sans marge latérale propre : celle du layout suffit, et la liste s'aligne
    sur la barre de recherche et sur le logo.

    `id="domaines"` : cible du lien « Parcourir par domaine » de l'état vide
    de la recherche (/#domaines, P7) ; sans elle, le lien posait le lecteur
    en haut de l'accueil, au-dessus du titre. L'en-tête de l'accueil ne colle
    pas : `scroll-mt-4` ne laisse qu'un peu d'air au-dessus du titre.
  -->
  <section id="domaines" class="w-full scroll-mt-4">
    <h2 class="mb-4 sm:mb-5 text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
      {$tr("accueil.domaines.titre")}
    </h2>

    <!--
      L'erreur garde sa reprise. `invalidateAll()` rejoue le `load` : c'est le
      pendant exact de l'ancien appel manuel, sans dupliquer la requête dans
      le composant. (Le `load` d'aujourd'hui répond 503 plutôt que d'envoyer
      une erreur : ce bloc ne sert que si cela change.)
    -->
    {#if categoriesError}
      <div role="alert" class="flex flex-col items-center gap-3 mb-6">
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

    <ul
      data-testid="accueil-domaines"
      class="grid w-full grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2"
    >
      {#each domaines as cat (cat.id)}
        {@const phares = pharesCategorie(cat.name, langue)}
        {@const description = descriptionCategorie(cat.name, cat.description, langue)}
        <li class={LIGNE}>
          <CategoryIcon category={cat.name} class={ICONE} />
          <div class="min-w-0 flex-1">
            <!-- Nom court sur une ligne (Q2 A) ; il passe à la ligne plutôt
                 que d'être coupé sur les écrans les plus étroits (largeurs
                 mesurées : en-tête de $lib/categories). -->
            <h3 class="text-base font-semibold leading-6 text-zinc-950 dark:text-white">
              <a href="/categories/{cat.id}" aria-describedby="domaine-{cat.id}-textes" class={LIEN}
                >{nomCategorie(cat.name, langue)}</a
              >
            </h3>
            <!--
              Ligne secondaire, sur une ligne, tronquée par « … » : deux ou
              trois textes phares du domaine, vérifiés en base (pharesCategorie).
              La version courte sous xl (une colonne, ou deux colonnes
              étroites), la longue à partir de xl (474 px de texte par
              colonne). La bascule se faisait à lg : à 1 024 px, les deux
              colonnes ne laissent que 362 px de texte, et les lignes longues
              (jusqu'à 380 px) s'arrêtaient au milieu d'un mot (« …justice
              militai… »), alors que la courte (240 px au plus) y tient, comme
              à 768 px.
              Un domaine vide le dit, plutôt que de citer des textes absents ;
              un domaine inconnu de $lib/categories garde la description de
              l'API, rien n'ayant été vérifié pour lui. Sa description
              accessible ne lit que la version affichée : l'autre est en
              `display: none`.
            -->
            <p id="domaine-{cat.id}-textes" class="truncate text-sm leading-5 text-zinc-500 dark:text-zinc-400">
              {#if cat.law_count === 0}
                {$tr("accueil.domaines.vide")}
              {:else if phares}
                <span class="xl:hidden">{phares.court}</span><span class="hidden xl:inline">{phares.long}</span>
              {:else}
                {description}
              {/if}
            </p>
          </div>
          <Icone nom="chevron-right" class={CHEVRON} />
        </li>
      {/each}

      <!-- « Tous les textes » : la liste complète (/laws). Toujours là, même
           si la liste des domaines arrivait vide. Son nombre vient de l'API
           (`ligneTousLesTextes`) : la somme des domaines ne compterait pas les
           textes qui n'en ont pas. -->
      <li class="{LIGNE} {etendueTousLesTextes}">
        <Icone nom="files" class={ICONE} />
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold leading-6 text-zinc-950 dark:text-white">
            <a href="/laws" aria-describedby="domaine-tous-textes" class={LIEN}>{$tr("search.allTexts")}</a>
          </h3>
          <p id="domaine-tous-textes" class="truncate text-sm leading-5 text-zinc-500 dark:text-zinc-400">
            {ligneTousLesTextes}
          </p>
        </div>
        <Icone nom="chevron-right" class={CHEVRON} />
      </li>
    </ul>
  </section>
</div>
