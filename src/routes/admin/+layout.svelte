<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { afterNavigate, goto } from "$app/navigation";
  import { page } from "$app/stores";
  import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { authStore } from "$lib/stores/auth";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  /**
   * Titre de l'onglet, dérivé du chemin.
   *
   * Le dériver ici plutôt que de le faire poser par chaque page évite les deux
   * défauts constatés : quatre pages sur cinq n'en avaient aucun, et la seule
   * qui en posait un était masquée par celui du layout.
   */
  const TITRES_ADMIN: Record<string, string> = {
    "/admin": "admin.dashboard",
    "/admin/documents": "admin.documents",
    "/admin/documents/batch-upload": "admin.batchUpload",
    "/admin/users": "admin.users",
  };
  // La clé seule sert aussi au titre de la barre du haut, sur téléphone.
  $: cleTitre = TITRES_ADMIN[$page.url.pathname] ?? "admin.administration";
  $: titreAdmin = `${$tr(cleTitre)} — Admin`;

  // Garde de confort uniquement. La vraie barrière est côté backend : chaque
  // endpoint d'administration exige un jeton et un rôle (401 / 403). Ce contrôle
  // évite simplement d'afficher une interface qui n'aboutirait à rien.
  //
  // Le premier contrôle est dans onMount et non au niveau module : le store lit
  // localStorage, indisponible au rendu serveur — un contrôle au montage du
  // module redirigerait systématiquement.
  let checked = false;
  let mounted = false;

  function redirectToLogin() {
    goto(`/login?next=${encodeURIComponent($page.url.pathname)}`, {
      replaceState: true,
    });
  }

  function isAdmin(role: string | undefined): boolean {
    return ["admin", "superadmin"].includes(role ?? "");
  }

  onMount(() => {
    mounted = true;
    if (!$authStore.isAuthenticated || !isAdmin($authStore.user?.role)) {
      redirectToLogin();
      return;
    }
    checked = true;
  });

  // Le contrôle au montage ne suffisait pas : le layout n'est pas remonté entre
  // /admin et /admin/documents, donc une session expirée en cours de navigation
  // laissait l'interface affichée et vide. apiFetch appelle déjà
  // authStore.logout() sur 401 (src/lib/api.ts) — il faut réagir à ce
  // changement d'état, pas seulement à l'arrivée sur la page.
  $: if (mounted && checked && (!$authStore.isAuthenticated || !isAdmin($authStore.user?.role))) {
    checked = false;
    redirectToLogin();
  }

  /**
   * Tiroir de navigation, sous lg.
   *
   * La barre latérale fixe de 256 px laissait 104 px de contenu à 360 px de
   * large, et tout débordait sur la droite. Sous lg, elle devient un tiroir
   * ouvert depuis la barre du haut, avec le patron du menu mobile de
   * SiteHeader : fermé après chaque navigation et par Échap.
   */
  let menuOuvert = false;
  /** Vrai à partir de lg, où la barre redevient la colonne fixe d'origine. */
  let large = false;

  afterNavigate(() => (menuOuvert = false));

  // Le garde est dans le gestionnaire et non autour de <svelte:window> : Svelte
  // exige que cet élément soit à la racine du composant, jamais dans un bloc.
  function surTouche(event: KeyboardEvent) {
    if (menuOuvert && event.key === "Escape") menuOuvert = false;
  }

  onMount(() => {
    const requete = window.matchMedia("(min-width: 1024px)");
    const suivre = () => {
      large = requete.matches;
      // Une tablette qu'on tourne passe à lg tiroir ouvert : il devient une
      // colonne fixe, et garderait sinon le piège à focus et le verrou du
      // défilement sans aucun moyen visible de les lever.
      if (large) menuOuvert = false;
    };
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  });

  // Ouvert, le tiroir fige la page derrière lui, comme le choix du profil
  // (src/routes/+layout.svelte) : sans cela, un glisser sur le fond faisait
  // défiler la liste dessous.
  let debordementAvant = "";
  let defilementBloque = false;
  function bloquerDefilement(bloquer: boolean) {
    if (typeof document === "undefined" || bloquer === defilementBloque) return;
    if (bloquer) {
      debordementAvant = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = debordementAvant;
    }
    defilementBloque = bloquer;
  }
  $: bloquerDefilement(menuOuvert);
  // Une déconnexion depuis le tiroir ouvert quitte l'administration : le
  // verrou ne doit pas survivre au layout.
  onDestroy(() => bloquerDefilement(false));
