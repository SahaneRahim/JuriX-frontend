<script lang="ts">
  /**
   * Gestion des comptes.
   *
   * L'entrée « Utilisateurs » de la barre latérale pointait ici depuis
   * longtemps, mais la page n'existait pas : le lien répondait 404 à chaque
   * clic. Le CRUD backend, lui, était complet — seuls deux champs manquaient
   * dans les schémas (`is_active` sur UserCreate, `role` sur UserUpdate), ce
   * qui rendait la création impossible (500) et le changement de rôle inopérant.
   *
   * Pagination et filtres côté client : `GET /admin/users` n'expose que
   * `skip`/`limit` et plafonne à 500. Sur ce volume, un chargement unique suffit
   * et évite de bâtir une pagination serveur pour rien.
   */
  import { onMount } from "svelte";
  import { apiFetch } from "$lib/api";
  import UserFormModal from "$lib/components/admin/UserFormModal.svelte";
  import { authStore } from "$lib/stores/auth";
  import { formatDateCourte } from "$lib/format";
  import { nombreDePages, trancheDePage, TAILLE_PAGE_ADMIN } from "$lib/pagination";
  import { language, tr } from "$lib/stores/language";

  const PAR_PAGE = TAILLE_PAGE_ADMIN;

  let users: any[] = [];
  let chargement = true;
  let erreur = "";

  let recherche = "";
  let filtreRole = "all";
  let filtreStatut = "all";
  let page = 1;

  let modaleOuverte = false;
  let userEnCours: any = null;

  // Seul un superadmin peut supprimer (get_current_superadmin_user), et le
  // backend refuse la suppression de son propre compte.
  $: estSuperadmin = $authStore.user?.role === "superadmin";

  onMount(charger);

  async function charger() {
    chargement = true;
    erreur = "";
    try {
      const r = await apiFetch("/admin/users?skip=0&limit=500");
      if (!r.ok) {
        erreur = `Chargement impossible (${r.status}).`;
        return;
      }
      users = await r.json();
    } catch {
      erreur = "Impossible de joindre le serveur.";
    } finally {
      chargement = false;
    }
  }

  $: filtres = users.filter((u) => {
    const q = recherche.trim().toLowerCase();
    const correspond =
      !q ||
      [u.email, u.username, u.full_name]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q));
    const roleOk = filtreRole === "all" || u.role === filtreRole;
    const statutOk =
      filtreStatut === "all" ||
      (filtreStatut === "active" ? u.is_active : !u.is_active);
    return correspond && roleOk && statutOk;
  });

  // Un filtre qui laisse moins de pages qu'avant ne doit pas laisser l'écran
  // sur une page vide.
  $: totalPages = nombreDePages(filtres.length, PAR_PAGE);
  $: if (page > totalPages) page = 1;
  $: visibles = trancheDePage(filtres, page, PAR_PAGE);

  function ouvrirCreation() {
    userEnCours = null;
    modaleOuverte = true;
  }

  function ouvrirEdition(u: any) {
    userEnCours = u;
    modaleOuverte = true;
  }

  async function supprimer(u: any) {
    if (!confirm(`Supprimer définitivement le compte ${u.email} ?`)) return;
    const r = await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) {
      // 400 = dernier superadmin actif, ou son propre compte.
      const corps = await r.json().catch(() => null);
      alert(corps?.detail ?? `Suppression impossible (${r.status}).`);
      return;
    }
    users = users.filter((x) => x.id !== u.id);
  }

  function styleRole(role: string): string {
    if (role === "superadmin") return "bg-purple-100 text-purple-700";
    if (role === "admin") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-600";
  }

</script>

<svelte:head><title>JuriX Admin — Utilisateurs</title></svelte:head>

<div class="mb-8 flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold text-slate-900">Utilisateurs</h1>
    <p class="mt-1 text-slate-500">
      Comptes autorisés à accéder à l'administration.
    </p>
  </div>
  <button
    on:click={ouvrirCreation}
    data-testid="user-new"
    class="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:scale-105"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      class="h-5 w-5"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    Nouveau compte
  </button>
</div>

<div class="mb-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
  <input
    bind:value={recherche}
          aria-label={$tr("a11y.searchField")}
    data-testid="user-search"
    placeholder="Rechercher par email, identifiant ou nom…"
    class="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
  />
  <select
    bind:value={filtreRole}
          aria-label={$tr("a11y.filterRole")}
    data-testid="user-filter-role"
    class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
  >
    <option value="all">Tous les rôles</option>
    <option value="user">Utilisateur</option>
    <option value="admin">Administrateur</option>
    <option value="superadmin">Superadmin</option>
  </select>
  <select
    bind:value={filtreStatut}
          aria-label={$tr("a11y.filterStatus")}
    data-testid="user-filter-status"
    class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
  >
    <option value="all">Tous les statuts</option>
    <option value="active">Actifs</option>
    <option value="inactive">Inactifs</option>
  </select>
</div>

{#if chargement}
  <p class="py-16 text-center text-slate-500">Chargement…</p>
{:else if erreur}
  <div class="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
    <p class="mb-3 text-red-700">{erreur}</p>
    <button
      on:click={charger}
      data-testid="user-retry"
      class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
      >Réessayer</button
    >
  </div>
{:else if filtres.length === 0}
  <p class="py-16 text-center text-slate-500">Aucun compte ne correspond.</p>
{:else}
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-6 py-3">Compte</th>
          <th class="px-6 py-3">Nom</th>
          <th class="px-6 py-3">Rôle</th>
          <th class="px-6 py-3">Statut</th>
          <th class="px-6 py-3">Dernière connexion</th>
          <th class="px-6 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each visibles as u (u.id)}
          <tr class="hover:bg-slate-50">
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{u.email}</div>
              <div class="text-xs text-slate-500">@{u.username}</div>
            </td>
            <td class="px-6 py-4 text-slate-600">{u.full_name || "—"}</td>
            <td class="px-6 py-4">
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold {styleRole(u.role)}"
                >{u.role}</span
              >
            </td>
            <td class="px-6 py-4">
              <span
                class="rounded-full px-2.5 py-1 text-xs font-semibold {u.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'}"
                >{u.is_active ? "Actif" : "Inactif"}</span
              >
            </td>
            <td class="px-6 py-4 text-slate-500">{formatDateCourte(u.last_login_at, $language.current)}</td>
            <td class="px-6 py-4 text-right">
              <button
                on:click={() => ouvrirEdition(u)}
                data-testid="user-edit"
                class="mr-2 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >Éditer</button
              >
              <!--
                Le bouton n'est rendu que si l'action peut aboutir : le backend
                réserve la suppression aux superadmins et refuse qu'un compte se
                supprime lui-même. Afficher un bouton qui renverrait 403 ou 400
                serait une impasse de plus.
              -->
              {#if estSuperadmin && u.id !== $authStore.user?.id}
                <button
                  on:click={() => supprimer(u)}
                  data-testid="user-delete"
                  class="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >Supprimer</button
                >
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if totalPages > 1}
    <nav class="mt-6 flex items-center justify-center gap-2" aria-label={$tr("a11y.pagination")}>
      <button
        on:click={() => (page = Math.max(1, page - 1))}
        disabled={page === 1}
        data-testid="user-page-prev"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
        >Précédent</button
      >
      <span class="px-2 text-sm text-slate-500">Page {page} / {totalPages}</span>
      <button
        on:click={() => (page = Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        data-testid="user-page-next"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
        >Suivant</button
      >
    </nav>
  {/if}
{/if}

<UserFormModal bind:show={modaleOuverte} user={userEnCours} on:saved={charger} />
