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
  import type { User } from '$lib/types';

  const PAR_PAGE = TAILLE_PAGE_ADMIN;

  let users: User[] = [];
  let chargement = true;
  let erreur = "";

  let recherche = "";
  let filtreRole = "all";
  let filtreStatut = "all";
  let page = 1;

  let modaleOuverte = false;
  let userEnCours: User | null = null;

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
        erreur = $tr("admin.users.loadError").replace("{status}", String(r.status));
        return;
      }
      users = await r.json();
    } catch {
      erreur = $tr("common.errorNetwork");
    } finally {
      chargement = false;
    }
  }

  $: filtres = users.filter((u) => {
    const q = recherche.trim().toLowerCase();
    const correspond =
      !q ||
      // `filter(Boolean)` retire bien les valeurs nulles a l'execution, mais
      // TypeScript ne le deduit pas : la garde de type explicite le lui dit,
      // sans changer le comportement.
      [u.email, u.username, u.full_name]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q));
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

  function ouvrirEdition(u: User) {
    userEnCours = u;
    modaleOuverte = true;
  }

  async function supprimer(u: User) {
    if (!confirm($tr("admin.users.confirmDelete").replace("{email}", u.email))) return;
    const r = await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) {
      // 400 = dernier superadmin actif, ou son propre compte.
      const corps = await r.json().catch(() => null);
      alert(corps?.detail ?? $tr("admin.users.deleteError").replace("{status}", String(r.status)));
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

<!-- Pas de <title> ici : le layout d'administration le derive du chemin pour
     les quatre pages. Deux <title> dans le document laisseraient gagner celui
     du layout, qui est rendu en premier. -->

<div class="mb-8 flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold text-slate-900">{$tr("admin.users")}</h1>
    <p class="mt-1 text-slate-500">
      {$tr("admin.usersDesc")}
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
    {$tr("admin.user.new")}
  </button>
</div>

<div class="mb-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
  <input
    bind:value={recherche}
          aria-label={$tr("a11y.searchField")}
    data-testid="user-search"
    placeholder={$tr("admin.users.searchPlaceholder")}
    class="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
  />
  <select
    bind:value={filtreRole}
          aria-label={$tr("a11y.filterRole")}
    data-testid="user-filter-role"
    class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
  >
    <option value="all">{$tr("admin.users.allRoles")}</option>
    <option value="user">{$tr("admin.role.user")}</option>
    <option value="admin">{$tr("admin.role.admin")}</option>
    <option value="superadmin">{$tr("admin.role.superadmin")}</option>
  </select>
  <select
    bind:value={filtreStatut}
          aria-label={$tr("a11y.filterStatus")}
    data-testid="user-filter-status"
    class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
  >
    <option value="all">{$tr("admin.allStatuses")}</option>
    <option value="active">{$tr("admin.users.activePlural")}</option>
    <option value="inactive">{$tr("admin.users.inactivePlural")}</option>
  </select>
</div>

{#if chargement}
  <p class="py-16 text-center text-slate-500">{$tr("common.loading")}</p>
{:else if erreur}
  <div class="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
    <p class="mb-3 text-red-700">{erreur}</p>
    <button
      on:click={charger}
      data-testid="user-retry"
      class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
      >{$tr("common.retry")}</button
    >
  </div>
{:else if filtres.length === 0}
  <p class="py-16 text-center text-slate-500">{$tr("admin.users.none")}</p>
{:else}
  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-6 py-3">{$tr("admin.users.account")}</th>
          <th class="px-6 py-3">{$tr("admin.users.name")}</th>
          <th class="px-6 py-3">{$tr("admin.user.role")}</th>
          <th class="px-6 py-3">{$tr("admin.status")}</th>
          <th class="px-6 py-3">{$tr("admin.users.lastLogin")}</th>
          <th class="px-6 py-3 text-right">{$tr("admin.actions")}</th>
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
                >{u.is_active ? $tr("admin.users.activeOne") : $tr("admin.users.inactiveOne")}</span
              >
            </td>
            <td class="px-6 py-4 text-slate-500">{formatDateCourte(u.last_login_at, $language.current)}</td>
            <td class="px-6 py-4 text-right">
              <button
                on:click={() => ouvrirEdition(u)}
                data-testid="user-edit"
                class="mr-2 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >{$tr("admin.edit")}</button
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
                  >{$tr("admin.delete")}</button
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
        >{$tr("admin.previous")}</button
      >
      <span class="px-2 text-sm text-slate-500">{$tr("admin.page")} {page} / {totalPages}</span>
      <button
        on:click={() => (page = Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        data-testid="user-page-next"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
        >{$tr("admin.next")}</button
      >
    </nav>
  {/if}
{/if}

<UserFormModal bind:show={modaleOuverte} user={userEnCours} on:saved={charger} />
