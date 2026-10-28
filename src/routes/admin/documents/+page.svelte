<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import UploadModal from "$lib/components/admin/UploadModal.svelte";
  import EditModal from "$lib/components/admin/EditModal.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  // Date courte, comme les autres écrans de l'administration.
  import { formatDateCourte } from "$lib/format";
  import { nombreDePages, pagesVisibles, TAILLE_PAGE_ADMIN } from "$lib/pagination";
  import { language, tr } from "$lib/stores/language";
  import { nomCategorie } from "$lib/categories";
  import type { Category, Law } from '$lib/types';

  let searchQuery = "";
let documents: Law[] = [];
  let erreur = "";
  let categories: Category[] = [];
  let loading = true;
  let showUploadModal = false;
  let showEditModal = false;
  let selectedDocument: Law | null = null;

  // Filter states
  let selectedCategoryId: string = "";
  let selectedLanguage: string = "";
  let selectedStatus: string = "";

  /**
   * Tableau à partir de lg, cartes en dessous, comme les comptes et l'import
   * en lot : les listes sœurs changent de forme à la même largeur. À partir
   * de md, à 768 px, les colonnes Statut et Actions prenaient près de la
   * moitié de la ligne : les titres, sur 230 px, tenaient sur 4 à 5 lignes,
   * et la page faisait 2 700 px de haut.
   *
   * Le tableau coupait au lieu de défiler : à 1 024 px la colonne Actions
   * était déjà rognée, et sur téléphone seuls les titres restaient visibles.
   * Une seule variante est RENDUE, plutôt que masquée en CSS : StatusBadge
   * porte un data-testid, qui se serait retrouvé en double sur chaque ligne.
   *
   * La page n'est jamais rendue par le serveur (le layout attend la garde
   * d'authentification, posée dans onMount) : la largeur se lit dès la création.
   */
  const REQUETE_TABLEAU = "(min-width: 1024px)";
  let tableau = browser && window.matchMedia(REQUETE_TABLEAU).matches;

  onMount(() => {
    const requete = window.matchMedia(REQUETE_TABLEAU);
    const suivre = () => (tableau = requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  });

  onMount(async () => {
    await Promise.all([fetchDocuments(), fetchCategories()]);
  });

  async function fetchCategories() {
    try {
      const response = await apiFetch(`/categories`);
      if (response.ok) {
        categories = await response.json();
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }

  async function fetchDocuments() {
    loading = true;
    erreur = "";
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("limit", "10000");

      if (selectedCategoryId) {
        params.append("category_id", selectedCategoryId);
      }
      if (selectedLanguage) {
        params.append("language", selectedLanguage);
      }
      // Toujours envoyer law_status, meme vide : sans ce parametre le backend
      // applique son defaut "published" et les documents pending / processing /
      // refused deviennent invisibles dans l'admin — donc impossible de suivre
      // un document pendant son traitement, ni de voir pourquoi il a echoue.
      // Une chaine vide desactive le filtre cote backend (laws.py, `if law_status:`).
      params.append("law_status", selectedStatus || "");

      // apiFetch et non fetch : ce fichier l'importait deja et s'en servait
      // pour /categories et le DELETE, mais pas pour la lecture principale.
      // Un jeton expire laissait donc la liste vide, affichee comme « Aucun
      // document trouve » — indiscernable d'une base vide.
      const response = await apiFetch(`/laws/?${params.toString()}`);
      if (response.ok) {
        documents = await response.json();
      } else {
        erreur = $tr("admin.docsError");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      erreur = $tr("admin.docsError");
    } finally {
      loading = false;
    }
  }

  // Reactive filter - refetch when filters change
  function applyFilters() {
    fetchDocuments();
  }



  async function deleteDocument(lawId: number, title: string) {
    if (
      !confirm(
        `${$tr("admin.confirmDelete")} "${title}" ?\n\n${$tr("admin.irreversible")}`,
      )
    ) {
      return;
    }

    try {
      const response = await apiFetch(`/laws/admin/${lawId}`, {
        method: "DELETE",
      });

      if (response.ok || response.status === 204) {
        // Remove document from local array
        documents = documents.filter((doc) => doc.id !== lawId);
        console.log("Document deleted successfully");
      } else {
        const error = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));
        alert(
          `${$tr("admin.deleteError")}: ${error.detail || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      alert($tr("admin.networkError"));
    }
  }

  function editDocument(doc: Law) {
    selectedDocument = doc;
    showEditModal = true;
  }

  // Pagination state
  let currentPage = 1;
  const itemsPerPage = TAILLE_PAGE_ADMIN;

  // Filter documents by search query (client-side)
  $: filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(query) ||
      doc.reference?.toLowerCase().includes(query)
    );
  });

  // Reset to page 1 when filters change
  $: if (
    searchQuery ||
    selectedCategoryId ||
    selectedLanguage ||
    selectedStatus
  ) {
    currentPage = 1;
  }

  // Pagination computed values
  $: totalPages = nombreDePages(filteredDocuments.length, itemsPerPage);
  $: startIndex = (currentPage - 1) * itemsPerPage;
  $: endIndex = startIndex + itemsPerPage;
  $: paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Pagination navigation functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  // Trois numéros avec les cartes (sous lg) : avec cinq, plus les flèches, la
  // rangée dépassait la largeur d'un téléphone de 360 px.
  $: visiblePages = pagesVisibles(currentPage, totalPages, tableau ? 5 : 3);
</script>

<UploadModal bind:show={showUploadModal} on:refresh={fetchDocuments} />
<EditModal
  bind:show={showEditModal}
  document={selectedDocument}
  on:refresh={fetchDocuments}
/>

<!-- Titre et boutons côte à côte à partir de lg : il leur faut environ
     780 px, et la barre latérale n'est une colonne qu'à partir de xl ; à
     1 024 px, le contenu fait 960 px. Ils attendaient xl, et passaient sous
     le titre à 1 024 px quand le tableau de bord, le blog et les comptes
     gardaient leur bouton à droite. Placés à côté dès md, ils coupaient le
     titre et sa description sur deux lignes à 768 px.
     L'action principale vient en premier : sur téléphone, où les boutons
     s'empilent sur toute la largeur, « Import en lot » passait au-dessus de
     « Nouveau document ». Boutons à la base du guide (§ 4.4) : 14 px, 44 px
     de haut, sans zoom au survol, comme ceux des autres pages. -->
<!-- Titre de page du guide (§ 4.2 : 30 puis 36 px), comme le tableau de
     bord et les comptes : en 24 puis 30 px, il changeait de taille d'une
     entrée de la barre latérale à l'autre. -->
<div class="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
  <div class="min-w-0">
    <h1 class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
      {$tr("admin.docManagement")}
    </h1>
    <!-- `text-pretty` : à 390 px, « loi » restait seul en dernière ligne
         (« … des textes de / loi »). -->
    <p class="mt-1 text-pretty text-zinc-500 dark:text-zinc-400">
      {$tr("admin.docManagementDesc")}
    </p>
  </div>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3 lg:shrink-0">
    <button
      on:click={() => (showUploadModal = true)}
      data-testid="doc-new"
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
    >
      <Icone nom="plus" class="text-lg" />
      {$tr("admin.newDoc")}
    </button>
    <!-- /admin/documents/batch-upload existait mais n'était liée depuis nulle
         part : la page n'était atteignable qu'en tapant l'URL à la main. -->
    <a
      href="/admin/documents/batch-upload"
      data-testid="doc-batch-upload-link"
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
    >
      <Icone nom="upload" class="text-lg" />
      {$tr("admin.batchUpload")}
    </a>
  </div>
</div>

<!-- Filters : sur une seule rangée sans retour à la ligne, chaque liste aussi
     large que sa plus longue option (« Toutes catégories », noms de
     catégories), il fallait environ 600 px, et la barre débordait de la carte
     et de la page. Grille sous xl. Champs à 16 px sur téléphone : en dessous,
     iOS zoome au focus.
     En rangée, à partir de xl, les listes plafonnent à 14 rem et la recherche
     garde au moins 16 rem : à 1 280 px, la liste des catégories s'élargissait
     jusqu'à son plus long nom et ne laissait qu'environ 155 px au champ de
     recherche. Un nom ainsi coupé finit par « … » plutôt qu'en plein mot
     (`text-ellipsis`, que Chrome et Firefox appliquent aux listes).
     44 px de haut à toutes les tailles, et 16 px de texte sauf à partir de
     sm sous un pointeur fin (la règle des pages de compte,
     login/+page.svelte) : compactés à 38 px et 14 px dès sm, les champs
     l'étaient aussi sur un téléphone en paysage (740 px), où iOS zoome au
     focus d'un champ de moins de 16 px, et sur les tablettes, au doigt ;
     les boutons voisins (Modifier, Supprimer, pages) gardaient 44 px. -->
<div
  class="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-3 sm:gap-4 sm:p-4 xl:flex"
>
  <div class="relative min-w-0 sm:col-span-3 xl:min-w-[16rem] xl:flex-1">
    <Icone
      nom="search"
      class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
    />
    <input
      type="text"
      placeholder={$tr("admin.searchDoc")}
      class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-base text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
      bind:value={searchQuery}
          aria-label={$tr("a11y.searchField")}
    />
  </div>
  <select
    class="min-h-11 w-full min-w-0 text-ellipsis rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm xl:w-auto xl:max-w-[14rem]"
    bind:value={selectedCategoryId}
          aria-label={$tr("a11y.filterCategory")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allCategories")}</option>
    {#each categories as category (category.id)}
      <option value={category.id}>{nomCategorie(category.name, $language.current)}</option>
    {/each}
  </select>
  <!-- Langues sans drapeau : une <option> n'accepte que du texte, donc ni
       icône ni SVG, et l'émoji de drapeau changeait de dessin d'un système à
       l'autre (Windows l'affiche en deux lettres). Chaque langue garde son
       nom dans sa propre langue, comme dans EditModal : il ne se traduit pas. -->
  <select
    class="min-h-11 w-full min-w-0 text-ellipsis rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm xl:w-auto xl:max-w-[14rem]"
    bind:value={selectedLanguage}
          aria-label={$tr("a11y.filterLanguage")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allLanguages")}</option>
    <option value="fr">Français</option>
    <option value="en">English</option>
  </select>
  <select
    class="min-h-11 w-full min-w-0 text-ellipsis rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm xl:w-auto xl:max-w-[14rem]"
    bind:value={selectedStatus}
          aria-label={$tr("a11y.filterStatus")}
    on:change={applyFilters}
  >
    <!-- Les six statuts du modèle Law (app/models/law.py), que le tableau
         affiche tous : « Refusé » et « Brouillon » manquaient au filtre, et
         un texte refusé ne se retrouvait qu'en parcourant la liste. Le
         serveur filtre sur n'importe lequel (law_status, laws.py). -->
    <option value="">{$tr("admin.allStatuses")}</option>
    <option value="published">{$tr("admin.published")}</option>
    <option value="pending">{$tr("admin.pending")}</option>
    <option value="processing">{$tr("admin.inProcess")}</option>
    <option value="refused">{$tr("admin.refused")}</option>
    <option value="draft">{$tr("admin.draft")}</option>
    <option value="archived">{$tr("admin.archived")}</option>
  </select>
</div>

<!-- Table -->
<div
  class="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
>
  <!-- Les états (chargement, erreur, liste vide) sont rendus une fois, hors
       des deux variantes : en lignes de tableau, il aurait fallu les recopier
       dans les cartes, data-testid compris. -->
  {#if loading}
    <p class="px-6 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{$tr("admin.loading")}</p>
  {:else if erreur}
    <!-- Sans cette branche, un serveur injoignable affichait « Aucun
         document trouve » : l'operateur concluait que la base etait vide.
         Le rouge est celui des erreurs ; « Réessayer » n'est pas une action
         destructrice, il garde le bouton neutre, comme sur le tableau de bord. -->
    <div class="px-4 py-16 text-center sm:px-6" role="alert">
      <p class="mb-4 flex items-center justify-center gap-2 font-medium text-red-700 dark:text-red-300" data-testid="docs-error">
        <Icone nom="circle-alert" class="text-xl" />{erreur}
      </p>
      <button
        on:click={fetchDocuments}
        data-testid="docs-retry"
        class="min-h-11 rounded-xl border border-zinc-300 bg-white px-5 py-2 font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
        >{$tr("common.retry")}</button
      >
    </div>
  {:else if filteredDocuments.length === 0}
    <p class="px-6 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{$tr("admin.noDocFound")}</p>
  {:else if tableau}
    <!-- Seul le tableau défile : la pagination, en dessous, reste en place
         au lieu de partir avec lui hors de l'écran. Sous xl, la langue et la
         date d'ajout quittent leurs colonnes pour une ligne sous le titre,
         comme le nom dans le tableau des comptes : entre 768 et 1 100 px
         environ, ces deux colonnes ne laissaient au titre que 110 à 120 px,
         soit 10 à 14 lignes par document. -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
        <thead
          class="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
        >
          <tr>
            <!-- En-têtes sur une ligne (`whitespace-nowrap`) et en `py-3`, comme
                 le tableau des comptes : « DATE D'AJOUT » passait sur deux
                 lignes à 1 440 px, et la rangée faisait 64 px au lieu de 40. -->
            <th class="whitespace-nowrap px-4 py-3 font-semibold xl:px-6">{$tr("admin.docTitle")}</th>
            <th class="hidden whitespace-nowrap px-4 py-3 font-semibold xl:table-cell xl:px-6">{$tr("admin.language")}</th>
            <th class="hidden whitespace-nowrap px-4 py-3 font-semibold xl:table-cell xl:px-6">{$tr("admin.dateAdded")}</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold xl:px-6">{$tr("admin.status")}</th>
            <th class="whitespace-nowrap px-4 py-3 font-semibold text-right xl:px-6"
              >{$tr("admin.actions")}</th
            >
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
          {#each paginatedDocuments as doc (doc.id)}
            <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
              <td class="px-4 py-4 xl:px-6">
                <div class="flex items-center gap-3">
                  <!-- L'icône de document du tableau de bord, et non plus un
                       émoji, dont le dessin et la couleur changeaient d'un
                       système à l'autre. Coins `rounded-xl`, ceux de toutes
                       les tuiles d'icône (guide § 4.1) : en `rounded-lg`,
                       celle-ci était plus anguleuse que ses voisines. -->
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <Icone nom="file-text" class="text-base" />
                  </div>
                  <!-- Les cotes sans espace (« N°2018/9387/CAB/PM ») se
                       coupent au lieu d'élargir la colonne. -->
                  <div class="coupe-mots min-w-0">
                    <span class="block font-medium text-zinc-950 dark:text-zinc-100"
                      >{doc.title}</span
                    >
                    <!-- Cote et date à la recette « Méta » du guide (§ 4.2) :
                         chasse fixe, chiffres tabulaires, zinc-500, comme les
                         dates du tableau de bord et du blog. -->
                    <span class="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
                      >{doc.reference || ""}</span
                    >
                    <!-- Langue et date sous xl, où leurs colonnes sont
                         masquées. En liste de définitions, comme dans les
                         cartes : privé de son en-tête de colonne, « FR » seul
                         ne dirait rien au lecteur d'écran. -->
                    <dl
                      class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 xl:hidden"
                    >
                      <dt class="sr-only">{$tr("admin.language")}</dt>
                      <dd class="font-bold uppercase">{doc.language || "N/A"}</dd>
                      <dt class="sr-only">{$tr("admin.dateAdded")}</dt>
                      <dd class="font-mono tabular-nums">{formatDateCourte(doc.created_at, $language.current)}</dd>
                    </dl>
                  </div>
                </div>
              </td>
              <td class="hidden px-4 py-4 xl:table-cell xl:px-6">
                <span class="uppercase text-xs font-bold"
                  >{doc.language || "N/A"}</span
                >
              </td>
              <td class="hidden whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400 xl:table-cell xl:px-6"
                >{formatDateCourte(doc.created_at, $language.current)}</td
              >
              <td class="px-4 py-4 xl:px-6">
                <StatusBadge status={doc.status} size="sm" />
              </td>
              <!-- Boutons discrets du guide (§ 4.4), de 44 px de haut à toute
                   largeur, comme ceux du tableau des comptes. Réduits à des
                   liens texte d'environ 20 px à partir de lg, ils l'étaient
                   aussi à 1 024 px : une tablette en paysage, au doigt.
                   `-mr-3` rend aux boutons le retrait de leur `px-3` : le
                   texte de « Supprimer » s'arrête au bord de la colonne,
                   sous la fin de l'en-tête « Actions », au lieu de 12 px
                   avant ; le fond du survol déborde dans la marge de la
                   cellule. -->
              <td class="whitespace-nowrap px-4 py-4 xl:px-6">
                <div class="-mr-3 flex items-center justify-end gap-1">
                  <button
                    on:click={() => editDocument(doc)}
                    class="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    {$tr("admin.edit")}
                  </button>
                  <button
                    on:click={() => deleteDocument(doc.id, doc.title)}
                    class="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  >
                    {$tr("admin.delete")}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <!-- Une carte par document, sous lg : le titre sur toute la largeur, en
         trois lignes au plus, sa cote coupée au besoin, puis le statut, la
         langue et la date, puis les actions.
         Le badge de statut était à côté du titre : il lui prenait environ
         110 px, et le titre, limité à deux lignes, s'arrêtait avant la fin
         de sa propre cote (« Décret N°2018/9387/CAB/PM d… »), si bien que
         les décrets se distinguaient mal.
         Actions de 44 px sur toute la largeur au téléphone ; à partir de sm,
         à leur largeur, calées à droite sur la ligne du statut, comme dans
         les cartes des comptes. Étirés, « Modifier » et « Supprimer » faisaient
         325 px chacun à 740 px de large, et une carte 210 px de haut : un
         écran de 360 px n'en montrait qu'une et demie. -->
    <ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
      {#each paginatedDocuments as doc (doc.id)}
        <li class="space-y-3 p-4">
          <div class="min-w-0">
            <p class="coupe-mots line-clamp-3 font-medium text-zinc-950 dark:text-zinc-100" title={doc.title}>
              {doc.title}
            </p>
            {#if doc.reference}
              <p class="coupe-mots mt-0.5 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{doc.reference}</p>
            {/if}
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dl class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <dt class="sr-only">{$tr("admin.status")}</dt>
              <dd class="flex"><StatusBadge status={doc.status} size="sm" /></dd>
              <dt class="sr-only">{$tr("admin.language")}</dt>
              <dd class="font-bold uppercase">{doc.language || "N/A"}</dd>
              <dt class="sr-only">{$tr("admin.dateAdded")}</dt>
              <dd class="font-mono tabular-nums">{formatDateCourte(doc.created_at, $language.current)}</dd>
            </dl>
            <div class="flex gap-2 sm:shrink-0">
              <button
                on:click={() => editDocument(doc)}
                class="h-11 flex-1 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:flex-none sm:px-5"
              >
                {$tr("admin.edit")}
              </button>
              <button
                on:click={() => deleteDocument(doc.id, doc.title)}
                class="h-11 flex-1 rounded-xl border border-red-200 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 sm:flex-none sm:px-5"
              >
                {$tr("admin.delete")}
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <!-- Pagination. Le résumé ne se coupe qu'avant « • Page … », jamais au
       milieu : à côté des boutons, « Page 1 » restait au bout d'une ligne et
       « sur 2 » partait seul sur la suivante. Sans nom après le total
       (« … sur 20 »), comme le résumé des comptes : « document(s) » n'y
       figurait qu'ici, avec son pluriel entre parenthèses. L'intervalle
       prend un demi-cadratin (« 1–15 »), le signe des intervalles, et non
       le trait d'union. -->
  <div
    class="flex flex-col items-center justify-between gap-3 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:gap-4 sm:px-6"
  >
    <span class="text-center text-sm text-zinc-500 dark:text-zinc-400 sm:text-left">
      {$tr("admin.showing")}
      {startIndex + 1}–{Math.min(endIndex, filteredDocuments.length)}
      {$tr("admin.on")}
      {filteredDocuments.length}
      {#if totalPages > 1}
        <span class="whitespace-nowrap"
          >• {$tr("admin.page")}
          {currentPage}
          {$tr("admin.on")}
          {totalPages}</span
        >
      {/if}
    </span>

    {#if totalPages > 1}
      <!-- Sur une seule ligne, «« Précédent 1-5 Suivant »» faisait 430 px :
           Suivant et »» disparaissaient sur téléphone. Sous xl, les doubles
           chevrons (première et dernière page) s'effacent et Précédent /
           Suivant deviennent des flèches, nommées par aria-label : de 768 à
           1 280 px, à côté du résumé, la version complète passait sur deux
           lignes et laissait »» seul sur la seconde. À partir de sm, les
           boutons ne passent plus à la ligne : c'est le résumé qui cède la
           place. Boutons de 44 px à toute largeur, comme ceux des comptes :
           ramenés à 40 px dès sm, ils étaient trop petits au doigt sur
           tablette. -->
      <div class="flex flex-wrap items-center justify-center gap-1 sm:shrink-0 sm:flex-nowrap">
        <!-- First page button -->
        <button
          on:click={() => goToPage(1)}
          disabled={currentPage === 1}
          class="hidden h-11 min-w-11 items-center justify-center rounded-xl px-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white xl:inline-flex"
          title={$tr("admin.firstPage")}
          aria-label={$tr("admin.firstPage")}
        >
          <Icone nom="chevrons-left" class="text-xl" />
        </button>

        <!-- Previous button -->
        <button
          on:click={prevPage}
          disabled={currentPage === 1}
          aria-label={$tr("admin.previous")}
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white xl:px-3"
        >
          <Icone nom="chevron-left" class="text-xl xl:hidden" />
          <span class="hidden xl:inline">{$tr("admin.previous")}</span>
        </button>

        <!-- Page numbers -->
        <div class="flex items-center gap-1 sm:mx-2">
          <!-- La branche « ... » a disparu avec l'ancienne fenetre a sept
               numeros : pagesVisibles rend une plage contigue de nombres, donc
               le rendu n'a plus a distinguer number et string. -->
          {#each visiblePages as pageNum (pageNum)}
            <button
              on:click={() => goToPage(pageNum)}
              data-testid="docs-page-{pageNum}"
              aria-current={pageNum === currentPage ? "page" : undefined}
              class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm transition-colors {currentPage ===
              pageNum
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-sm dark:shadow-none'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'}"
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <!-- Next button -->
        <button
          on:click={nextPage}
          disabled={currentPage === totalPages}
          aria-label={$tr("admin.next")}
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white xl:px-3"
        >
          <Icone nom="chevron-right" class="text-xl xl:hidden" />
          <span class="hidden xl:inline">{$tr("admin.next")}</span>
        </button>

        <!-- Last page button -->
        <button
          on:click={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          class="hidden h-11 min-w-11 items-center justify-center rounded-xl px-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white xl:inline-flex"
          title={$tr("admin.lastPage")}
          aria-label={$tr("admin.lastPage")}
        >
          <Icone nom="chevrons-right" class="text-xl" />
        </button>
      </div>
    {/if}
  </div>
</div>
