<script lang="ts">
  /**
   * Barre de navigation du site public.
   *
   * POURQUOI CE COMPOSANT EXISTE. La coquille n'était rendue que par
   * `src/routes/(main)/+layout.svelte`, qui ne couvre que `/` et `/chat`. Cinq
   * pages sur onze n'avaient donc aucune navigation : `/laws` était un
   * cul-de-sac sans le moindre lien vers l'accueil, et `/login` ne contenait
   * pas un seul `<a>`. En parallèle, `/search` recopiait le header à la main,
   * et les deux copies avaient divergé.
   *
   * Les liens viennent de `$lib/nav`, source unique lue aussi par le pied de
   * page et par le test `tests/e2e/navigation/link-integrity.spec.ts`.
   */
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import { NAV_LINKS } from "$lib/nav";
  import { authStore } from "$lib/stores/auth";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import { themeStore } from "$lib/stores/theme";
  import { openCommandPalette } from "$lib/stores/commandPalette";
  import {
    PERSONA_ICONE,
    PERSONA_SLUG,
    ouvrirChoixPersona,
    personaStore,
  } from "$lib/stores/persona";
  import { prefersReducedMotion } from "svelte/motion";
  import { slide } from "svelte/transition";

  // Plus de prop `variant` : l'en-tête a la même surface sur toutes les pages
  // (voir le commentaire de <header>). `transparent` servait au groupe (main),
  // accueil et chat, où l'en-tête changeait d'aspect d'une page à l'autre ;
  // la prop était devenue sans effet, et (main)/+layout.svelte ne la passe
  // plus.

  /**
   * Volontairement faux par défaut : `/laws/[id]` a déjà un fil d'Ariane
   * `sticky top-0`, et deux éléments collants au même offset se superposent.
   */
  export let sticky: boolean = false;

  let mobileOpen = false;

  /**
   * La loupe de l'en-tête ouvre la palette (Ctrl K), qui n'existe qu'avec
   * JavaScript. Proposition P8 : la recherche doit marcher AVANT
   * l'hydratation (téléphone lent, réseau lent) et sans JavaScript du tout
   * (script bloqué, Opera Mini en mode Extreme). La loupe est donc un vrai
   * lien vers /search, qui marche partout ; une fois le composant monté, ce
   * même lien devient le bouton de la palette : rôle, nom et
   * `aria-haspopup` de bouton, et le clic ouvre la palette au lieu de suivre
   * le lien (`ouvrirLaPalette`). Même place, même dessin, même « Ctrl K » :
   * rien ne bouge à l'hydratation.
   *
   * Un seul élément, jamais remplacé. Un {#if} échangeait le lien contre un
   * <button> au montage : atteint au clavier ou au lecteur d'écran avant
   * l'hydratation, le lien sortait du document avec le focus, qui tombait
   * sur <body>, et la tabulation suivante repartait du haut de la page.
   * Le rendu serveur ne monte jamais rien : il envoie toujours le lien.
   */
  let paletteDisponible = false;
  onMount(() => (paletteDisponible = true));

  /**
   * Clic sur une loupe montée : la palette, sans quitter la page. Un clic
   * modifié (Ctrl, ⌘, Maj, Alt) garde le lien, /search dans un nouvel onglet
   * ou une nouvelle fenêtre, comme tout lien. Le gestionnaire n'existe
   * qu'après l'hydratation, dans la même passe que `onMount` : avant, le
   * lien suit son cours.
   */
  function ouvrirLaPalette(event: MouseEvent) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openCommandPalette();
  }

  // Espace, comme sur un <button> : un lien ne répond qu'à Entrée (qui passe
  // par le clic) ; sans ce relais, sous son rôle de bouton, Espace ferait
  // défiler la page au lieu d'ouvrir la palette. Le défilement est retenu à
  // l'appui, la palette s'ouvre au relâchement, comme pour un bouton :
  // maintenue, la touche ne tape pas d'espaces dans le champ de la palette.
  function retenirEspace(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
  }
  function ouvrirAuRelachement(event: KeyboardEvent) {
    if (event.key !== " ") return;
    event.preventDefault();
    openCommandPalette();
  }

  // Pas de prop `activePage` : l'état actif se dérive du chemin courant. Le
  // passer en prop obligerait chacune des huit pages appelantes à se nommer
  // elle-même — soit exactement la duplication que ce composant supprime.
  $: pathname = $page.url.pathname;

  $: isAdmin = ["admin", "superadmin"].includes($authStore.user?.role ?? "");

  // « Se connecter » et « Créer un compte » menant à la page courante : sur
  // /signup, le bouton plein de l'en-tête doublait celui de la carte (deux
  // boutons principaux pour la même action), et sur /login, « Se connecter »
  // n'avait ni `aria-current` ni état actif, contrairement aux liens de
  // navigation.
  $: surLaConnexion = pathname === "/login";
  $: surLInscription = pathname === "/signup";

  // Pages de compte : leur carte porte déjà le bouton principal de la page
  // (« Se connecter », « Envoyer le lien », « Demander un nouveau lien »…).
  // « Créer un compte » y devient un bouton secondaire bordé (guide § 4.4) :
  // plein, il disputait l'œil à ce bouton (en sombre, les deux seuls grands
  // blocs blancs de l'écran), et poussait même, sur /login, vers l'action
  // inverse de celle de la page.
  const PAGES_DE_COMPTE = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];
  $: surUnePageDeCompte = PAGES_DE_COMPTE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Couleurs de « Créer un compte », dans la barre comme dans le menu. Les
  // trois états ont la même bordure d'1 px (transparente sur le bouton
  // plein) : la boîte garde sa taille d'une page à l'autre, et rien ne bouge
  // autour. Sur /signup, la page courante est bordée de noir, comme dans le
  // menu : en texte nu, elle gardait le padding d'un bouton et s'arrêtait
  // 16 px avant le bord des autres pages.
  const INSCRIPTION_COURANTE =
    "border-zinc-950 bg-white text-zinc-950 dark:border-white dark:bg-zinc-900 dark:text-white";
  const INSCRIPTION_SECONDAIRE =
    "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white";
  const INSCRIPTION_PRINCIPALE =
    "border-transparent bg-zinc-950 text-white shadow-sm hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:shadow-none";
  $: couleursInscription = surLInscription
    ? INSCRIPTION_COURANTE
    : surUnePageDeCompte
      ? INSCRIPTION_SECONDAIRE
      : INSCRIPTION_PRINCIPALE;

  // Fermer le panneau après une navigation, sinon il masque la page d'arrivée.
  afterNavigate(() => (mobileOpen = false));

  // Le garde est dans le gestionnaire et non autour de <svelte:window> : Svelte
  // exige que cet élément soit à la racine du composant, jamais dans un bloc.
  function onKeydown(event: KeyboardEvent) {
    if (mobileOpen && event.key === "Escape") mobileOpen = false;
  }

  $: nomDuProfil = $personaStore.persona
    ? $tr(`persona.${PERSONA_SLUG[$personaStore.persona]}.nom`)
    : $tr("persona.general");
  $: libelleDuProfil = $tr("persona.toggleLabel").replace("{persona}", nomDuProfil);
  $: nomAffiche = $authStore.user?.name || $authStore.user?.email;

  function logout() {
    authStore.logout();
    mobileOpen = false;
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- Lien d'evitement : au clavier, atteindre le contenu demandait de traverser
     le logo, les quatre liens de navigation, la bascule de langue, celle du
     theme et la grappe d'authentification — a chaque page. -->
<a
  href="#contenu"
  class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-zinc-950 focus:px-4 focus:py-2 focus:font-semibold focus:text-white dark:focus:bg-white dark:focus:text-zinc-950"
  >{$tr("a11y.skipToContent")}</a
>

<!--
  Trois barres selon la largeur.
  - Sous lg : logo, loupe et menu ; le panneau du menu porte les liens, les
    réglages et le compte.
  - De lg à xl : les liens rejoignent la barre, les réglages et le compte
    restent dans le menu. À 1 024 px, la barre laissait 750 px vides entre
    le logo et la loupe ; les six liens (470 px en français) y tiennent avec
    plus de 200 px de chaque côté. La barre COMPLÈTE, elle, n'y tient pas :
    1 023 px de contenu en français pour 928 disponibles, « Créer un compte »
    coupé et la page qui glissait de côté (mesuré le 2026-10-28,
    tests/e2e/navigation/redimensionnement.spec.ts). Le bouton du menu y
    change de rôle, donc de `data-testid` : il n'ouvre plus la navigation
    (`nav-mobile-toggle`, sous lg) mais les réglages et le compte
    (`nav-reglages-toggle`). Une seule navigation à l'écran, ce que vérifie
    ce même test.
  - À partir de xl : la barre complète.

  À partir de lg, les liens suivent le logo, à 32 px, et les actions se
  rangent à droite. Une grille `1fr auto 1fr` les centrait sur l'axe de la
  page, mais de lg à xl seulement : dans la barre complète, les actions (530
  à 780 px selon la session, la langue et le profil) dépassent leur moitié
  jusqu'au-delà de 1 920 px, et les liens glissaient vers la gauche jusqu'à
  se coller aux réglages. En 1 440, déconnecté : 213 px depuis le logo, 36
  jusqu'à la loupe, et un centre à 594 px au lieu de 720, au-dessus d'une
  carte et d'un pied de page centrés (relevé r3). Presque centrée, la
  navigation paraissait décentrée par erreur ; alignée sur le logo, elle ne
  prétend plus l'être, et elle ne bouge plus quand la session, la langue ou
  le profil changent la largeur des actions. Les écarts minimaux restent
  ceux de la grille (24 px de part et d'autre), plus 8 px après le logo et
  8 avant les actions (`xl:pl-2`).
  Ni les liens ni les actions ne rétrécissent (`shrink-0`), sauf le nom de
  l'utilisateur : un bouton écrasé tombait à 22 px de large.

  Au-dessus de xl, la barre se compacte par paliers, calculés sur les
  libellés français (les plus longs) et sur le pire cas, un administrateur
  connecté, qui débordait de 1 280 à 1 640 px :
  - xl : loupe seule pour la palette, « Profil » à côté de son icône,
    « Administration » réduite à son icône ;
  - 2xl : libellé de la palette et « Ctrl K », nom du profil, liens espacés
    de 28 px ;
  - 1 800 px : « Administration » en toutes lettres, liens espacés de 32 px.
  Le nom de l'utilisateur, lui, prend la place que laisse la barre, 10rem au
  plus, et ne se tronque que quand elle manque (voir le bloc des actions).
  Les réglages sont en 14 px, comme les liens : en 12 px, « Profil » et
  « EN » paraissaient plus petits et plus pâles que leurs voisins. Ce gain
  a coûté 24 px en 2xl, repris sur l'écart des liens (32 px jusque-là).
  Au plus serré (remesuré le 2026-10-29 sur une réplique de la barre dans
  Chromium, data/ux-front/correctifs-r1-accueil/ du dépôt backend) : un
  administrateur, en français, en 1 536 px, avec « Avocat ou juriste », le
  plus large des profils français. Avec l'ancien plafond du nom (7rem), il
  restait 31 px entre le dernier lien et la loupe. Sans plafond fixe, le
  nom prend tout ce qui dépasse 32 px (`xl:pl-2`, plus bas) : 111 px dans
  ce cas, et « Administration JuriX » en entier dès 1 366 px.

  Marges latérales : 16 px, 24 px à partir de sm, 48 px à partir de lg, et au
  moins la zone sûre (encoche d'un iPhone en paysage, `viewport-fit=cover`).

  Écran court (`court:`, téléphone en paysage) : 8 px au-dessus et au-dessous
  des boutons de 44 px, et non les 16 px de sm. La barre en prenait 77 sur
  360 : sur les pages de compte, le bouton d'envoi tombait sous l'écran.

  Surface : la même sur toutes les pages, fond blanc (fond de page en sombre)
  et filet zinc-200 (zinc-800) en bas, comme le pied du site (SiteFooter)
  l'a en haut. L'accueil et le chat avaient un en-tête transparent sans
  filet, les autres pages cette barre : l'en-tête changeait d'aspect d'une
  page à l'autre, d'un pixel de hauteur aussi (le filet), et sur l'accueil
  il ne répondait plus au pied blanc de la même page. Le panneau du menu,
  blanc lui aussi, prolonge maintenant l'en-tête partout, accueil compris.
-->
<header
  data-testid="site-header"
  class="relative z-50 flex w-full items-center justify-between gap-4 border-b border-zinc-200 bg-white py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] dark:border-zinc-800 dark:bg-background-dark sm:py-4 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:justify-start lg:gap-6 lg:px-12 court:py-2
    {sticky ? 'sticky top-0' : ''}"
>
  <!-- Logo. Le lien n'occupe que le logo, et non toute la colonne : étiré
       jusqu'au bouton du menu, un appui juste à côté de celui-ci ramenait à
       l'accueil. 44 px de haut sous xl, comme les boutons voisins (la tuile
       seule n'en fait que 36) ; sans effet sur la hauteur de la barre, que
       ces boutons fixent déjà. À partir de lg, le bloc prend la largeur du
       logo seulement : les liens le suivent. -->
  <div class="flex flex-1 items-center lg:flex-none">
    <a href="/" data-testid="site-logo" class="flex min-h-11 items-center gap-2.5 rounded-xl group xl:min-h-0">
      <div
        class="bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm dark:shadow-none motion-safe:group-hover:scale-105 transition-transform duration-200"
      >
        <Icone nom="scale" class="text-lg" />
      </div>
      <span class="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white"
        >JuriX</span
      >
    </a>
  </div>

  <!-- Navigation (à partir de lg). « Accueil » n'y est plus retiré sous xl :
       la barre a la place, et sans lui, aucun lien ne portait l'état actif
       sur l'accueil. Liens de 44 px de haut jusqu'à xl, comme les boutons
       voisins : une tablette en paysage s'en sert au doigt. -->
  <nav
    class="hidden shrink-0 lg:ml-2 lg:flex items-center gap-6 2xl:gap-7 min-[1800px]:gap-8 text-sm font-medium text-secondary-text-light dark:text-secondary-text-dark"
  >
    {#each NAV_LINKS as lien (lien.href)}
      <!-- L'état actif n'était signalé QUE par la couleur : invisible aux
           lecteurs d'écran, et invisible tout court pour qui ne distinguait
           pas le bleu d'alors du gris environnant. `aria-current` le dit aux
           premiers ; la graisse, en plus du noir, le montre aux seconds.
           Chaque lien réserve la largeur de son libellé en demi-gras : un
           `::after` sans hauteur le recopie depuis `data-libelle`, et la
           colonne flex prend la largeur du plus large des deux, où elle
           centre le libellé. Sans lui, le lien actif s'élargissait de 3 à
           4 px, et ses voisins glissaient d'autant à chaque navigation
           (« Blog » à 351 px sur l'accueil, à 355 sur /laws). Invisible
           (`visibility: hidden`), la copie ne compte ni dans le nom
           accessible ni dans le texte du lien. -->
      <a
        aria-current={lien.isActive(pathname) ? "page" : undefined}
        data-libelle={$tr(lien.key)}
        class="flex min-h-11 flex-col items-center justify-center whitespace-nowrap transition-colors after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-libelle)] hover:text-zinc-950 dark:hover:text-white xl:min-h-0 {lien.isActive(
          pathname,
        )
          ? 'text-zinc-950 dark:text-white font-semibold'
          : 'text-zinc-500 dark:text-zinc-400'}"
        href={lien.href}>{$tr(lien.key)}</a
      >
    {/each}
  </nav>

  <!--
    Actions (bureau). Un seul traitement pour les réglages (palette, langue,
    thème, profil) : des boutons discrets de 36 px (guide § 4.4), icônes de
    18 px. La loupe était une tuile grise bordée, la langue une pastille sur
    piste, le thème et le profil des icônes nues : trois traitements côte à
    côte. Un filet sépare ensuite ces réglages du compte.

    Libellés en 14 px et un seul gris au repos, zinc-500 (zinc-400 en
    sombre), celui des liens de navigation (guide § 4.7) : la langue et le
    profil étaient en 12 px, le profil et « Se connecter » en zinc-600, trois
    tailles et deux gris pour des éléments de même rang.

    Seul le nom de l'utilisateur cède de la place. Le bloc peut rétrécir
    (`min-w-0`), mais chacun de ses éléments est en `shrink-0`, sauf le bloc
    du compte (`min-w-0`), où seul le nom peut rétrécir (`truncate`). Le nom
    prend donc la place que laissent les liens, jusqu'à 10rem, et ne se
    tronque que quand elle manque. Il avait un plafond fixe par palier, réglé
    quand la navigation était centrée (5rem pour un administrateur sous
    2xl) : à 1 440 px, « Administration JuriX » s'arrêtait sur
    « Administr… » à côté de 207 px vides. Mesuré sur la réplique (voir plus
    haut), de 1 280 à 1 920 px, en français et en anglais, administrateur,
    membre ou visiteur : rien ne déborde, aucun bouton n'est écrasé, et le
    nom est au moins aussi large qu'avec l'ancien plafond, à 1 px près au
    plus serré.
    Le reste ne rétrécit jamais : en `flex-1`, comme le logo et les liens
    d'alors, tout le bloc était ramené à sa largeur minimale dès que son
    contenu dépassait le tiers de la barre ; à 1 536 px, le bouton du thème
    tombait à 22 px et un libellé pouvait passer sur deux lignes.
    `ml-auto` le range contre le bord droit, quelle que soit sa largeur.
    `xl:pl-2` : quand le nom prend toute la place, 32 px restent entre le
    dernier lien et la loupe (24 px d'écart, plus ces 8), et les deux
    groupes ne se lisent pas comme une seule rangée.
  -->
  <div class="hidden min-w-0 xl:ml-auto xl:flex items-center justify-end gap-1 xl:pl-2">
    <!-- Raccourci : « Ctrl K », comme dans la barre de recherche de
         l'accueil et dans l'étiquette du bouton (« ⌘K » ne parlait qu'aux
         Mac ; la palette répond à Ctrl comme à ⌘). Un lien vers /search,
         bouton de la palette une fois monté (`paletteDisponible`).
         `data-sveltekit-preload-data="off"` : sans lui, survolée ou
         touchée, la loupe ferait précharger les données de /search (le
         préchargement au survol du <body>), qu'un clic n'ouvre plus.
         `shrink-0` : dans la barre complète, seul le nom de l'utilisateur
         cède de la place (voir le bloc des actions). -->
    <a
      href="/search"
      data-sveltekit-preload-data="off"
      role={paletteDisponible ? "button" : undefined}
      aria-haspopup={paletteDisponible ? "dialog" : undefined}
      aria-label={paletteDisponible ? $tr("palette.openWithShortcut") : $tr("entete.pageDeRecherche")}
      title={paletteDisponible ? $tr("palette.openWithShortcut") : undefined}
      on:click={ouvrirLaPalette}
      on:keydown={retenirEspace}
      on:keyup={ouvrirAuRelachement}
      class="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
    >
      <Icone nom="search" class="text-lg" />
      <span class="hidden 2xl:inline">{$tr("nav.search")}</span>
      <kbd class="hidden 2xl:inline whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400">Ctrl K</kbd>
    </a>

    <!-- Langue : la langue active en noir et en demi-gras, l'autre en
         zinc-500, comme le lien de la page courante et ses voisins. Les deux
         boutons gardent 36 px de large quelle que soit la graisse : rien ne
         bouge quand la langue change. -->
    <div class="flex shrink-0 items-center">
      <button
        on:click={() => switchLanguage("fr")}
        data-testid="lang-fr"
        aria-label="{$tr('a11y.switchTo')} français"
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm transition-colors {$language.current ===
        'fr'
          ? 'font-semibold text-zinc-950 dark:text-white'
          : 'font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}"
        >FR</button
      >
      <span class="h-3.5 w-px bg-zinc-300 dark:bg-zinc-700" aria-hidden="true"></span>
      <button
        on:click={() => switchLanguage("en")}
        data-testid="lang-en"
        aria-label="{$tr('a11y.switchTo')} English"
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm transition-colors {$language.current ===
        'en'
          ? 'font-semibold text-zinc-950 dark:text-white'
          : 'font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}"
        >EN</button
      >
    </div>

    <button
      on:click={themeStore.toggle}
      data-testid="theme-toggle"
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
      aria-label={$tr("a11y.toggleTheme")}
    >
      <!-- Les deux icônes, alternées en CSS par la classe `dark` que pose
           app.html avant le premier affichage. Le serveur ne connaît pas le
           thème choisi (localStorage) : un {#if} sur le store dessinait la lune,
           puis la remplaçait par le soleil à l'hydratation. -->
      <Icone nom="moon" class="text-lg dark:hidden" />
      <Icone nom="sun" class="text-lg hidden dark:inline-block" />
    </button>

    <!-- Le profil, avec un libellé visible : son icône seule (une personne
         pour « Citoyen »), juste avant « Se connecter », passait pour le
         bouton du compte. « Profil » sous 2xl, le nom du profil au-delà ;
         l'étiquette accessible et l'infobulle donnent les deux. -->
    <button
      on:click={() => ouvrirChoixPersona()}
      data-testid="persona-toggle"
      aria-haspopup="dialog"
      aria-label={libelleDuProfil}
      title={libelleDuProfil}
      class="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
    >
      <Icone nom={PERSONA_ICONE[$personaStore.persona ?? "general"]} class="text-lg" />
      <span class="2xl:hidden">{$tr("persona.chatLabel")}</span>
      <span class="hidden 2xl:inline">{nomDuProfil}</span>
    </button>

    <!-- `shrink-0` : vide, ce filet pouvait sinon tomber à 0 px. -->
    <span class="mx-1.5 h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true"></span>

    <!--
      Bloc réactif : « Se connecter / Créer un compte » quand la session est
      vide, le nom de l'utilisateur et « Se déconnecter » sinon.

      `/signup` existe désormais vraiment — `POST /api/v1/auth/signup` —, après
      avoir été un lien mort que le spec `link-integrity` avait été écrit pour
      attraper. Le nom affiché donne enfin un signe visible que la session est
      ouverte : jusqu'ici, un utilisateur connecté ne voyait qu'un bouton de
      déconnexion.
    -->
    <div class="flex min-w-0 items-center gap-3">
      {#if $authStore.isAuthenticated}
        {#if isAdmin}
          <!-- Icône seule sous 1 800 px : le libellé « Administration »
               faisait à lui seul déborder la barre d'un administrateur à
               1 280 px, puis de 1 536 à 1 640 px une fois la palette ajoutée.
               L'étiquette accessible et l'infobulle gardent le mot. Bouton
               secondaire (bordé), comme dans le panneau mobile : à côté de
               « Se déconnecter », deux boutons pleins se disputaient l'œil. -->
          <a
            class="inline-flex shrink-0 items-center px-2 min-[1800px]:px-5 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white"
            href="/admin"
            aria-label={$tr("nav.admin")}
            title={$tr("nav.admin")}
          >
            <Icone nom="shield-user" class="text-lg min-[1800px]:hidden" />
            <span class="hidden min-[1800px]:inline">{$tr("nav.admin")}</span>
          </a>
        {/if}
        {#if nomAffiche}
          <!-- Le nom reste affiché dès xl : c'est le signe visible que la
               session est ouverte (tests/e2e/navigation/inscription.spec.ts).
               Il prend la place libre, jusqu'à 10rem, et se tronque par
               « … » quand elle manque : le seul élément de la barre qui
               rétrécit (`min-w-0`, voir le bloc des actions). Plus de
               plafond par palier ni par rôle : celui d'un administrateur
               (5rem) le coupait en « Administr… » à 1 440 px. -->
          <span
            data-testid="user-name"
            class="hidden min-w-0 xl:block truncate text-sm font-medium text-zinc-600 dark:text-zinc-300 max-w-[10rem]"
            title={$authStore.user?.email}
            >{nomAffiche}</span
          >
        {/if}
        <button
          on:click={logout}
          data-testid="logout"
          class="shrink-0 px-3 xl:px-4 2xl:px-5 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm dark:shadow-none whitespace-nowrap bg-zinc-950 text-white hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >{$tr("nav.logout")}</button
        >
      {:else}
        <!-- Lien de la page courante : `aria-current` et le noir des liens
             actifs de la navigation ; au repos, le gris des réglages.
             « Créer un compte » : bouton plein, sauf sur les pages de compte,
             dont la carte porte le bouton principal (`couleursInscription`).
             36 px de haut, bordure comprise, comme les boutons voisins. -->
        <a
          aria-current={surLaConnexion ? "page" : undefined}
          class="shrink-0 px-3 xl:px-4 2xl:px-5 py-2 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap {surLaConnexion
            ? 'text-zinc-950 dark:text-white'
            : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}"
          href="/login">{$tr("nav.login")}</a
        >
        <a
          data-testid="nav-signup"
          aria-current={surLInscription ? "page" : undefined}
          class="inline-flex h-9 shrink-0 items-center rounded-xl border px-3 xl:px-4 2xl:px-5 text-sm font-semibold transition-colors whitespace-nowrap {couleursInscription}"
          href="/signup">{$tr("nav.signup")}</a
        >
      {/if}
    </div>
  </div>

  <!-- Bascule mobile. 44 px de côté ; la marge négative aligne l'icône sur le
       bord du contenu sans réduire la zone d'appui. Deux boutons pour le
       même panneau, un seul affiché : sous lg, le menu complet ; de lg à xl,
       les réglages et le compte (voir le commentaire de la barre). À partir
       de lg, le gris des liens voisins. -->
  <div class="flex xl:hidden flex-1 justify-end items-center gap-1">
    <!-- Loupe : un lien vers /search, bouton de la palette une fois le
         composant monté (`paletteDisponible`), comme celle du bureau. Sous
         lg, c'est le seul accès à la recherche qui ne demande pas d'ouvrir
         le menu, lui-même en JavaScript. -->
    <a
      href="/search"
      data-sveltekit-preload-data="off"
      role={paletteDisponible ? "button" : undefined}
      aria-haspopup={paletteDisponible ? "dialog" : undefined}
      aria-label={paletteDisponible ? $tr("palette.open") : $tr("entete.pageDeRecherche")}
      on:click={ouvrirLaPalette}
      on:keydown={retenirEspace}
      on:keyup={ouvrirAuRelachement}
      class="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 lg:text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
    >
      <Icone nom="search" class="text-2xl" />
    </a>
    <button
      on:click={() => (mobileOpen = !mobileOpen)}
      data-testid="nav-mobile-toggle"
      aria-expanded={mobileOpen}
      aria-controls="site-nav-mobile"
      aria-label={$tr("a11y.menu")}
      class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors lg:hidden"
    >
      <Icone nom={mobileOpen ? "x" : "menu"} class="text-2xl" />
    </button>
    <button
      on:click={() => (mobileOpen = !mobileOpen)}
      data-testid="nav-reglages-toggle"
      aria-expanded={mobileOpen}
      aria-controls="site-nav-mobile"
      aria-label={$tr("a11y.menu")}
      class="-mr-2 hidden h-11 w-11 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors lg:inline-flex"
    >
      <Icone nom={mobileOpen ? "x" : "menu"} class="text-2xl" />
    </button>
  </div>
</header>

<!--
  Le bouton mobile n'avait aucun `on:click` : sous lg, la navigation, le choix
  de langue, le thème et la connexion étaient tous inaccessibles. Le panneau
  reprend donc ces quatre familles de contrôles, pas seulement les liens.

  z-50 : au-dessus du bouton flottant de l'assistant (z-40), qui recouvrait
  « Créer un compte » sur un téléphone en paysage. Il s'ouvre en glissant
  (sauf mouvement réduit) et se ferme d'un coup : après une navigation, la
  page d'arrivée s'affiche sans attendre qu'il se replie.

  De lg à xl, les liens sont dans la barre : le panneau ne garde que les
  réglages et le compte, sans le filet qui les séparait des liens.
-->
{#if mobileOpen}
  <div
    id="site-nav-mobile"
    data-testid="nav-mobile-panel"
    class="xl:hidden relative z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-background-dark py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12"
    in:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}
  >
    <nav class="flex flex-col lg:hidden">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          aria-current={lien.isActive(pathname) ? "page" : undefined}
          class="-mx-2 flex min-h-11 items-center rounded-xl px-2 py-3 text-base transition-colors active:bg-zinc-100 dark:active:bg-zinc-800/60 {lien.isActive(
            pathname,
          )
            ? 'font-semibold text-zinc-950 dark:text-white'
            : 'font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}">{$tr(lien.key)}</a
        >
      {/each}
    </nav>

    <!--
      Deux rangées et non une : réglages, puis compte. Sur une seule ligne,
      FR, EN, thème, profil, « Se connecter » et « Créer un compte » faisaient
      environ 350 px, contre 312 disponibles à 360 px : la page glissait de
      côté et le dernier bouton était coupé.
    -->
    <div class="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800 lg:mt-0 lg:border-t-0 lg:pt-0">
      <div class="flex flex-wrap items-center gap-2">
        <button
          on:click={() => switchLanguage("fr")}
          data-testid="lang-fr-mobile"
          aria-label="{$tr('a11y.switchTo')} français"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-bold transition-colors {$language.current ===
          'fr'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm dark:shadow-none'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}">FR</button
        >
        <button
          on:click={() => switchLanguage("en")}
          data-testid="lang-en-mobile"
          aria-label="{$tr('a11y.switchTo')} English"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-bold transition-colors {$language.current ===
          'en'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm dark:shadow-none'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}">EN</button
        >
        <button
          on:click={themeStore.toggle}
          data-testid="theme-toggle-mobile"
          aria-label={$tr("a11y.toggleTheme")}
          class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
        >
          <Icone nom="moon" class="text-xl dark:hidden" />
          <Icone nom="sun" class="text-xl hidden dark:inline-block" />
        </button>
        <!-- « Profil » visible, comme sur le bureau : l'icône seule (une
             personne pour « Citoyen »), posée juste au-dessus de « Se
             connecter », passait ici aussi pour le bouton du compte.
             L'étiquette accessible, qui contient « profil », nomme en plus le
             profil actuel. -->
        <button
          on:click={() => ouvrirChoixPersona()}
          data-testid="persona-toggle-mobile"
          aria-haspopup="dialog"
          aria-label={libelleDuProfil}
          class="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
        >
          <Icone nom={PERSONA_ICONE[$personaStore.persona ?? "general"]} class="text-xl" />
          <span>{$tr("persona.chatLabel")}</span>
        </button>
      </div>

      {#if $authStore.isAuthenticated}
        <div class="grid grid-cols-2 gap-2">
          {#if nomAffiche}
            <p
              data-testid="user-name-mobile"
              class="col-span-2 truncate text-sm font-medium text-zinc-600 dark:text-zinc-300"
              title={$authStore.user?.email}
            >
              {nomAffiche}
            </p>
          {/if}
          {#if isAdmin}
            <a
              href="/admin"
              class="flex h-11 items-center justify-center whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
              >{$tr("nav.admin")}</a
            >
          {/if}
          <button
            on:click={logout}
            data-testid="logout-mobile"
            class="flex h-11 items-center justify-center whitespace-nowrap rounded-xl bg-zinc-950 px-2 text-sm font-semibold text-white transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 {isAdmin
              ? ''
              : 'col-span-2'}">{$tr("nav.logout")}</button
          >
        </div>
      {:else}
        <!-- Comme sur le bureau : la page courante porte `aria-current`, en
             bouton bordé au contour noir ; sur une page de compte, « Créer un
             compte » n'est plus un second bouton plein au-dessus de celui de
             la carte (`couleursInscription`). -->
        <div class="grid grid-cols-2 gap-2">
          <a
            href="/login"
            aria-current={surLaConnexion ? "page" : undefined}
            class="flex h-11 items-center justify-center whitespace-nowrap rounded-xl border bg-white px-2 text-sm font-semibold transition-colors dark:bg-zinc-900 {surLaConnexion
              ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
              : 'border-zinc-300 text-zinc-800 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white'}"
            >{$tr("nav.login")}</a
          >
          <a
            href="/signup"
            data-testid="nav-signup-mobile"
            aria-current={surLInscription ? "page" : undefined}
            class="flex h-11 items-center justify-center whitespace-nowrap rounded-xl border px-2 text-sm font-semibold transition-colors {couleursInscription}"
            >{$tr("nav.signup")}</a
          >
        </div>
      {/if}
    </div>
  </div>
{/if}
