<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import AdminSidebar from "$lib/components/admin/AdminSidebar.svelte";
  import { authStore } from "$lib/stores/auth";
  import "../../app.css";

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
     Une page qui pose son propre <title> le remplace. -->
<svelte:head><title>JuriX Admin</title></svelte:head>

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
