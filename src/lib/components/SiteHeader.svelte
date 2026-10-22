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
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import { NAV_LINKS } from "$lib/nav";
  import { authStore } from "$lib/stores/auth";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import { themeStore } from "$lib/stores/theme";
  import {
    PERSONA_ICONE,
    PERSONA_SLUG,
    ouvrirChoixPersona,
    personaStore,
  } from "$lib/stores/persona";
  import { prefersReducedMotion } from "svelte/motion";
  import { slide } from "svelte/transition";

  /**
   * `transparent` pour le groupe (main), dont le header flotte au-dessus du
   * dégradé ; `solid` partout ailleurs, sur fond de page.
   */
  export let variant: "transparent" | "solid" = "solid";

  /**
   * Volontairement faux par défaut : `/laws/[id]` a déjà un fil d'Ariane
   * `sticky top-0`, et deux éléments collants au même offset se superposent.
   */
  export let sticky: boolean = false;

  let mobileOpen = false;

  // Pas de prop `activePage` : l'état actif se dérive du chemin courant. Le
  // passer en prop obligerait chacune des huit pages appelantes à se nommer
  // elle-même — soit exactement la duplication que ce composant supprime.
  $: pathname = $page.url.pathname;

  $: isAdmin = ["admin", "superadmin"].includes($authStore.user?.role ?? "");

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
  class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
  >{$tr("a11y.skipToContent")}</a
>

