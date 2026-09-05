<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { authStore } from "$lib/stores/auth";
  import "../../app.css";

  /**
   * Titre de l'onglet, dérivé du chemin.
   *
   * Le dériver ici plutôt que de le faire poser par chaque page évite les deux
   * défauts constatés : quatre pages sur cinq n'en avaient aucun, et la seule
   * qui en posait un était masquée par celui du layout.
   */
  const TITRES_ADMIN: Record<string, string> = {
    "/admin": "Tableau de bord",
    "/admin/documents": "Documents",
    "/admin/documents/batch-upload": "Import en lot",
    "/admin/users": "Utilisateurs",
  };
  $: titreAdmin = `${TITRES_ADMIN[$page.url.pathname] ?? "Administration"} — Admin`;

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
</script>

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
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900">
    <AdminSidebar />

    <main class="ml-64 min-h-screen p-8 transition-all">
      <div class="mx-auto max-w-6xl">
        <slot />
      </div>
    </main>
  </div>
{:else}
  <!-- Évite que l'interface d'administration apparaisse le temps de la redirection -->
  <div class="flex min-h-screen items-center justify-center bg-slate-50">
    <p class="text-sm text-slate-500">Vérification de la session…</p>
  </div>
{/if}
