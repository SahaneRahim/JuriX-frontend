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
  import { browser } from "$app/environment";
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

  /**
   * Tableau à partir de md, cartes en dessous.
   *
   * Les six colonnes demandaient environ 870 px, et leur conteneur coupait au
   * lieu de défiler : sur téléphone, Éditer et Supprimer étaient hors
   * d'atteinte. Une seule des deux variantes est RENDUE, plutôt que masquée en
   * CSS, pour que `user-edit` et `user-delete` restent uniques par compte.
   *
   * La page n'est jamais rendue par le serveur (le layout attend la garde
   * d'authentification, posée dans onMount) : la largeur se lit dès la création,
   * sans éclair de la mauvaise variante.
   */
  const REQUETE_TABLEAU = "(min-width: 768px)";
  let tableau = browser && window.matchMedia(REQUETE_TABLEAU).matches;

  onMount(() => {
    const requete = window.matchMedia(REQUETE_TABLEAU);
    const suivre = () => (tableau = requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  });

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

<!-- Empilé sur téléphone, bouton sur toute la largeur : sur une seule ligne,
     le titre de 30 px se tassait dans une colonne étroite. -->
<div class="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
  <div class="min-w-0">
    <h1 class="text-2xl font-bold text-slate-900 sm:text-3xl">{$tr("admin.users")}</h1>
    <p class="mt-1 text-slate-500">
      {$tr("admin.usersDesc")}
    </p>
  </div>
  <button
    on:click={ouvrirCreation}
    data-testid="user-new"
    class="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 motion-safe:hover:scale-105 sm:shrink-0"
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

<!-- Grille sous md : le `min-w-64` du champ débordait de la carte dès 320 px.
     Champs à 16 px sur téléphone (text-base) : en dessous, iOS zoome au focus
     et ne dézoome pas. Listes en `pl-3 pr-10` et non `px-3` : `px-3` écrasait
     les 2,5 rem que le plugin forms réserve à droite pour son chevron, et à
     partir de md, où chaque liste prend la largeur de son libellé, le chevron
     recouvrait la fin du texte (« Tous statut⌄s »). -->
<div
  class="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 sm:p-4 md:flex md:flex-wrap"
>
  <input
    bind:value={recherche}
          aria-label={$tr("a11y.searchField")}
    data-testid="user-search"
    placeholder={$tr("admin.users.searchPlaceholder")}
    class="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 sm:col-span-2 sm:text-sm md:w-auto md:min-w-64 md:flex-1"
  />
  <select
    bind:value={filtreRole}
          aria-label={$tr("a11y.filterRole")}
    data-testid="user-filter-role"
    class="w-full min-w-0 rounded-lg border border-slate-300 py-2 pl-3 pr-10 text-base sm:text-sm md:w-auto"
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
    class="w-full min-w-0 rounded-lg border border-slate-300 py-2 pl-3 pr-10 text-base sm:text-sm md:w-auto"
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
      class="min-h-11 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
      >{$tr("common.retry")}</button
    >
  </div>
{:else if filtres.length === 0}
  <p class="py-16 text-center text-slate-500">{$tr("admin.users.none")}</p>
{:else if tableau}
  <!-- Le conteneur défile au lieu de couper : un email long ne repousse plus
       la colonne des actions hors d'atteinte. Sous xl, où la barre latérale
       laisse environ 700 px, le nom rejoint la cellule du compte au lieu
       d'occuper sa propre colonne. -->
  <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3 xl:px-6">{$tr("admin.users.account")}</th>
          <th class="hidden px-4 py-3 xl:table-cell xl:px-6">{$tr("admin.users.name")}</th>
          <th class="px-4 py-3 xl:px-6">{$tr("admin.user.role")}</th>
          <th class="px-4 py-3 xl:px-6">{$tr("admin.status")}</th>
          <th class="px-4 py-3 xl:px-6">{$tr("admin.users.lastLogin")}</th>
          <th class="px-4 py-3 text-right xl:px-6">{$tr("admin.actions")}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each visibles as u (u.id)}
          <tr class="hover:bg-slate-50">
            <!-- coupe-mots : une adresse ne se coupe pas d'elle-meme. Sans lui, la
                 colonne prenait la largeur de l'adresse la plus longue et, de 768
                 a 1 100 px, poussait les boutons Editer et Supprimer hors du cadre. -->
            <td class="px-4 py-4 xl:px-6">
              <div class="coupe-mots font-medium text-slate-900">{u.email}</div>
              <div class="coupe-mots text-xs text-slate-500">@{u.username}</div>
              {#if u.full_name}
                <div class="text-xs text-slate-500 xl:hidden">{u.full_name}</div>
              {/if}
            </td>
            <td class="hidden px-4 py-4 text-slate-600 xl:table-cell xl:px-6">{u.full_name || "—"}</td>
            <td class="px-4 py-4 xl:px-6">
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold {styleRole(u.role)}"
                >{u.role}</span
              >
            </td>
            <td class="px-4 py-4 xl:px-6">
              <span
                class="rounded-full px-2.5 py-1 text-xs font-semibold {u.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'}"
                >{u.is_active ? $tr("admin.users.activeOne") : $tr("admin.users.inactiveOne")}</span
              >
            </td>
            <td class="px-4 py-4 text-slate-500 xl:px-6">{formatDateCourte(u.last_login_at, $language.current)}</td>
            <!-- 44 px de haut sur tablette, au doigt ; compacts à partir de lg. -->
            <td class="whitespace-nowrap px-4 py-4 text-right xl:px-6">
              <button
                on:click={() => ouvrirEdition(u)}
                data-testid="user-edit"
                class="mr-2 inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 lg:min-h-0"
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
                  class="inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 lg:min-h-0"
                  >{$tr("admin.delete")}</button
                >
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <!-- Une carte par compte, sous md : l'email entier (coupé au besoin plutôt
       que tronqué, c'est lui qui identifie le compte), puis le statut, puis
       des actions de 44 px sur toute la largeur. -->
  <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
    {#each visibles as u (u.id)}
      <li class="space-y-3 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="coupe-mots font-medium text-slate-900">{u.email}</p>
            <p class="coupe-mots text-xs text-slate-500">@{u.username}</p>
            {#if u.full_name}
              <p class="coupe-mots text-xs text-slate-500">{u.full_name}</p>
            {/if}
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold {styleRole(u.role)}"
            >{u.role}</span
          >
        </div>
        <dl class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div>
            <dt class="sr-only">{$tr("admin.status")}</dt>
            <dd>
              <span
                class="rounded-full px-2.5 py-1 font-semibold {u.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'}"
                >{u.is_active ? $tr("admin.users.activeOne") : $tr("admin.users.inactiveOne")}</span
              >
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-1">
            <dt class="text-slate-500">{$tr("admin.users.lastLogin")}</dt>
            <dd class="text-slate-700">{formatDateCourte(u.last_login_at, $language.current)}</dd>
          </div>
        </dl>
        <div class="flex gap-2">
          <button
            on:click={() => ouvrirEdition(u)}
            data-testid="user-edit"
            class="h-11 flex-1 rounded-lg border border-slate-200 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >{$tr("admin.edit")}</button
          >
          <!-- Même règle que le tableau : rendu seulement si la suppression
               peut aboutir. -->
          {#if estSuperadmin && u.id !== $authStore.user?.id}
            <button
              on:click={() => supprimer(u)}
              data-testid="user-delete"
              class="h-11 flex-1 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
              >{$tr("admin.delete")}</button
            >
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<!-- Hors des deux variantes : la pagination ne dépend pas de la largeur. -->
{#if !chargement && !erreur && totalPages > 1}
  <nav class="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label={$tr("a11y.pagination")}>
    <button
      on:click={() => (page = Math.max(1, page - 1))}
      disabled={page === 1}
      data-testid="user-page-prev"
      class="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm disabled:opacity-50 sm:min-h-0 sm:px-3 sm:py-1.5"
      >{$tr("admin.previous")}</button
    >
    <span class="px-2 text-sm text-slate-500">{$tr("admin.page")} {page} / {totalPages}</span>
    <button
      on:click={() => (page = Math.min(totalPages, page + 1))}
      disabled={page === totalPages}
      data-testid="user-page-next"
      class="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm disabled:opacity-50 sm:min-h-0 sm:px-3 sm:py-1.5"
      >{$tr("admin.next")}</button
    >
  </nav>
{/if}

<UserFormModal bind:show={modaleOuverte} user={userEnCours} on:saved={charger} />
