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
  // Dans onMount et non dans un `$:` : le store lit localStorage, indisponible
  // au rendu serveur — un contrôle au niveau module redirigerait systématiquement.
  let checked = false;

  onMount(() => {
    const state = $authStore;
    const isAdmin = ["admin", "superadmin"].includes(state.user?.role ?? "");
    if (!state.isAuthenticated || !isAdmin) {
      goto(`/login?next=${encodeURIComponent($page.url.pathname)}`, {
        replaceState: true,
      });
      return;
    }
    checked = true;
  });
</script>

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
