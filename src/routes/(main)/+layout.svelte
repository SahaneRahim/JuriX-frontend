<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { language, tr } from "$lib/stores/language";
  import { onDestroy } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  /**
   * Le hero, les onglets et le bouton flottant sont propres à l'accueil.
   *
   * Ils étaient rendus par ce layout, donc aussi sur /chat : le titre marketing
   * s'affichait au-dessus de la fenêtre de conversation, et le bouton flottant
   * « aller à l'assistant » était visible depuis l'assistant lui-même.
   *
   * `route.id` plutôt que `pathname` : insensible à une éventuelle barre
   * oblique finale.
   */
  $: isChat = $page.route.id === "/(main)/chat";

  /**
   * Durée d'une transition, nulle quand le système demande moins de
   * mouvement. Lue au moment où la transition démarre : un réglage changé en
   * cours de visite est suivi sans recharger la page.
   */
  const duree = (ms: number) => (prefersReducedMotion.current ? 0 : ms);

  /**
   * Bouton flottant retiré tant que le haut de l'accueil est à l'écran.
   *
   * Sur un téléphone court (320×568, 360×584, 375×553), il se posait sur le
   * bouton « Rechercher » du premier écran et en captait l'appui. Tant que le
   * hero est visible, il ne sert de toute façon à rien : l'onglet « Assistant
   * IA » mène au même endroit. Il se retire donc tant que le titre, les
   * onglets ou la barre de recherche sont à l'écran, et revient dès qu'ils en
   * sont tous sortis. Le layout ne le monte que sur l'accueil ; la recherche
   * monte le sien, jamais retiré.
   *
   * Retiré D'EMBLÉE, au rendu serveur comme avant le premier rapport de
   * l'observateur : affiché par défaut, il aurait glissé hors de l'écran
   * juste après l'hydratation, à chaque arrivée sur l'accueil. Sans
   * JavaScript, il reste donc retiré : l'assistant en a besoin, et l'onglet
   * est là. Sans IntersectionObserver (navigateur ancien), rien ne le
   * ramènerait : il reste affiché, comme avant.
   */
  const zonesDuHero = new Map<Element, boolean>();
  const observateur =
    browser && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entrees) => {
          for (const entree of entrees) zonesDuHero.set(entree.target, entree.isIntersecting);
          majBoutonFlottant();
        })
      : null;
  let boutonMasque = !browser || observateur !== null;

  function majBoutonFlottant() {
    // Aucune zone suivie, avant le montage ou au retour depuis /chat : le
    // bouton reste retiré jusqu'au premier rapport.
    boutonMasque =
      observateur !== null &&
      (zonesDuHero.size === 0 || [...zonesDuHero.values()].some(Boolean));
  }

  /**
   * Action : suit une zone du hero. Avec un sélecteur, suit l'élément qu'il
   * désigne DANS le nœud : la barre de recherche appartient à la page, rendue
   * par le <slot />, où ce layout ne peut pas poser d'action. Ailleurs que sur
   * l'accueil, le sélecteur ne trouve rien et l'action ne fait rien.
   */
  function surveillerHero(noeud: HTMLElement, selecteur?: string) {
    const zone = selecteur ? noeud.querySelector(selecteur) : noeud;
    const obs = observateur;
    if (!obs || !zone) return;
    // Présumée visible jusqu'au premier rapport (asynchrone) : mieux vaut un
    // bouton qui apparaît qu'un bouton qui s'affiche puis s'enfuit.
    zonesDuHero.set(zone, true);
    majBoutonFlottant();
    obs.observe(zone);
    return {
      destroy() {
        obs.unobserve(zone);
        zonesDuHero.delete(zone);
        majBoutonFlottant();
      },
    };
  }

  onDestroy(() => observateur?.disconnect());
</script>

<!--
  Pas de <svelte:head> ici, donc pas de <title>. Les deux pages de ce groupe
  montent MetaSeo, qui en émet un : le navigateur garde le PREMIER, donc celui
  du gabarit gagnait et les titres de page ne s'affichaient jamais. Les polices
  sont déclarées dans le gabarit racine.