</script>

<svelte:window on:keydown={surTouche} />

<!-- Titre de repli pour tout l'espace d'administration. Trois pages sur
     quatre n'en avaient aucun : l'onglet du navigateur affichait l'URL, et un
     utilisateur avec plusieurs onglets ouverts ne pouvait pas les distinguer.

     LE TITRE EST CALCULÉ ICI, POUR LES QUATRE PAGES. La version précédente
     posait « JuriX Admin » dans le layout en supposant qu'une page fille le
     « remplacerait » — ce n'est pas ce qui se produit : layout et page rendent
     tous les deux leur `<svelte:head>`, deux `<title>` se retrouvent dans le
     document, et c'est le premier, donc celui du layout, que le navigateur
     retient. `/admin/users` s'affichait « JuriX Admin ». Une seule source ici,
     et les pages filles n'en posent plus.

     `indexable={false}` : rien de l'administration n'a sa place dans un index
     public. La garde d'authentification vit dans `onMount` — elle ne s'applique
     donc qu'après hydratation, et le HTML servi par le rendu serveur est bien
     réel. -->
<MetaSeo titre={titreAdmin} indexable={false} />

{#if checked}
  <div class="min-h-app bg-slate-50 font-sans text-slate-900">
    <!-- Barre du haut, sous lg seulement : la seule porte vers la navigation
         une fois la barre latérale repliée. Elle garde le titre de la page en
         vue pendant le défilement. -->
    <header
      data-testid="admin-topbar"
      class="sticky top-0 z-20 border-b border-slate-200 bg-white pt-zone-sure px-zone-sure lg:hidden"
    >
      <div class="flex h-14 items-center gap-2 px-2">
        <button
          type="button"
          on:click={() => (menuOuvert = true)}
          data-testid="admin-menu-toggle"
          aria-expanded={menuOuvert}
          aria-controls="admin-sidebar"
          aria-label={$tr("a11y.menu")}
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <!-- Largeur fixe : avant la police d'icônes, le mot « menu » est
               plus large que le pictogramme. -->
          <span class="material-icons w-6 overflow-hidden" aria-hidden="true">menu</span>
        </button>
        <span class="min-w-0 truncate text-base font-semibold text-slate-900">{$tr(cleTitre)}</span>
      </div>
    </header>

    <!-- Fond du tiroir : toujours rendu, pour s'estomper dans les deux sens ;
         fermé, il laisse passer les clics. -->
    <div
      role="presentation"
      aria-hidden="true"
      on:click={() => (menuOuvert = false)}
      class="fixed inset-0 z-30 bg-slate-900/40 transition-opacity duration-200 motion-reduce:transition-none lg:hidden {menuOuvert
        ? 'opacity-100'
        : 'pointer-events-none opacity-0'}"
    ></div>

    <AdminSidebar
      ouvert={menuOuvert}
      enTiroir={!large}
      on:fermer={() => (menuOuvert = false)}
    />

    <!-- `inert` tiroir ouvert : la page derrière le fond ne doit plus être
         parcourue, ni au clavier ni au lecteur d'écran. Les marges latérales
         de zone sûre (encoche, en paysage) vivent ici, l'espacement du contenu
         dans le bloc suivant : les deux se seraient écrasés sur un même élément. -->
    <main inert={menuOuvert} class="px-zone-sure lg:ml-64">
      <div class="p-4 sm:p-6 lg:p-8">
        <div class="mx-auto max-w-6xl">
          <slot />
        </div>
      </div>
    </main>
  </div>
{:else}
  <!-- Évite que l'interface d'administration apparaisse le temps de la redirection -->
  <div class="flex min-h-app items-center justify-center bg-slate-50">
    <p class="text-sm text-slate-500">{$tr("admin.checkingSession")}</p>
  </div>
{/if}
