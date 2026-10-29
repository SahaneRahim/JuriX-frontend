<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { nombreDeTextesDuCorpus } from "$lib/categories";
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
   * Sous-titre du hero (proposition Q1, variante A). Le titre dit la tâche
   * (« Que dit la loi camerounaise ? ») ; l'IA est nommée ici, une seule fois,
   * avec sa garantie : elle « répond en citant les articles ». Le badge « IA
   * Juridique Camerounaise » à point pulsé, quatrième mention de l'IA au-dessus
   * du pli, est retiré : un point qui pulse annonce un service « en direct »,
   * et en monochrome le gris du mot « IA » disait « secondaire ».
   *
   * Le nombre de textes vient de l'API (`GET /corpus`), par les données de la
   * page (`$page.data.corpus`, posé par le `load` de l'accueil). Absent
   * (ancienne API, panne, `load` qui ne le lit pas encore), la phrase s'écrit
   * sans chiffre : un nombre écrit en dur vieillirait en silence.
   * `Intl.NumberFormat` sépare les milliers selon la langue : « 2 275 »
   * (espace fine insécable) en français, « 2,275 » en anglais.
   */
  $: totalDesTextes = nombreDeTextesDuCorpus($page.data?.corpus);
  $: nombreDeTextes = totalDesTextes === null ? "" : new Intl.NumberFormat($language.current).format(totalDesTextes);
  $: sousTitre =
    totalDesTextes === null
      ? $tr("accueil.sousTitreSansChiffre")
      : $tr("accueil.sousTitre").replace("{n}", nombreDeTextes);

  /**
   * Le même sous-titre en une ligne, pour l'écran court (téléphone en
   * paysage, `court:`) : « 2 275 textes officiels · l'assistant IA cite les
   * articles ». La phrase entière y prenait deux lignes de 18 px, et la barre
   * de recherche passait sous la ligne de flottaison ; elle était donc
   * retirée, et avec elle le nombre de textes et la garantie de l'IA, que Q1 A
   * place justement dans le sous-titre. Même repli sans chiffre.
   */
  $: sousTitreCourt =
    totalDesTextes === null
      ? $tr("accueil.sousTitreCourtSansChiffre")
      : $tr("accueil.sousTitreCourt").replace("{n}", nombreDeTextes);

  /**
   * Taille du titre ANGLAIS au téléphone : elle suit la largeur de la
   * colonne, pour que le titre tienne sur deux lignes comme le français
   * (Q1 A : deux lignes à 360 px). Audit r2, capture
   * accueil__390x844__light-en.
   *
   * « What does Cameroonian law say? » ne se coupe en deux lignes que d'une
   * façon : « What does / Cameroonian law say? ». La seconde ligne fait
   * 10,8 em, soit 388 px en 36 px, plus que la colonne (288 à 358 px, de 320
   * à 390 px de large). En 36 px, le titre prenait donc trois lignes
   * (« What does / Cameroonian / law say? ») et la barre de recherche
   * arrivait 42 px plus bas qu'en français.
   *
   * Sous sm, la taille vaut donc un 11,2e de la largeur de la colonne
   * (`100cqi` : le bloc du hero est déclaré conteneur, plus bas), soit 32 px
   * à 390, 29 px à 360 et 26 px à 320. Pourquoi 11,2 : la seconde ligne a
   * été mesurée dans Chromium à 10,79 em en Literata, 10,90 em dans son
   * repli Noto Serif et 10,76 em dans son repli Georgia (polices ajustées de
   * src/app.css, qui restent toute la visite quand Literata manque son
   * affichage) ; on y ajoute environ 3 % de marge pour l'arrondi des
   * avances. Mesures et réplique : data/ux-front/correctifs-r2-titre-en/ du
   * dépôt backend (deux lignes de 300 à 639 px dans les trois polices).
   * La taille ne dépasse jamais 36 px (Q1 A), atteints dès 435 px de large.
   * Elle ne descend pas sous 24 px, plancher atteint vers 300 px de large
   * (écran plié, fort zoom) : plus étroit encore, le titre repasse à trois
   * lignes plutôt que de rapetisser.
   *
   * Le français garde ses 36 px partout : sa plus longue ligne,
   * « camerounaise ? », ne fait que 7,5 em (272 px) et tient dès 320 px.
   * Navigateur sans unités de conteneur (Safari avant 16) : la déclaration y
   * est ignorée, et le titre anglais reste en 36 px sur trois lignes, comme
   * avant. Classe écrite en entier, pour que Tailwind la trouve.
   */
  const TITRE_ANGLAIS_AU_TELEPHONE = "max-sm:text-[length:clamp(1.5rem,100cqi/11.2,2.25rem)]";
  $: tailleDuTitreAuTelephone = $language.current === "en" ? TITRE_ANGLAIS_AU_TELEPHONE : "";

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
       passer de l'accueil au chat ne la recrée pas. Sans `variant` : l'en-tête
       a la même surface sur toutes les pages (fond et filet), accueil et chat
       compris ; la variante transparente le faisait changer d'aspect d'une
       page à l'autre. -->
  <div class={isChat ? "hidden lg:block shrink-0" : "contents"}>
    <SiteHeader />
  </div>

  <!--
    `overflow-x-clip` et non `overflow-hidden` : `hidden` faisait de <main> un
    conteneur de défilement, et tout élément `sticky` de la page collait à lui
    au lieu de l'écran. `clip` rogne sans créer de conteneur. `overflow-x-hidden`
    le précède comme repli, pour les navigateurs qui ignorent `clip` (Safari
    avant 16).

    Marges latérales : celles de l'en-tête (SiteHeader), 16 px, 24 px à
    partir de sm, 48 px à partir de lg, et au moins la zone sûre d'un iPhone
    en paysage. Le bord de la barre de recherche et de la liste des domaines
    tombe ainsi sous le logo. Elles valaient 16 puis 24 px à partir de md,
    plus 16 px du bloc du hero à partir de sm : le contenu commençait à 40 px
    en 768 et en 1 024, sous un logo à 24 puis à 48 px. Sur /chat, aucune
    marge sous sm : la conversation prend toute la largeur du téléphone.

    Marge haute : 32 px à partir de sm, plus celle du hero ci-dessous. Elle
    passait à 80 px à partir de md (`md:pt-20`) : avec le hero, 190 px de
    vide sous l'en-tête, et la barre de recherche sortait du premier écran
    en 1 024 × 768.
  -->
  <main
    id="contenu"
    class="relative flex w-full flex-col overflow-x-hidden overflow-x-clip {isChat
      ? 'min-h-0 flex-1 sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] lg:px-6 lg:pt-6'
      : 'flex-grow items-center justify-start pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 sm:pt-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 court:!pt-2'}"
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
         48 sur le blog ; la grille semblait finir sur un trou.
         Aucune marge latérale propre : celle de <main> suffit (voir plus
         haut), et la reprendre ici décalait le contenu de l'en-tête. -->
    <div
      class="relative flex w-full flex-col {isChat
        ? 'min-h-0 flex-1'
        : 'items-center px-0 pt-6 pb-8 sm:pt-10 sm:pb-12 md:pt-[min(3rem,5vh)] court:!pt-4'}"
    >
      {#if !isChat}
        <!--
          Hero traduisible. L'ancien et le nouveau texte se croisent dans la
          MÊME cellule de grille : empilés l'un sous l'autre le temps du fondu,
          ils doublaient la hauteur du hero et la page sautait à chaque
          changement de langue. Ce bloc et les onglets sont suivis par
          `surveillerHero` : le bouton flottant reste retiré tant qu'ils sont
          à l'écran.
          Le bloc est un conteneur de requête (`[container-type:inline-size]`,
          comme dans l'administration) : au téléphone, le titre anglais prend
          sa taille dans la largeur de ce bloc, celle de la colonne (`cqi`,
          voir TITRE_ANGLAIS_AU_TELEPHONE). Sans lui, `cqi` vaudrait la
          largeur de l'écran, marges comprises, et le titre serait trop
          grand pour deux lignes. Sans effet sur la mise en page : un
          conteneur calcule sa largeur sans son contenu, et celle de ce bloc
          vient déjà de `w-full`.
        -->
        <div class="grid w-full justify-items-center [container-type:inline-size]" use:surveillerHero>
          {#key $language.current}
            <div
              class="col-start-1 row-start-1 flex flex-col items-center w-full"
              in:fade={{ duration: duree(200), delay: duree(100) }}
              out:fade={{ duration: duree(150) }}
            >
              <!-- Titre de tâche (Q1 A), d'une seule couleur : il dit ce que
                   l'on obtient, et non la technologie. En Literata (Q5 A,
                   `font-titre` : instance figée en taille optique 72, graisse
                   600, d'où `font-semibold` ; interlettrage nul, donc jamais
                   `tracking-tight`). 36, 48 puis 56 px : deux lignes à 360 px
                   (« Que dit la loi / camerounaise ? »), une seule sur
                   ordinateur. `text-balance` équilibre les deux lignes au lieu
                   de laisser un mot seul sur la seconde.
                   `max-w-5xl` (1 024 px) et non `max-w-4xl` (896 px) : en
                   56 px, le titre anglais fait 898 à 903 px (775 en
                   français). Il passait sur deux lignes à 1 440 px, et la
                   barre de recherche descendait de 65 px. À partir de lg, la
                   colonne fait 928 px au moins : une ligne dans les deux
                   langues. Au téléphone, l'anglais tient aussi sur deux
                   lignes (« What does / Cameroonian law say? ») : sous
                   435 px de large, sa taille suit celle de la colonne
                   (`tailleDuTitreAuTelephone`, plus haut). En 36 px, il en
                   prenait trois.
                   Interligne de 1,15 posé AVEC chaque taille (`…/[1.15]`) :
                   `sm:text-5xl` apporte son interligne de 1, écrit dans sa
                   requête donc après un `leading-*` posé à part, qui ne
                   vaudrait plus qu'au téléphone. 1,15 : le bas de la
                   fourchette prévue par Q5 pour un titre en serif (1,15 à
                   1,25), qui garde deux lignes serrées à 360 px.
                   Sur écran court (téléphone en paysage), 36 px, et 8 px
                   dessous : le sous-titre d'une ligne suit (voir plus bas). -->
              <h1
                class="text-4xl/[1.15] {tailleDuTitreAuTelephone} sm:text-5xl/[1.15] lg:text-[3.5rem]/[1.15] court:!text-4xl/[1.15] font-titre font-semibold text-center text-zinc-950 dark:text-white mb-4 md:mb-6 court:!mb-2 max-w-5xl text-balance"
              >
                {$tr("accueil.titre")}
              </h1>

              <!-- Sous-titre : l'IA nommée une fois, avec sa garantie (voir
                   `sousTitre`). `text-balance` : sans lui, le dernier mot
                   restait seul sur sa ligne à 390 px.
                   Sur écran court, la version d'une ligne (`sousTitreCourt`),
                   en 14 px, 12 px au-dessus des onglets. La phrase entière
                   remplissait le hero sur 360 px de haut ; d'une ligne, elle
                   descend la barre de recherche de 24 px : à 740 × 360, la
                   barre finit vers 310 px, au-dessus de la ligne de
                   flottaison (mesuré sur une réplique dans Chromium,
                   data/ux-front/correctifs-r1-accueil/ du dépôt backend).
                   Une seule des deux versions est affichée, donc lue :
                   l'autre est en `display: none`. -->
              <p
                class="text-center text-zinc-600 dark:text-zinc-400 text-base sm:text-lg md:text-xl max-w-2xl mb-8 md:mb-10 leading-relaxed font-normal text-balance court:!mb-3 court:!text-sm/5"
              >
                <span class="court:hidden">{sousTitre}</span><span class="hidden court:inline">{sousTitreCourt}</span>
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
