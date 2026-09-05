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

  function logout() {
    authStore.logout();
    mobileOpen = false;
  }
</script>

<svelte:window on:keydown={onKeydown} />

<header
  data-testid="site-header"
  class="w-full py-4 px-6 md:px-12 flex items-center justify-between relative z-50
    {variant === 'transparent'
    ? 'bg-transparent'
    : 'bg-white dark:bg-background-dark border-b border-gray-200 dark:border-white/10'}
    {sticky ? 'sticky top-0' : ''}"
>
  <!-- Logo -->
  <a href="/" data-testid="site-logo" class="flex items-center gap-3 flex-1">
    <div
      class="bg-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30"
    >
      <span class="material-icons text-white text-xl">balance</span>
    </div>
    <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
      >JuriX</span
    >
  </a>

  <!-- Navigation (bureau) -->
  <nav
    class="hidden md:flex items-center justify-center gap-8 text-sm font-medium text-secondary-text-light dark:text-secondary-text-dark flex-1"
  >
    {#each NAV_LINKS as lien (lien.href)}
      <a
        class="hover:text-primary transition-colors whitespace-nowrap {lien.isActive(
          pathname,
        )
          ? 'text-primary'
          : ''}"
        href={lien.href}>{$tr(lien.key)}</a
      >
    {/each}
  </nav>

  <!-- Actions (bureau) -->
  <div class="hidden md:flex items-center justify-end gap-3 flex-1">
    <div class="h-4 w-px bg-white/10 mx-2"></div>

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
        class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
        'fr'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
        >FR</button
      >
      <button
        on:click={() => switchLanguage("en")}
        data-testid="lang-en"
        class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
        'en'
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
        >EN</button
      >
    </div>

    <button
      on:click={themeStore.toggle}
      data-testid="theme-toggle"
      class="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      aria-label="Toggle Dark Mode"
    >
      {#if $themeStore === "dark"}
        <span class="material-icons text-lg">light_mode</span>
      {:else}
        <span class="material-icons text-lg">dark_mode</span>
      {/if}
    </button>

    <!--
      Le couple statique « Se connecter / S'inscrire » est remplacé par un bloc
      réactif. `/signup` n'a jamais existé : `app/api/routes/auth.py` n'expose
      que login, login/json, me et logout, et la page de connexion indique
      elle-même que les comptes sont créés par un administrateur.
      Au passage, c'est la première sortie de session hors de /admin.
    -->
    <div class="flex items-center gap-3 ml-2">
      {#if $authStore.isAuthenticated}
        {#if isAdmin}
          <a
            class="px-5 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap bg-white text-blue-600 hover:bg-gray-50 border border-transparent shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-blue-400 dark:hover:bg-white/10"
            href="/admin">{$tr("nav.admin")}</a
          >
        {/if}
        <button
          on:click={logout}
          data-testid="logout"
          class="px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          >{$tr("nav.logout")}</button
        >
      {:else}
        <a
          class="px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          href="/login">{$tr("nav.login")}</a
        >
      {/if}
    </div>
  </div>

  <!-- Bascule mobile -->
  <div class="flex md:hidden flex-1 justify-end">
    <button
      on:click={() => (mobileOpen = !mobileOpen)}
      data-testid="nav-mobile-toggle"
      aria-expanded={mobileOpen}
      aria-controls="site-nav-mobile"
      aria-label="Menu"
      class="p-2 text-slate-600 dark:text-slate-300"
    >
      <span class="material-icons">{mobileOpen ? "close" : "menu"}</span>
    </button>
  </div>
</header>

<!--
  Le bouton mobile n'avait aucun `on:click` : sous md, la navigation, le choix
  de langue, le thème et la connexion étaient tous inaccessibles. Le panneau
  reprend donc ces quatre familles de contrôles, pas seulement les liens.
-->
{#if mobileOpen}
  <div
    id="site-nav-mobile"
    data-testid="nav-mobile-panel"
    class="md:hidden border-b border-gray-200 dark:border-white/10 bg-white dark:bg-background-dark px-6 py-4 relative z-40"
  >
    <nav class="flex flex-col gap-1">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          class="py-2 text-base font-medium transition-colors {lien.isActive(
            pathname,
          )
            ? 'text-primary'
            : 'text-slate-700 dark:text-slate-200'}">{$tr(lien.key)}</a
        >
      {/each}
    </nav>

    <div
      class="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <button
          on:click={() => switchLanguage("fr")}
          data-testid="lang-fr-mobile"
          class="px-3 py-1 rounded-md text-xs font-bold {$language.current ===
          'fr'
            ? 'bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-blue-400'
            : 'text-slate-500'}">FR</button
        >
        <button
          on:click={() => switchLanguage("en")}
          data-testid="lang-en-mobile"
          class="px-3 py-1 rounded-md text-xs font-bold {$language.current ===
          'en'
            ? 'bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-blue-400'
            : 'text-slate-500'}">EN</button
        >
        <button
          on:click={themeStore.toggle}
          data-testid="theme-toggle-mobile"
          aria-label="Toggle Dark Mode"
          class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400"
        >
          <span class="material-icons text-lg"
            >{$themeStore === "dark" ? "light_mode" : "dark_mode"}</span
          >
        </button>
      </div>

      {#if $authStore.isAuthenticated}
        <div class="flex items-center gap-2">
          {#if isAdmin}
            <a
              href="/admin"
              class="px-3 py-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400"
              >{$tr("nav.admin")}</a
            >
          {/if}
          <button
            on:click={logout}
            data-testid="logout-mobile"
            class="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold"
            >{$tr("nav.logout")}</button
          >
        </div>
      {:else}
        <a
          href="/login"
          class="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold"
          >{$tr("nav.login")}</a
        >
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
</style>
