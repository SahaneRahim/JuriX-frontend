<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { piegerFocus } from '$lib/actions/pieger-focus';
  import { authStore } from '$lib/stores/auth';
  import { language, switchLanguage, tr } from '$lib/stores/language';

  /**
   * Sous lg, la barre latérale est un tiroir que le layout ouvre depuis sa
   * barre du haut : fixe et toujours affichée, elle ne laissait que 104 px de
   * contenu sur un téléphone de 360 px, et rien ne permettait de la replier.
   * À partir de lg, c'est la colonne fixe d'origine et ces deux props restent
   * sans effet.
   *
   * `enTiroir` (sous lg, d'après le layout) sert à sortir le tiroir FERMÉ de
   * la tabulation et des lecteurs d'écran : poussé hors de l'écran, il restait
   * sinon parcouru au clavier, lien après lien, sans rien montrer.
   */
  export let ouvert = false;
  export let enTiroir = false;

  const dispatch = createEventDispatcher<{ fermer: void }>();

  function fermer() {
    dispatch('fermer');
  }

  // "Déconnexion" était un simple <a href="/"> : il ramenait à l'accueil sans
  // rien déconnecter, le jeton restait dans localStorage.
  function handleLogout() {
    authStore.logout();
    goto('/login', { replaceState: true });
  }

  /**
   * Le focus n'est piégé que tiroir OUVERT : à partir de lg, la barre est une
   * colonne ordinaire, que la tabulation doit pouvoir quitter.
   *
   * La pose attend le rendu suivant : `inert` tombe dans la même mise à jour,
   * et un élément encore inerte refuse le focus.
   */
  function piegeSiOuvert(noeud: HTMLElement, actif: boolean) {
    let piege: { destroy(): void } | null = null;
    let voulu = actif;

    function appliquer(etat: boolean) {
      voulu = etat;
      if (!etat) {
        piege?.destroy();
        piege = null;
        return;
      }
      tick().then(() => {
        if (voulu && !piege) {
          piege = piegerFocus(noeud, { initial: '[data-testid="admin-menu-close"]' });
        }
      });
    }

    appliquer(actif);
    return { update: appliquer, destroy: () => appliquer(false) };
  }
</script>

<!--
  Pas de hauteur explicite : `inset-y-0` suit l'écran réellement visible
  (barre d'adresse mobile comprise), là où h-screen (100vh) comptait la barre
  comme repliée et cachait le bas de la colonne dessous.
-->
<aside
  id="admin-sidebar"
  data-testid="admin-sidebar"
  inert={enTiroir && !ouvert}
  use:piegeSiOuvert={ouvert}
  class="fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-slate-200 bg-white pl-[env(safe-area-inset-left)] transition-transform duration-200 ease-out motion-reduce:transition-none lg:max-w-none lg:translate-x-0 lg:pl-0 {ouvert
    ? 'translate-x-0 shadow-xl'
    : '-translate-x-full'}"
>
  <div
    class="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 pl-6 pr-2 court:h-12 lg:justify-center lg:px-6"
  >
    <a href="/admin" on:click={fermer} class="flex items-center gap-2 font-bold text-slate-900">
      <span class="text-2xl">⚖️</span>
      <span class="text-lg">JuriX Admin</span>
    </a>
    <button
      type="button"
      on:click={fermer}
      data-testid="admin-menu-close"
      aria-label={$tr("common.close")}
      class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>

  <!-- Seule la liste défile : sur un écran court (téléphone en paysage), le
       bloc du bas — retour au site, déconnexion, langue — sortait de la
       colonne sans qu'aucun défilement ne permette de l'atteindre. -->
  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 court:py-2">
    <ul class="space-y-1 px-3">
      <li>
        <a
          href="/admin"
          on:click={fermer}
          aria-current={$page.url.pathname === '/admin' ? "page" : undefined}
          class="flex items-center rounded-lg p-3 text-base font-medium transition-colors hover:bg-blue-50 hover:text-blue-600 court:py-2.5 {$page.url.pathname === '/admin' ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 mr-3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          {$tr("admin.dashboard")}
        </a>
      </li>
      <li>
        <a
          href="/admin/documents"
          on:click={fermer}
          aria-current={$page.url.pathname.startsWith('/admin/documents') ? "page" : undefined}
          class="flex items-center rounded-lg p-3 text-base font-medium transition-colors hover:bg-blue-50 hover:text-blue-600 court:py-2.5 {$page.url.pathname.startsWith('/admin/documents') ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 mr-3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          {$tr("admin.documents")}
        </a>
      </li>
      <li>
        <a
          href="/admin/users"
          on:click={fermer}
          aria-current={$page.url.pathname.startsWith('/admin/users') ? "page" : undefined}
          class="flex items-center rounded-lg p-3 text-base font-medium transition-colors hover:bg-blue-50 hover:text-blue-600 court:py-2.5 {$page.url.pathname.startsWith('/admin/users') ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 mr-3">
             <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          {$tr("admin.users")}
        </a>
      </li>
    </ul>
  </div>

  <!-- Hors de la zone qui défile, donc toujours visible ; la zone sûre garde
       la langue au-dessus de la barre d'accueil de l'iPhone. -->
  <div class="shrink-0 border-t border-slate-200 px-3 pt-4 pb-zone-sure court:pt-2">
      <!-- L'administration n'avait AUCUNE sortie vers le site public : le logo
           pointe /admin, et la seule issue était la déconnexion. -->
      <a
        href="/"
        data-testid="admin-back-to-site"
        class="mb-1 flex w-full items-center rounded-lg p-3 text-base font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors court:py-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 mr-3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
        {$tr("admin.backToSite")}
      </a>
      <button
        type="button"
        on:click={handleLogout}
        data-testid="admin-logout"
        class="flex w-full items-center rounded-lg p-3 text-base font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors court:py-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 mr-3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
        {$tr("admin.logout")}
      </button>

      <!-- L'administration n'avait aucun moyen de changer de langue : la
           langue choisie sur le site public s'y appliquait sans qu'on puisse
           la modifier. Boutons de 44 px au doigt, compactés à partir de lg,
           où la barre n'est plus un tiroir tactile. -->
      <div class="mb-4 mt-3 flex items-center gap-2 px-3 court:mb-2 court:mt-1">
        <button
          type="button"
          on:click={() => switchLanguage('fr')}
          data-testid="lang-fr-admin"
          aria-label="{$tr('a11y.switchTo')} français"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-xs font-bold lg:h-auto lg:min-w-0 lg:py-1 {$language.current === 'fr' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-800'}">FR</button
        >
        <button
          type="button"
          on:click={() => switchLanguage('en')}
          data-testid="lang-en-admin"
          aria-label="{$tr('a11y.switchTo')} English"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-xs font-bold lg:h-auto lg:min-w-0 lg:py-1 {$language.current === 'en' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-800'}">EN</button
        >
      </div>
  </div>
</aside>