<!--
  Bascule bureau/mobile à lg (1 024 px), et non plus md : de 768 à 1 240 px,
  la barre complète était plus large que l'écran et toute la page glissait de
  côté. Au-dessus de lg, elle se compacte par paliers, calculés sur les
  libellés français (les plus longs) et sur le pire cas, un administrateur
  connecté :
  - lg : « Accueil » masqué (le logo y mène déjà), boutons resserrés, nom de
    l'utilisateur masqué, « Administration » réduit à son icône ;
  - xl : « Accueil » et le nom (tronqué) reviennent ;
  - 2xl : libellés complets (profil, « Administration »).

  Marges latérales : 16 px, 24 px à partir de sm, 48 px à partir de lg, et au
  moins la zone sûre (encoche d'un iPhone en paysage, `viewport-fit=cover`).
-->
<header
  data-testid="site-header"
  class="relative z-50 flex w-full items-center justify-between gap-4 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:py-4 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 xl:gap-6
    {variant === 'transparent'
    ? 'bg-transparent'
    : 'bg-white dark:bg-background-dark border-b border-gray-200 dark:border-white/10'}
    {sticky ? 'sticky top-0' : ''}"
>
  <!-- Logo. Le lien n'occupe que le logo, et non toute la colonne : étiré
       jusqu'au bouton du menu, un appui juste à côté de celui-ci ramenait à
       l'accueil. -->
  <div class="flex flex-1 items-center">
    <a href="/" data-testid="site-logo" class="flex items-center gap-3 rounded-xl">
      <div
        class="bg-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30"
      >
        <span class="material-icons text-white text-xl" aria-hidden="true">balance</span>
      </div>
      <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >JuriX</span
      >
    </a>
  </div>

  <!-- Navigation (bureau) -->
  <nav
    class="hidden lg:flex items-center justify-center gap-4 xl:gap-6 2xl:gap-8 text-sm font-medium text-secondary-text-light dark:text-secondary-text-dark flex-1"
  >
    {#each NAV_LINKS as lien (lien.href)}
      <!-- L'etat actif n'etait signale QUE par la couleur : invisible aux
           lecteurs d'ecran, et invisible tout court pour qui ne distingue pas
           ce bleu du gris environnant. -->
      <a
        aria-current={lien.isActive(pathname) ? "page" : undefined}
        class="hover:text-primary transition-colors whitespace-nowrap {lien.href === '/'
          ? 'hidden xl:inline'
          : ''} {lien.isActive(pathname) ? 'text-primary' : ''}"
        href={lien.href}>{$tr(lien.key)}</a
      >
    {/each}
  </nav>

  <!-- Actions (bureau) -->
  <div class="hidden lg:flex items-center justify-end gap-2 xl:gap-3 flex-1">
    <div class="hidden xl:block h-4 w-px bg-white/10 mx-2"></div>

    <div
      class="relative flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg"
    >
      <div
        class="sliding-pill absolute top-1 bottom-1 w-10 rounded-md bg-white dark:bg-white/10 shadow-sm"
        class:translate-x-0={$language.current === "fr"}
        class:translate-x-full={$language.current === "en"}
      ></div>
      <button
        on:click={() => switchLanguage("fr")}
        data-testid="lang-fr"
          aria-label="{$tr('a11y.switchTo')} français"
        class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
        'fr'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
        >FR</button
      >
      <button
        on:click={() => switchLanguage("en")}
        data-testid="lang-en"
          aria-label="{$tr('a11y.switchTo')} English"
        class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
        'en'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
        >EN</button
      >
    </div>

    <button
      on:click={themeStore.toggle}
      data-testid="theme-toggle"
      class="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
      aria-label={$tr("a11y.toggleTheme")}
    >
      <!-- Les deux icônes, alternées en CSS par la classe `dark` que pose
           app.html avant le premier affichage. Le serveur ne connaît pas le
           thème choisi (localStorage) : un {#if} sur le store dessinait la lune,
           puis la remplaçait par le soleil à l'hydratation. -->
      <span class="material-icons text-lg dark:hidden" aria-hidden="true">dark_mode</span>
      <span class="material-icons text-lg hidden dark:inline-block" aria-hidden="true">light_mode</span>
    </button>

    <!-- Le profil : icône seule sous 2xl, où la barre est déjà chargée ; le
         nom complet reste dans l'étiquette accessible. -->
    <button
      on:click={() => ouvrirChoixPersona()}
      data-testid="persona-toggle"
      aria-haspopup="dialog"
      aria-label={libelleDuProfil}
      class="h-8 px-2 flex items-center gap-1 rounded-lg bg-transparent dark:bg-white/5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
    >
      <span class="material-icons text-lg" aria-hidden="true"
        >{PERSONA_ICONE[$personaStore.persona ?? "general"]}</span
      >
      <span class="hidden 2xl:inline text-xs font-semibold">{nomDuProfil}</span>
    </button>

    <!--
      Bloc réactif : « Se connecter / Créer un compte » quand la session est
      vide, le nom de l'utilisateur et « Se déconnecter » sinon.

      `/signup` existe désormais vraiment — `POST /api/v1/auth/signup` —, après
      avoir été un lien mort que le spec `link-integrity` avait été écrit pour
      attraper. Le nom affiché donne enfin un signe visible que la session est
      ouverte : jusqu'ici, un utilisateur connecté ne voyait qu'un bouton de
      déconnexion.
    -->
    <div class="flex items-center gap-2 xl:gap-3 ml-1 xl:ml-2">
      {#if $authStore.isAuthenticated}
        {#if isAdmin}
          <!-- Icône seule sous 2xl : le libellé « Administration » faisait à
               lui seul déborder la barre d'un administrateur à 1 280 px.
               L'étiquette accessible et l'infobulle gardent le mot. -->
          <a
            class="inline-flex items-center px-2 2xl:px-5 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap bg-white text-blue-600 hover:bg-gray-50 border border-transparent shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-blue-400 dark:hover:bg-white/10"
            href="/admin"
            aria-label={$tr("nav.admin")}
            title={$tr("nav.admin")}
          >
            <span class="material-icons text-lg leading-5 2xl:hidden" aria-hidden="true"
              >admin_panel_settings</span
            >
            <span class="hidden 2xl:inline">{$tr("nav.admin")}</span>
          </a>
        {/if}
        {#if nomAffiche}
          <span
            data-testid="user-name"
            class="hidden xl:block max-w-[8rem] 2xl:max-w-[10rem] truncate text-sm font-medium text-slate-600 dark:text-slate-300"
            title={$authStore.user?.email}
            >{nomAffiche}</span
          >
        {/if}
        <button
          on:click={logout}
          data-testid="logout"
          class="px-3 xl:px-4 2xl:px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          >{$tr("nav.logout")}</button
        >
      {:else}
        <a
          class="px-3 xl:px-4 2xl:px-5 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          href="/login">{$tr("nav.login")}</a
        >
        <a
          data-testid="nav-signup"
          class="px-3 xl:px-4 2xl:px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          href="/signup">{$tr("nav.signup")}</a
        >
      {/if}
    </div>
  </div>

  <!-- Bascule mobile. 44 px de côté ; la marge négative aligne l'icône sur le
       bord du contenu sans réduire la zone d'appui. -->
  <div class="flex lg:hidden flex-1 justify-end">
    <button
      on:click={() => (mobileOpen = !mobileOpen)}
      data-testid="nav-mobile-toggle"
      aria-expanded={mobileOpen}
      aria-controls="site-nav-mobile"
      aria-label={$tr("a11y.menu")}
      class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
    >
      <span class="material-icons" aria-hidden="true">{mobileOpen ? "close" : "menu"}</span>
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
-->
{#if mobileOpen}
  <div
    id="site-nav-mobile"
    data-testid="nav-mobile-panel"
    class="lg:hidden relative z-50 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-background-dark py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]"
    in:slide={{ duration: prefersReducedMotion.current ? 0 : 200 }}
  >
    <nav class="flex flex-col">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          aria-current={lien.isActive(pathname) ? "page" : undefined}
          class="-mx-2 flex min-h-11 items-center rounded-lg px-2 py-3 text-base font-medium transition-colors active:bg-slate-100 dark:active:bg-white/5 {lien.isActive(
            pathname,
          )
            ? 'text-primary'
            : 'text-slate-700 dark:text-slate-200'}">{$tr(lien.key)}</a
        >
      {/each}
    </nav>

    <!--
      Deux rangées et non une : réglages, puis compte. Sur une seule ligne,
      FR, EN, thème, profil, « Se connecter » et « Créer un compte » faisaient
      environ 350 px, contre 312 disponibles à 360 px : la page glissait de
      côté et le dernier bouton était coupé.
    -->
    <div class="mt-3 flex flex-col gap-3 border-t border-gray-200 pt-3 dark:border-white/10">
      <div class="flex flex-wrap items-center gap-2">
        <button
          on:click={() => switchLanguage("fr")}
          data-testid="lang-fr-mobile"
          aria-label="{$tr('a11y.switchTo')} français"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-bold {$language.current ===
          'fr'
            ? 'bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-blue-400'
            : 'text-slate-600 dark:text-slate-300'}">FR</button
        >
        <button
          on:click={() => switchLanguage("en")}
          data-testid="lang-en-mobile"
          aria-label="{$tr('a11y.switchTo')} English"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-bold {$language.current ===
          'en'
            ? 'bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-blue-400'
            : 'text-slate-600 dark:text-slate-300'}">EN</button
        >
        <button
          on:click={themeStore.toggle}
          data-testid="theme-toggle-mobile"
          aria-label={$tr("a11y.toggleTheme")}
          class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
        >
          <span class="material-icons text-xl dark:hidden" aria-hidden="true">dark_mode</span>
          <span class="material-icons text-xl hidden dark:inline-block" aria-hidden="true">light_mode</span>
        </button>
        <button
          on:click={() => ouvrirChoixPersona()}
          data-testid="persona-toggle-mobile"
          aria-haspopup="dialog"
          aria-label={libelleDuProfil}
          class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
        >
          <span class="material-icons text-xl" aria-hidden="true"
            >{PERSONA_ICONE[$personaStore.persona ?? "general"]}</span
          >
        </button>
      </div>

      {#if $authStore.isAuthenticated}
        <div class="grid grid-cols-2 gap-2">
          {#if nomAffiche}
            <p
              data-testid="user-name-mobile"
              class="col-span-2 truncate text-sm font-medium text-slate-600 dark:text-slate-300"
              title={$authStore.user?.email}
            >
              {nomAffiche}
            </p>
          {/if}
          {#if isAdmin}
            <a
              href="/admin"
              class="flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-2 text-sm font-semibold text-blue-600 dark:border-white/10 dark:text-blue-400"
              >{$tr("nav.admin")}</a
            >
          {/if}
          <button
            on:click={logout}
            data-testid="logout-mobile"
            class="flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-2 text-sm font-semibold text-white hover:bg-blue-700 {isAdmin
              ? ''
              : 'col-span-2'}">{$tr("nav.logout")}</button
          >
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-2">
          <a
            href="/login"
            class="flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
            >{$tr("nav.login")}</a
          >
          <a
            href="/signup"
            data-testid="nav-signup-mobile"
            class="flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-2 text-sm font-semibold text-white hover:bg-blue-700"
            >{$tr("nav.signup")}</a
          >
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /*
    Déplacé depuis (main)/+layout.svelte en même temps que le balisage : le CSS
    y était scopé à ce layout, donc la pastille aurait cessé de glisser partout
    ailleurs si seul le balisage avait voyagé.
  */
  .sliding-pill {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .sliding-pill {
      transition: none;
    }
  }
</style>
