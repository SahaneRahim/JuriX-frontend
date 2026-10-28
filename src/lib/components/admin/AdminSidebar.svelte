<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { piegerFocus } from '$lib/actions/pieger-focus';
  import Icone from '$lib/components/Icone.svelte';
  import { authStore } from '$lib/stores/auth';
  import { language, switchLanguage, tr } from '$lib/stores/language';
  import { themeStore } from '$lib/stores/theme';

  /**
   * Sous xl, la barre latérale est un tiroir que le layout ouvre depuis sa
   * barre du haut : fixe et toujours affichée, elle ne laissait que 104 px de
   * contenu sur un téléphone de 360 px, et rien ne permettait de la replier.
   * À partir de xl, c'est la colonne fixe d'origine et ces deux props restent
   * sans effet. (xl et non lg : en colonne à 1 024 px, elle ne laissait
   * qu'environ 704 px au contenu ; voir src/routes/admin/+layout.svelte.)
   *
   * `enTiroir` (sous xl, d'après le layout) sert à sortir le tiroir FERMÉ de
   * la tabulation et des lecteurs d'écran : poussé hors de l'écran, il restait
   * sinon parcouru au clavier, lien après lien, sans rien montrer.
   */
  export let ouvert = false;
  export let enTiroir = false;

  const dispatch = createEventDispatcher<{ fermer: void }>();

  function fermer() {
    dispatch('fermer');
  }

  /**
   * Couleurs des entrées de la barre. La page courante est inversée, comme
   * tout élément actif du site. Le survol ne vise que les autres entrées :
   * posé sur toutes, il repassait l'entrée courante en clair sous le pointeur,
   * et elle ne se distinguait plus des autres.
   */
  const ENTREE =
    'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white';
  const ENTREE_COURANTE = 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950';
  const classeEntree = (courante: boolean) => (courante ? ENTREE_COURANTE : ENTREE);

  // "Déconnexion" était un simple <a href="/"> : il ramenait à l'accueil sans
  // rien déconnecter, le jeton restait dans localStorage.
  function handleLogout() {
    authStore.logout();
    goto('/login', { replaceState: true });
  }

  /**
   * Le focus n'est piégé que tiroir OUVERT : à partir de xl, la barre est une
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
  class="fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-zinc-200 bg-white pl-[env(safe-area-inset-left)] transition-transform duration-200 ease-out motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 xl:max-w-none xl:translate-x-0 xl:pl-0 {ouvert
    ? 'translate-x-0 shadow-xl dark:shadow-none'
    : '-translate-x-full'}"
>
  <div
    class="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 pl-6 pr-2 court:h-12 dark:border-zinc-800"
  >
    <!-- La balance dans sa tuile noire (blanche en sombre), comme le logo de
         l'en-tête du site : l'émoji changeait de dessin et de couleurs d'un
         système à l'autre. Calée à gauche à toute largeur, à 24 px du bord
         comme les icônes du menu (px-3 de la liste, p-3 de l'entrée) :
         centrée en colonne, elle ne s'alignait sur rien de ce qu'il y a
         dessous. -->
    <a href="/admin" on:click={fermer} class="flex min-h-11 items-center gap-2.5 rounded-xl font-bold text-zinc-950 dark:text-white">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950 dark:shadow-none"
      >
        <Icone nom="scale" class="text-lg" />
      </span>
      <span class="text-lg tracking-tight">JuriX Admin</span>
    </a>
    <button
      type="button"
      on:click={fermer}
      data-testid="admin-menu-close"
      aria-label={$tr("common.close")}
      class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white xl:hidden"
    >
      <Icone nom="x" class="h-6 w-6" />
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
          class="flex items-center rounded-xl p-3 text-sm font-medium transition-colors court:py-2.5 {classeEntree($page.url.pathname === '/admin')}"
        >
          <Icone nom="layout-dashboard" class="mr-3 h-5 w-5" />
          {$tr("admin.dashboard")}
        </a>
      </li>
      <li>
        <a
          href="/admin/documents"
          on:click={fermer}
          aria-current={$page.url.pathname.startsWith('/admin/documents') ? "page" : undefined}
          class="flex items-center rounded-xl p-3 text-sm font-medium transition-colors court:py-2.5 {classeEntree($page.url.pathname.startsWith('/admin/documents'))}"
        >
          <Icone nom="file-text" class="mr-3 h-5 w-5" />
          {$tr("admin.documents")}
        </a>
      </li>
      <li>
        <a
          href="/admin/blog"
          on:click={fermer}
          aria-current={$page.url.pathname.startsWith('/admin/blog') ? "page" : undefined}
          class="flex items-center rounded-xl p-3 text-sm font-medium transition-colors court:py-2.5 {classeEntree($page.url.pathname.startsWith('/admin/blog'))}"
        >
          <Icone nom="newspaper" class="mr-3 h-5 w-5" />
          {$tr("admin.blog")}
        </a>
      </li>
      <li>
        <a
          href="/admin/users"
          on:click={fermer}
          aria-current={$page.url.pathname.startsWith('/admin/users') ? "page" : undefined}
          class="flex items-center rounded-xl p-3 text-sm font-medium transition-colors court:py-2.5 {classeEntree($page.url.pathname.startsWith('/admin/users'))}"
        >
          <Icone nom="users-round" class="mr-3 h-5 w-5" />
          {$tr("admin.users")}
        </a>
      </li>
    </ul>
  </div>

  <!-- Hors de la zone qui défile, donc toujours visible ; la zone sûre garde
       la langue au-dessus de la barre d'accueil de l'iPhone. -->
  <div class="shrink-0 border-t border-zinc-200 px-3 pt-4 pb-zone-sure court:pt-2 dark:border-zinc-800">
      <!-- L'administration n'avait AUCUNE sortie vers le site public : le logo
           pointe /admin, et la seule issue était la déconnexion. -->
      <a
        href="/"
        data-testid="admin-back-to-site"
        class="mb-1 flex w-full items-center rounded-xl p-3 text-sm font-medium transition-colors court:py-2.5 {ENTREE}">
        <Icone nom="house" class="mr-3 h-5 w-5" />
        {$tr("admin.backToSite")}
      </a>
      <button
        type="button"
        on:click={handleLogout}
        data-testid="admin-logout"
        class="flex w-full items-center rounded-xl p-3 text-sm font-medium transition-colors court:py-2.5 {ENTREE}">
        <Icone nom="log-out" class="mr-3 h-5 w-5" />
        {$tr("admin.logout")}
      </button>

      <!-- L'administration n'avait aucun moyen de changer de langue (celle du
           site public s'y appliquait sans qu'on puisse la modifier), ni de
           thème. Mêmes boutons que la rangée des réglages du menu mobile du
           site (SiteHeader) : 44 px, rounded-xl, langue active inversée comme
           l'entrée courante du menu, thème calé à droite. La pastille de
           12 px en rounded-lg faisait une troisième variante du choix de
           langue, et ne gardait pas ses 44 px en colonne, où une tablette en
           paysage ou un portable tactile s'en servent au doigt. Sans retrait
           propre, la langue active s'aligne sur le fond des entrées du menu. -->
      <div class="mb-4 mt-3 flex items-center gap-2 court:mb-2 court:mt-1">
        <button
          type="button"
          on:click={() => switchLanguage('fr')}
          data-testid="lang-fr-admin"
          aria-label="{$tr('a11y.switchTo')} français"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-bold transition-colors {classeEntree($language.current === 'fr')}">FR</button
        >
        <button
          type="button"
          on:click={() => switchLanguage('en')}
          data-testid="lang-en-admin"
          aria-label="{$tr('a11y.switchTo')} English"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-bold transition-colors {classeEntree($language.current === 'en')}">EN</button
        >
        <!-- Les deux icônes, alternées en CSS par la classe `dark` de <html>,
             comme dans l'en-tête du site : l'icône suit le thème réellement
             affiché, même pour un thème « auto » déjà enregistré, que la
             valeur du store ne dit pas. -->
        <button
          type="button"
          on:click={themeStore.toggle}
          data-testid="admin-theme-toggle"
          aria-label={$tr('a11y.toggleTheme')}
          class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors {ENTREE}"
        >
          <Icone nom="moon" class="text-xl dark:hidden" />
          <Icone nom="sun" class="hidden text-xl dark:inline-block" />
        </button>
      </div>
  </div>
</aside>
