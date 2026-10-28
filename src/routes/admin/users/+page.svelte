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
  import Icone from "$lib/components/Icone.svelte";
  import type { NomIcone } from "$lib/icones";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import UserFormModal from "$lib/components/admin/UserFormModal.svelte";
  import { authStore } from "$lib/stores/auth";
  import { formatDateCourte } from "$lib/format";
  import { nombreDePages, pagesVisibles, trancheDePage, TAILLE_PAGE_ADMIN } from "$lib/pagination";
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
   * Tableau à partir de lg, cartes en dessous.
   *
   * Les six colonnes demandaient environ 870 px, et leur conteneur coupait au
   * lieu de défiler : sur téléphone, Modifier et Supprimer étaient hors
   * d'atteinte. Une seule des deux variantes est RENDUE, plutôt que masquée en
   * CSS, pour que `user-edit` et `user-delete` restent uniques par compte.
   *
   * lg et non md : de 768 à 1 023 px, le tableau ne laissait qu'environ
   * 120 px à la colonne du compte. Les adresses s'y coupaient en plein mot
   * (« contentieux@minjus » / « tice.example.com »), une lettre seule partait
   * à la ligne, et une ligne montait à 7 ou 9 lignes de texte. Les cartes
   * tiennent à ces largeurs ; à partir de lg, le tableau a au moins 960 px
   * (la barre latérale reste un tiroir jusqu'à xl).
   *
   * La page n'est jamais rendue par le serveur (le layout attend la garde
   * d'authentification, posée dans onMount) : la largeur se lit dès la création,
   * sans éclair de la mauvaise variante.
   */
  const REQUETE_TABLEAU = "(min-width: 1024px)";
  let tableau = browser && window.matchMedia(REQUETE_TABLEAU).matches;

  /**
   * Texte indicatif complet de la recherche à partir de sm. En dessous, le
   * champ (environ 280 px de texte à 390 px de large, en 16 px) coupait net
   * « Rechercher par email, identifiant ou nom… » à son bord droit : il
   * reprend alors son nom accessible, « Rechercher », que la loupe complète.
   */
  const REQUETE_INDICATIF_COMPLET = "(min-width: 640px)";
  let indicatifComplet = browser && window.matchMedia(REQUETE_INDICATIF_COMPLET).matches;

  /** Suit une media query ; rend la fonction qui cesse de la suivre. */
  function suivre(requete: string, changer: (vrai: boolean) => void): () => void {
    const liste = window.matchMedia(requete);
    const appliquer = () => changer(liste.matches);
    appliquer();
    liste.addEventListener("change", appliquer);
    return () => liste.removeEventListener("change", appliquer);
  }

  onMount(() => {
    const arrets = [
      suivre(REQUETE_TABLEAU, (vrai) => (tableau = vrai)),
      suivre(REQUETE_INDICATIF_COMPLET, (vrai) => (indicatifComplet = vrai)),
    ];
    return () => arrets.forEach((arreter) => arreter());
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
  // Rang du premier et du dernier compte affichés, pour le résumé du pied.
  $: premier = (page - 1) * PAR_PAGE + 1;
  $: dernier = Math.min(page * PAR_PAGE, filtres.length);
  // Trois numéros avec les cartes, cinq avec le tableau, comme les documents :
  // avec cinq, plus les flèches, la rangée dépassait un téléphone de 360 px.
  $: numeros = pagesVisibles(page, totalPages, tableau ? 5 : 3);

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

  /**
   * Rôles : le badge de base du guide (§ 4.8, gris), une icône par rôle, le
   * libellé portant le sens. Le superadmin avait la pastille inversée du
   * statut « Actif », juste à côté (deux statuts identiques, l'icône en
   * moins), et l'administrateur un troisième dessin, cerclé de noir, absent
   * des recettes du guide. L'inversion reste aux statuts actifs.
   */
  function iconeRole(role: string): NomIcone {
    return role === "superadmin" || role === "admin" ? "shield-user" : "user-round";
  }

  /**
   * Gabarit du badge de rôle : celui de StatusBadge en taille sm (py-0.5,
   * font-medium), qui dessine le statut juste à côté. Les badges faits ici à
   * la main (py-1, font-semibold) étaient plus hauts et plus gras que les
   * mêmes badges des documents et du blog.
   */
  const BADGE_ROLE =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

  /**
   * Libellé traduit d'un rôle. Le badge affichait la valeur brute de l'API,
   * en anglais et en minuscules (« user », « superadmin »), alors que le
   * filtre juste au-dessus disait déjà « Utilisateur » et « Administrateur ».
   * Un rôle que le front ne connaît pas garde sa valeur brute, plutôt que le
   * nom d'une clé de traduction.
   */
  const CLE_DU_ROLE: Record<string, string> = {
    user: "admin.role.user",
    admin: "admin.role.admin",
    superadmin: "admin.role.superadmin",
  };
  // La traduction est passée en argument (`$tr`) : l'expression du balisage
  // qui l'appelle suit ainsi le changement de langue.
  function libelleRole(role: string, traduire: (cle: string) => string): string {
    return CLE_DU_ROLE[role] ? traduire(CLE_DU_ROLE[role]) : role;
  }

  /**
   * Adresse en morceaux insécables, séparés dans le balisage par des <wbr> :
   * elle ne passe à la ligne qu'après son « @ » ou AVANT un « . » ou un
   * « - ». Dans une colonne étroite, `coupe-mots` seul coupait n'importe où
   * (« lecteur10@jurix.c » / « m ») ; et le navigateur coupe d'office APRÈS
   * un trait d'union : « …juridiques-et- » / « du-contentieux@… » se lisait
   * comme une césure, et brouillait l'adresse (1 024 px). Coupée avant, le
   * « - » ouvre la ligne suivante. `coupe-mots` ne sert plus qu'aux morceaux
   * trop longs pour une ligne entière. Pas de regard en arrière dans une
   * expression régulière : Safari ne le lit qu'à partir de la version 16.4.
   */
  function morceauxEmail(email: string): string[] {
    const morceaux: string[] = [];
    let courant = "";
    for (const c of email) {
      if ((c === "." || c === "-") && courant) {
        morceaux.push(courant);
        courant = "";
      }
      courant += c;
      if (c === "@") {
        morceaux.push(courant);
        courant = "";
      }
    }
    if (courant) morceaux.push(courant);
    return morceaux;
  }

  /**
   * Actions d'une ligne du tableau : boutons discrets du guide (§ 4.4), 44 px
   * de haut à toute largeur. Compactés à 32 px à partir de lg, ils l'étaient
   * aussi sur une tablette en paysage, au doigt.
   */
  const ACTION =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium transition-colors";
  const ACTION_EDITER =
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white";
  const ACTION_SUPPRIMER =
    "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300";

  /**
   * Boutons de la pagination : ceux des documents (discrets, page courante
   * inversée et marquée `aria-current`, guide § 4.7), mais de 44 px à toute
   * largeur : à 40 px dès sm, la pagination était trop petite au doigt sur
   * tablette.
   */
  const PAGINATION = "h-11 min-w-11 items-center justify-center rounded-xl text-sm transition-colors";
  const PAGINATION_DISCRETE =
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";
  const PAGINATION_COURANTE =
    "bg-zinc-950 font-bold text-white shadow-sm dark:bg-white dark:text-zinc-950 dark:shadow-none";
</script>

<!-- Pas de <title> ici : le layout d'administration le derive du chemin pour
     les quatre pages. Deux <title> dans le document laisseraient gagner celui
     du layout, qui est rendu en premier. -->

<!-- Empilé sur téléphone, bouton sur toute la largeur : sur une seule ligne,
     le titre se tassait dans une colonne étroite. Titre de page du guide
     (§ 4.2 : 30 px, 36 px à partir de sm), comme les autres pages. En ligne
     à partir de md, comme le tableau de bord et le blog : à sm, à 740 px,
     deux pages sœurs prenaient deux dispositions. -->
<div class="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
  <div class="min-w-0">
    <h1 class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">{$tr("admin.users")}</h1>
    <!-- `text-pretty` : pas de mot seul en dernière ligne, comme les
         sous-titres des autres pages de l'administration. -->
    <p class="mt-1 text-pretty text-zinc-500 dark:text-zinc-400">
      {$tr("admin.usersDesc")}
    </p>
  </div>
  <!-- Bouton principal du guide (§ 4.4 : 14 px, semi-gras, sans zoom),
       comme « Ajouter des documents » et « Générer un article IA » : en
       16 px, avec une icône de 20 px qui grossissait au survol, il était
       visiblement plus gros que ses voisins.
       Sur toute la largeur au téléphone seulement : de sm à md, sous le
       titre, il garde sa largeur (`sm:self-start`), comme les boutons des
       documents ; étiré, il faisait une barre noire de 692 px à 740 px de
       large. `md:self-auto` : en ligne, il reprend le centrage vertical de
       l'en-tête. -->
  <button
    on:click={ouvrirCreation}
    data-testid="user-new"
    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200 sm:self-start md:shrink-0 md:self-auto"
  >
    <Icone nom="plus" class="text-lg" />
    {$tr("admin.user.new")}
  </button>
</div>

<!-- Grille sous lg, la recherche sur sa propre rangée, comme dans les
     documents : en une rangée dès md, à 768 px, le champ se serrait entre
     les deux listes et coupait son texte indicatif (« Rechercher par adresse
     email, identifiant… »). Sur la ligne des listes à partir de lg, où il
     garde plus de 500 px. Le `min-w-64` du champ débordait de la carte dès
     320 px : il n'agit qu'en rangée.
     Champs à 16 px (text-base) sauf à partir de sm sous un pointeur fin (la
     règle des pages de compte, login/+page.svelte) : en dessous, iOS zoome
     au focus et ne dézoome pas, et un téléphone en paysage fait 740 px de
     large. 44 px de haut à toutes les tailles : compactés à 38 px dès sm,
     ils l'étaient aussi sur les tablettes, au doigt, à côté de boutons de
     44 px. Listes en `pl-3 pr-10` et non `px-3` : `px-3` écrasait
     les 2,5 rem que le plugin forms réserve à droite pour son chevron, et à
     partir de lg, où chaque liste prend la largeur de son libellé, le chevron
     recouvrait la fin du texte (« Tous statut⌄s »).
     La recherche a la loupe de celle des documents (même place, même
     retrait pl-10) : les deux recherches de l'administration différaient.
     `pointer-events-none` : un appui sur la loupe atteint le champ. -->
<div
  class="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 sm:p-4 lg:flex lg:flex-wrap"
>
  <div class="relative min-w-0 sm:col-span-2 lg:min-w-64 lg:flex-1">
    <Icone
      nom="search"
      class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
    />
    <input
      bind:value={recherche}
      aria-label={$tr("a11y.searchField")}
      data-testid="user-search"
      placeholder={indicatifComplet ? $tr("admin.users.searchPlaceholder") : $tr("a11y.searchField")}
      class="min-h-11 w-full min-w-0 text-ellipsis rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-base text-zinc-950 placeholder-zinc-400 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
    />
  </div>
  <select
    bind:value={filtreRole}
          aria-label={$tr("a11y.filterRole")}
    data-testid="user-filter-role"
    class="min-h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm lg:w-auto"
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
    class="min-h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm lg:w-auto"
  >
    <option value="all">{$tr("admin.allStatuses")}</option>
    <option value="active">{$tr("admin.users.activePlural")}</option>
    <option value="inactive">{$tr("admin.users.inactivePlural")}</option>
  </select>
</div>

{#if chargement}
  <p class="py-16 text-center text-zinc-500 dark:text-zinc-400">{$tr("common.loading")}</p>
{:else if erreur}
  <!-- Annoncée (role="alert") comme celle du tableau de bord : sans cela, un
       lecteur d'écran restait muet sur l'échec du chargement. « Réessayer »
       n'est pas destructeur : bouton neutre, le rouge reste à l'erreur. -->
  <div
    role="alert"
    class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/40"
  >
    <p class="mb-3 flex items-center justify-center gap-2 text-red-700 dark:text-red-300">
      <Icone nom="circle-alert" class="text-xl" />{erreur}
    </p>
    <button
      on:click={charger}
      data-testid="user-retry"
      class="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
      >{$tr("common.retry")}</button
    >
  </div>
{:else if filtres.length === 0}
  <p class="py-16 text-center text-zinc-500 dark:text-zinc-400">{$tr("admin.users.none")}</p>
{:else}
  <!-- Une seule carte pour le tableau ou les cartes, et pour la pagination
       dans son pied, comme la liste des documents : la pagination flottait
       sous la carte, sans le nombre total de comptes.
       La carte est un conteneur de requête (`[container-type:inline-size]`) :
       la colonne « Dernière connexion » dépend de la largeur du tableau, que
       celle de l'écran ne dit pas (la barre latérale prend 256 px à partir
       de xl ; le tableau fait 960 px à 1 024 comme à 1 280 px). -->
  <div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white [container-type:inline-size] dark:border-zinc-800 dark:bg-zinc-900">
    {#if tableau}
      <!-- Le conteneur défile au lieu de couper : un email long ne repousse
           plus la colonne des actions hors d'atteinte.
           Le nom complet reste dans la cellule du compte, sous l'identifiant,
           à toute largeur : en colonne à part (à partir de xl), il tenait sur
           trois lignes (« Marie-Claire / Essomba / Tchoungui ») pendant que la
           colonne du compte restait large. Rien d'autre ne passe à la ligne
           (en-têtes, badges, date, actions) : toute la place qui reste va au
           compte, 224 px au moins (min-w-56).
           Sous 64 rem de tableau, la dernière connexion quitte sa colonne
           pour une ligne sous le compte, comme la langue et la date des
           documents : sur cinq colonnes, à 960 px, le compte n'avait
           qu'environ 260 px (les longues adresses sur trois lignes) quand
           « Dernière connexion », large de son en-tête, en gardait 170 pour
           une date de 85. -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
          >
            <tr>
              <th class="whitespace-nowrap py-3 pl-6 pr-4">{$tr("admin.users.account")}</th>
              <th class="whitespace-nowrap px-4 py-3">{$tr("admin.user.role")}</th>
              <th class="whitespace-nowrap px-4 py-3">{$tr("admin.status")}</th>
              <th class="hidden whitespace-nowrap px-4 py-3 [@container(min-width:64rem)]:table-cell">{$tr("admin.users.lastLogin")}</th>
              <th class="whitespace-nowrap py-3 pl-4 pr-6 text-right">{$tr("admin.actions")}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
            {#each visibles as u (u.id)}
              <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <!-- coupe-mots : un morceau d'adresse trop long pour une ligne
                     se coupe au lieu d'élargir la colonne, qui poussait sinon
                     Modifier et Supprimer hors du cadre. -->
                <td class="py-4 pl-6 pr-4">
                  <div class="min-w-56">
                    <div class="coupe-mots font-medium text-zinc-950 dark:text-zinc-100">{#each morceauxEmail(u.email) as morceau, i (i)}{#if i}<wbr />{/if}<span class="whitespace-nowrap">{morceau}</span>{/each}</div>
                    <div class="coupe-mots text-xs text-zinc-500 dark:text-zinc-400">@{u.username}</div>
                    {#if u.full_name}
                      <div class="coupe-mots text-xs text-zinc-500 dark:text-zinc-400">{u.full_name}</div>
                    {/if}
                    <!-- La dernière connexion, quand sa colonne est masquée :
                         libellé visible, comme dans les cartes ; une date seule
                         sous le compte ne dirait pas ce qu'elle date. -->
                    <dl class="mt-1 flex flex-wrap gap-x-1 text-xs [@container(min-width:64rem)]:hidden">
                      <dt class="text-zinc-500 dark:text-zinc-400">{$tr("admin.users.lastLogin")}</dt>
                      <dd class="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatDateCourte(u.last_login_at, $language.current)}</dd>
                    </dl>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <span class={BADGE_ROLE}><Icone nom={iconeRole(u.role)} class="text-sm" />{libelleRole(u.role, $tr)}</span>
                </td>
                <td class="px-4 py-4">
                  <StatusBadge status={u.is_active ? "active" : "inactive"} size="sm" />
                </td>
                <!-- Méta du guide (§ 4.2) : la date en chasse fixe, comme
                     celles du tableau de bord et du blog. -->
                <td class="hidden whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400 [@container(min-width:64rem)]:table-cell"
                  >{formatDateCourte(u.last_login_at, $language.current)}</td
                >
                <!-- `-mr-3` rend aux boutons le retrait de leur `px-3` : le
                     texte de « Supprimer » s'arrête sous la fin de l'en-tête
                     « Actions », et non 12 px avant. -->
                <td class="py-4 pl-4 pr-6">
                  <div class="-mr-3 flex items-center justify-end gap-1">
                    <button
                      on:click={() => ouvrirEdition(u)}
                      data-testid="user-edit"
                      class="{ACTION} {ACTION_EDITER}">{$tr("admin.edit")}</button
                    >
                    <!--
                      Le bouton n'est rendu que si l'action peut aboutir : le backend
                      réserve la suppression aux superadmins et refuse qu'un compte se
                      supprime lui-même. Afficher un bouton qui renverrait 403 ou 400
                      serait une impasse de plus.
                      Sur la ligne de son propre compte, une case vide de la largeur
                      de « Supprimer » garde « Modifier » dans la colonne des autres
                      « Modifier » : seul et calé à droite, il passait sous les
                      « Supprimer » des autres lignes.
                    -->
                    {#if estSuperadmin}
                      {#if u.id !== $authStore.user?.id}
                        <button
                          on:click={() => supprimer(u)}
                          data-testid="user-delete"
                          class="{ACTION} {ACTION_SUPPRIMER}">{$tr("admin.delete")}</button
                        >
                      {:else}
                        <span aria-hidden="true" class="invisible {ACTION}">{$tr("admin.delete")}</span>
                      {/if}
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <!-- Une carte par compte, sous lg : l'email entier (coupé au besoin
           plutôt que tronqué, c'est lui qui identifie le compte), puis le
           rôle, le statut et la dernière connexion, et les actions de 44 px
           (dessous au téléphone, à côté à partir de sm). Le rôle a rejoint le statut : traduit
           (« Administrateur »), à côté de l'adresse, il lui prenait jusqu'à
           110 px de large sur un téléphone. -->
      <ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
        {#each visibles as u (u.id)}
          <li class="space-y-3 p-4">
            <div class="min-w-0">
              <p class="coupe-mots font-medium text-zinc-950 dark:text-zinc-100">{#each morceauxEmail(u.email) as morceau, i (i)}{#if i}<wbr />{/if}<span class="whitespace-nowrap">{morceau}</span>{/each}</p>
              <p class="coupe-mots text-xs text-zinc-500 dark:text-zinc-400">@{u.username}</p>
              {#if u.full_name}
                <p class="coupe-mots text-xs text-zinc-500 dark:text-zinc-400">{u.full_name}</p>
              {/if}
            </div>
            <!-- Pleine largeur au téléphone ; à partir de sm (téléphone en
                 paysage, tablette), boutons à leur largeur, calés à droite :
                 étirés, « Modifier » et « Supprimer » faisaient 330 à 340 px
                 chacun, et « Modifier » seul couvrait toute la carte du compte
                 superadmin (660 à 690 px). Sur la ligne du rôle, du statut et
                 de la dernière connexion, et non sur une rangée à eux : seuls,
                 ils laissaient 70 % de leur ligne vide et ajoutaient environ
                 55 px à chaque carte. La ligne des badges cède la place
                 (min-w-0) et passe à la ligne avant les boutons. -->
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dl class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt class="sr-only">{$tr("admin.user.role")}</dt>
                  <dd><span class={BADGE_ROLE}><Icone nom={iconeRole(u.role)} class="text-sm" />{libelleRole(u.role, $tr)}</span></dd>
                </div>
                <div>
                  <dt class="sr-only">{$tr("admin.status")}</dt>
                  <dd><StatusBadge status={u.is_active ? "active" : "inactive"} size="sm" /></dd>
                </div>
                <div class="flex flex-wrap gap-x-1">
                  <dt class="text-zinc-500 dark:text-zinc-400">{$tr("admin.users.lastLogin")}</dt>
                  <dd class="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatDateCourte(u.last_login_at, $language.current)}</dd>
                </div>
              </dl>
              <div class="flex gap-2 sm:shrink-0">
                <button
                  on:click={() => ouvrirEdition(u)}
                  data-testid="user-edit"
                  class="h-11 flex-1 sm:flex-none sm:px-5 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
                  >{$tr("admin.edit")}</button
                >
                <!-- Même règle que le tableau : rendu seulement si la suppression
                     peut aboutir. -->
                {#if estSuperadmin && u.id !== $authStore.user?.id}
                  <button
                    on:click={() => supprimer(u)}
                    data-testid="user-delete"
                    class="h-11 flex-1 sm:flex-none sm:px-5 rounded-xl border border-red-200 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >{$tr("admin.delete")}</button
                  >
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Pied de la carte, le modèle des documents : résumé avec le nombre
         total et « Page 1 sur 2 » (et non « Page 1 / 2 »), puis les boutons
         de page, la page courante inversée et marquée `aria-current` (guide
         § 4.7). Le résumé ne se coupe qu'avant « • Page … ». Sous xl, comme
         sur les documents, première et dernière page s'effacent et
         Précédent / Suivant deviennent des flèches, nommées par aria-label. -->
    <div
      class="flex flex-col items-center justify-between gap-3 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:gap-4 sm:px-6"
    >
      <!-- Demi-cadratin entre les deux rangs (« 1–15 ») : le signe des
           intervalles, et non le trait d'union. -->
      <p class="text-center text-sm text-zinc-500 dark:text-zinc-400 sm:text-left">
        {$tr("admin.showing")}
        {premier}–{dernier}
        {$tr("admin.on")}
        {filtres.length}
        {#if totalPages > 1}
          <span class="whitespace-nowrap">• {$tr("admin.page")} {page} {$tr("admin.on")} {totalPages}</span>
        {/if}
      </p>

      {#if totalPages > 1}
        <nav
          class="flex flex-wrap items-center justify-center gap-1 sm:shrink-0 sm:flex-nowrap"
          aria-label={$tr("a11y.pagination")}
        >
          <button
            on:click={() => (page = 1)}
            disabled={page === 1}
            title={$tr("admin.firstPage")}
            aria-label={$tr("admin.firstPage")}
            class="hidden px-2 xl:inline-flex {PAGINATION} {PAGINATION_DISCRETE}"
          >
            <Icone nom="chevrons-left" class="text-xl" />
          </button>
          <button
            on:click={() => (page = Math.max(1, page - 1))}
            disabled={page === 1}
            data-testid="user-page-prev"
            aria-label={$tr("admin.previous")}
            class="inline-flex px-2 xl:px-3 {PAGINATION} {PAGINATION_DISCRETE}"
          >
            <Icone nom="chevron-left" class="text-xl xl:hidden" />
            <span class="hidden xl:inline">{$tr("admin.previous")}</span>
          </button>
          <div class="flex items-center gap-1 sm:mx-2">
            {#each numeros as numero (numero)}
              <button
                on:click={() => (page = numero)}
                data-testid="user-page-{numero}"
                aria-current={numero === page ? "page" : undefined}
                class="inline-flex px-3 {PAGINATION} {numero === page ? PAGINATION_COURANTE : PAGINATION_DISCRETE}"
              >
                {numero}
              </button>
            {/each}
          </div>
          <button
            on:click={() => (page = Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            data-testid="user-page-next"
            aria-label={$tr("admin.next")}
            class="inline-flex px-2 xl:px-3 {PAGINATION} {PAGINATION_DISCRETE}"
          >
            <Icone nom="chevron-right" class="text-xl xl:hidden" />
            <span class="hidden xl:inline">{$tr("admin.next")}</span>
          </button>
          <button
            on:click={() => (page = totalPages)}
            disabled={page === totalPages}
            title={$tr("admin.lastPage")}
            aria-label={$tr("admin.lastPage")}
            class="hidden px-2 xl:inline-flex {PAGINATION} {PAGINATION_DISCRETE}"
          >
            <Icone nom="chevrons-right" class="text-xl" />
          </button>
        </nav>
      {/if}
    </div>
  </div>
{/if}

<UserFormModal bind:show={modaleOuverte} user={userEnCours} on:saved={charger} />