-->

<!--
  Deux coques.

  Hors chat : une page qui défile, d'au moins la hauteur de l'écran visible
  (`min-h-dvh` ; `min-h-screen` sert de repli), pied de page en bas.

  Sur /chat : une application de la hauteur EXACTE de l'écran visible
  (`h-app`, 100dvh), sans pied de page ; seule la conversation défile, et la
  saisie reste en bas, au-dessus du clavier. Chaque enveloppe entre la racine
  et la page est en `flex-1 min-h-0 flex flex-col` : un seul maillon sans
  `min-h-0` laisserait la conversation grandir et pousser la saisie hors de
  l'écran. Sous lg, l'en-tête du site n'est pas rendu : la page du chat affiche
  sa propre barre compacte.
-->
<div
  class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark transition-colors duration-300 flex flex-col font-body {isChat
    ? 'h-app overflow-hidden'
    : 'min-h-app'}"
>
  <!--
    Lien d'évitement de /chat sous lg. Celui du site vit dans SiteHeader, que
    l'enveloppe ci-dessous masque sur /chat sous lg : il disparaissait avec
    lui, et /chat était, sur téléphone, la seule page publique où la première
    tabulation n'atteignait pas ce lien. Même cible (le <main> ci-dessous),
    même apparence, premier élément focalisable. `lg:hidden` : à partir de
    lg, l'en-tête revient avec le sien, et deux liens d'évitement se
    suivraient. Rien ne change sur l'accueil, où celui de l'en-tête est déjà
    la première tabulation.
  -->
  {#if isChat}
    <a
      href="#contenu"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-zinc-950 focus:px-4 focus:py-2 focus:font-semibold focus:text-white dark:focus:bg-white dark:focus:text-zinc-950 lg:hidden"
      >{$tr("a11y.skipToContent")}</a
    >
  {/if}

  <!-- `contents` hors chat : l'enveloppe ne crée aucune boîte, l'en-tête reste
       un enfant direct de la colonne. Une seule instance dans les deux cas :
       passer de l'accueil au chat ne la recrée pas. -->
  <div class={isChat ? "hidden lg:block shrink-0" : "contents"}>
    <SiteHeader variant="transparent" />
  </div>

  <!--
    `overflow-x-clip` et non `overflow-hidden` : `hidden` faisait de <main> un
    conteneur de défilement, et tout élément `sticky` de la page collait à lui
    au lieu de l'écran. `clip` rogne sans créer de conteneur. `overflow-x-hidden`
    le précède comme repli, pour les navigateurs qui ignorent `clip` (Safari
    avant 16).

    Marges latérales : 16 px puis 24 px à partir de md, et au moins la zone
    sûre d'un iPhone en paysage. Sur /chat, aucune sous sm : la conversation
    prend toute la largeur du téléphone.

    Marge haute : 32 px à partir de sm, plus celle du hero ci-dessous. Elle
    passait à 80 px à partir de md (`md:pt-20`) : avec le hero, 190 px de
    vide sous l'en-tête, et la barre de recherche sortait du premier écran
    en 1 024 × 768.
  -->
  <main
    id="contenu"
    class="relative flex w-full flex-col overflow-x-hidden overflow-x-clip {isChat
      ? 'min-h-0 flex-1 sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] lg:px-6 lg:pt-6'
      : 'flex-grow items-center justify-start pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 sm:pt-8 md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] court:!pt-2'}"
  >
    <!-- Background Subtle Glow (Noir & Blanc) -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] bg-gradient-to-b from-zinc-200/40 via-transparent to-transparent dark:from-zinc-800/20 dark:via-transparent dark:to-transparent -z-10 pointer-events-none"
    ></div>

    <!-- Hero persistant (accueil) et contenu de la page. Marges du hero
         réduites sur téléphone : la barre de recherche commençait vers 780 px
         du haut, sous la ligne de flottaison de tous les téléphones.
         À partir de md, la marge haute suit la HAUTEUR de l'écran (5vh, 48 px
         au plus) : 112 px fixes repoussaient la barre de recherche sous la
         ligne de flottaison des portables (1 024 × 768, 1 366 × 650), et la
         grille des catégories hors du premier écran en 1 440 × 900.
         `court:!…` (téléphone en paysage) : Tailwind émet la variante
         `court` AVANT sm/md/lg, dont les valeurs l'emporteraient sinon.
         Marge basse : 32 px, puis 48 à partir de sm, celle du blog et de
         l'article (`py-8 sm:py-12`) et de /about. L'accueil ajoutait la
         sienne (`pb-20 sm:pb-28`) à celle-ci (`md:pb-12`) : 161 px de vide
         entre la dernière rangée de catégories et le pied de page, contre
         48 sur le blog ; la grille semblait finir sur un trou. -->
    <div
      class="relative flex w-full flex-col {isChat
        ? 'min-h-0 flex-1'
        : 'items-center px-0 pt-6 pb-8 sm:px-4 sm:pt-10 sm:pb-12 md:pt-[min(3rem,5vh)] court:!pt-4'}"
    >
      {#if !isChat}
        <!--
          Hero traduisible. L'ancien et le nouveau texte se croisent dans la
          MÊME cellule de grille : empilés l'un sous l'autre le temps du fondu,
          ils doublaient la hauteur du hero et la page sautait à chaque
          changement de langue. Ce bloc et les onglets sont suivis par
          `surveillerHero` : le bouton flottant reste retiré tant qu'ils sont
          à l'écran.
        -->
        <div class="grid w-full justify-items-center" use:surveillerHero>
          {#key $language.current}
            <div
              class="col-start-1 row-start-1 flex flex-col items-center w-full"
              in:fade={{ duration: duree(200), delay: duree(100) }}
              out:fade={{ duration: duree(150) }}
            >
              <!-- Badge Minimaliste. Sans `tracking-wide` : à 12 px,
                   l'interlettrage arrondi au pixel ouvrait des trous au milieu
                   des mots (« Camer ounaise », « A I »). Retiré sur écran court
                   (téléphone en paysage), comme le sous-titre : avec eux, le
                   hero remplissait les 360 px de haut et la barre de recherche
                   commençait sous la ligne de flottaison. -->
              <div
                class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-zinc-900 dark:text-zinc-100 text-xs font-medium mb-6 md:mb-8 shadow-sm dark:shadow-none court:hidden"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white motion-safe:animate-pulse"></span>
                {$tr("hero.badge")}
              </div>

              <!-- Title. 36 px sur téléphone : à 48 px, le titre tenait sur
                   quatre lignes à 360 px de large. Le mot mis en retrait a sa
                   propre clé : il était retranché du titre par
                   `.replace("IA", "")`, sans effet sur « Your AI Legal
                   Assistant », et l'anglais affichait le titre entier suivi
                   d'un « IA » français. Retrait en zinc-500 et non 400 : même
                   en grand texte, le zinc-400 n'atteint pas 3:1 sur le fond
                   clair. Sur écran court, le retour à la ligne est retiré :
                   le mot reste sur la ligne du titre, une ligne de gagnée.
                   Interligne de 1,08 posé AVEC chaque taille
                   (`sm:text-5xl/[1.08]`) : `sm:text-5xl md:text-6xl
                   lg:text-7xl` apportaient leur interligne de 1, écrit dans
                   leur requête donc après `leading-[1.08]`, qui ne valait
                   plus qu'au téléphone (5 px entre « Juridique » et « IA » à
                   768 px). Sur écran court, 16 px sous le titre et sous les
                   onglets (8 et 12 auparavant) : le jambage du « q »
                   touchait presque la piste, et la barre de recherche reste
                   dans le premier écran (fin vers 280 px sur 360). -->
              <h1
                class="text-4xl/[1.08] sm:text-5xl/[1.08] md:text-6xl/[1.08] lg:text-7xl/[1.08] court:!text-4xl font-extrabold text-center text-zinc-950 dark:text-white mb-4 md:mb-6 court:!mb-4 max-w-4xl tracking-tight"
              >
                {$tr("hero.title")}<br class="court:hidden" />
                <span class="text-zinc-500 dark:text-zinc-400 font-semibold"
                  >{$tr("hero.titleHighlight")}</span
                >
              </h1>

              <!-- Subtitle (retiré sur écran court, voir le badge) -->
              <p
                class="text-center text-zinc-600 dark:text-zinc-400 text-base sm:text-lg md:text-xl max-w-2xl mb-8 md:mb-10 leading-relaxed font-normal court:hidden"
              >
                {$tr("hero.subtitle")}
              </p>
            </div>
          {/key}
        </div>

        <!-- Search Tabs. Pleine largeur (320 px au plus) sur téléphone : avec
             deux onglets de 140 px minimum, la bascule débordait à 320 px.
             Onglet au repos en zinc-600 : sur la piste zinc-100, le zinc-500
             n'atteint que 4,4:1. -->
        <div
          class="relative grid w-full max-w-xs grid-cols-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-full border border-zinc-200 dark:border-zinc-800 mb-8 md:mb-10 court:!mb-4 shadow-sm dark:shadow-none sm:inline-grid sm:w-auto sm:max-w-none"
          use:surveillerHero
        >
          <!-- Sliding Background -->
          <div
            class="sliding-pill-tabs absolute top-1 bottom-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm dark:shadow-none border border-zinc-200/80 dark:border-zinc-700/80"
            class:left-1={$page.url.pathname === "/"}
            class:right-1={$page.url.pathname === "/chat"}
            style="width: calc(50% - 4px);"
          ></div>

          <a
            href="/"
            class="relative z-10 flex min-h-11 min-w-0 items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 sm:min-w-[140px] {$page
              .url.pathname === '/'
              ? 'text-zinc-950 dark:text-white'
              : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}"
          >
            <Icone nom="search" class="text-base" />
            {$tr("mode.search")}
          </a>
          <a
            href="/chat"
            class="relative z-10 flex min-h-11 min-w-0 items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 sm:min-w-[140px] {$page
              .url.pathname === '/chat'
              ? 'text-zinc-950 dark:text-white'
              : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}"
          >
            <Icone nom="sparkles" class="text-base" />
            {$tr("mode.chat")}
          </a>
        </div>
      {/if}

      <!--
        Contenu de la page (barre de recherche ou chat), rejoué à chaque
        changement de chemin. Entrée seule, sans sortie : avec une sortie,
        l'ancienne page restait dans le flux le temps de son animation et la
        nouvelle s'insérait dessous, puis remontait d'un coup. Sur /chat,
        l'enveloppe prolonge la chaîne de hauteur jusqu'à la page. Recréée à
        chaque page, elle y retrouve la barre de recherche de l'accueil
        (`data-hero-recherche`), dernière zone du hero suivie.
      -->
      {#key $page.url.pathname}
        <div
          class="flex w-full flex-col {isChat ? 'min-h-0 flex-1' : 'items-center justify-center'}"
          in:fly={{ y: 16, duration: duree(250), easing: cubicOut }}
          use:surveillerHero={"[data-hero-recherche]"}
        >
          <slot />
        </div>
      {/key}
    </div>
  </main>

  <!-- Ni pied de page ni bouton flottant sur /chat : la conversation occupe
       tout l'écran, et le bouton pointerait sur la page courante. Le pied de
       page réserve la place du bouton pour qu'il ne couvre jamais le
       copyright. Sur l'accueil, le bouton se retire tant que le hero est à
       l'écran (`boutonMasque`, plus haut). -->
  {#if !isChat}
    <SiteFooter reserverBouton />
    <ChatFab masque={boutonMasque} />
  {/if}
</div>

<style>
  .sliding-pill-tabs {
    transition:
      left 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .sliding-pill-tabs {
      transition: none;
    }
  }
</style>
