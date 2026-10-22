<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import UploadModal from "$lib/components/admin/UploadModal.svelte";
  import EditModal from "$lib/components/admin/EditModal.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import { formatDate } from "$lib/format";
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
   * Tableau à partir de md, cartes en dessous.
   *
   * Le tableau coupait au lieu de défiler : à 1 024 px la colonne Actions
   * était déjà rognée, et sur téléphone seuls les titres restaient visibles.
   * Une seule variante est RENDUE, plutôt que masquée en CSS : StatusBadge
   * porte un data-testid, qui se serait retrouvé en double sur chaque ligne.
   *
   * La page n'est jamais rendue par le serveur (le layout attend la garde
   * d'authentification, posée dans onMount) : la largeur se lit dès la création.
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
        console.log("✅ Document deleted successfully");
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

  // Trois numéros sous md : avec cinq, plus les flèches, la rangée dépassait
  // la largeur d'un téléphone de 360 px.
  $: visiblePages = pagesVisibles(currentPage, totalPages, tableau ? 5 : 3);
</script>

<UploadModal bind:show={showUploadModal} on:refresh={fetchDocuments} />
<EditModal
  bind:show={showEditModal}
  document={selectedDocument}
  on:refresh={fetchDocuments}
/>

<!-- Empilé sous md, et boutons qui passent à la ligne : côte à côte avec le
     titre, « Import en lot » et « Nouveau document » débordaient de l'écran.
     `flex-auto` : chacun garde sa largeur naturelle, et occupe toute la ligne
     quand les deux n'y tiennent plus. -->
<div class="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
  <div class="min-w-0">
    <h1 class="text-2xl font-bold text-slate-900 sm:text-3xl">
      {$tr("admin.docManagement")}
    </h1>
    <p class="mt-1 text-slate-500">
      {$tr("admin.docManagementDesc")}
    </p>
  </div>
  <div class="flex flex-wrap gap-2 sm:gap-3 md:shrink-0">
    <!-- /admin/documents/batch-upload existait mais n'était liée depuis nulle
         part : la page n'était atteignable qu'en tapant l'URL à la main. -->
    <a
      href="/admin/documents/batch-upload"
      data-testid="doc-batch-upload-link"
      class="flex min-h-11 flex-auto items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition-all hover:border-blue-400 hover:text-blue-700 sm:flex-none sm:px-5"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="h-5 w-5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      {$tr("admin.batchUpload")}
    </a>
    <button
      on:click={() => (showUploadModal = true)}
      data-testid="doc-new"
      class="flex min-h-11 flex-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 motion-safe:hover:scale-105 sm:flex-none sm:px-5"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="h-5 w-5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 4.5v15m7.5-7.5h-15"
        />
      </svg>
      {$tr("admin.newDoc")}
    </button>
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
     (`text-ellipsis`, que Chrome et Firefox appliquent aux listes). -->
<div
  class="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3 sm:gap-4 sm:p-4 xl:flex"
>
  <div class="relative min-w-0 sm:col-span-3 xl:min-w-[16rem] xl:flex-1">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
    <input
      type="text"
      placeholder={$tr("admin.searchDoc")}
      class="w-full rounded-lg border-slate-200 pl-10 text-base focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      bind:value={searchQuery}
          aria-label={$tr("a11y.searchField")}
    />
  </div>
  <select
    class="w-full min-w-0 text-ellipsis rounded-lg border-slate-200 text-base text-slate-600 focus:border-blue-500 focus:ring-blue-500 sm:text-sm xl:w-auto xl:max-w-[14rem]"
    bind:value={selectedCategoryId}
          aria-label={$tr("a11y.filterCategory")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allCategories")}</option>
    {#each categories as category (category.id)}
      <option value={category.id}>{nomCategorie(category.name, $language.current)}</option>
    {/each}
  </select>
  <select
    class="w-full min-w-0 text-ellipsis rounded-lg border-slate-200 text-base text-slate-600 focus:border-blue-500 focus:ring-blue-500 sm:text-sm xl:w-auto xl:max-w-[14rem]"
    bind:value={selectedLanguage}
          aria-label={$tr("a11y.filterLanguage")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allLanguages")}</option>
    <option value="fr">🇫🇷 Français</option>
    <option value="en">🇬🇧 English</option>
  </select>
  <select
    class="w-full min-w-0 text-ellipsis rounded-lg border-slate-200 text-base text-slate-600 focus:border-blue-500 focus:ring-blue-500 sm:text-sm xl:w-auto xl:max-w-[14rem]"
    bind:value={selectedStatus}
          aria-label={$tr("a11y.filterStatus")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allStatuses")}</option>
    <option value="published">{$tr("admin.published")}</option>
    <option value="pending">{$tr("admin.pending")}</option>
    <option value="processing">{$tr("admin.inProcess")}</option>
    <option value="archived">{$tr("admin.archived")}</option>
  </select>
</div>

<!-- Table -->
<div
  class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
>
  <!-- Les états (chargement, erreur, liste vide) sont rendus une fois, hors
       des deux variantes : en lignes de tableau, il aurait fallu les recopier
       dans les cartes, data-testid compris. -->
  {#if loading}
    <p class="px-6 py-4 text-center text-sm text-slate-600">{$tr("admin.loading")}</p>
  {:else if erreur}
    <!-- Sans cette branche, un serveur injoignable affichait « Aucun
         document trouve » : l'operateur concluait que la base etait vide. -->
    <div class="px-4 py-16 text-center sm:px-6" role="alert">
      <p class="mb-4 font-medium text-red-700" data-testid="docs-error">{erreur}</p>
      <button
        on:click={fetchDocuments}
        data-testid="docs-retry"
        class="min-h-11 rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
        >{$tr("common.retry")}</button
      >
    </div>
  {:else if filteredDocuments.length === 0}
    <p class="px-6 py-4 text-center text-sm text-slate-600">{$tr("admin.noDocFound")}</p>
  {:else if tableau}
    <!-- Seul le tableau défile : la pagination, en dessous, reste en place
         au lieu de partir avec lui hors de l'écran. Sous xl, la langue et la
         date d'ajout quittent leurs colonnes pour une ligne sous le titre,
         comme le nom dans le tableau des comptes : entre 768 et 1 100 px
         environ, ces deux colonnes ne laissaient au titre que 110 à 120 px,
         soit 10 à 14 lignes par document. -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm text-slate-600">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-4 font-semibold xl:px-6">{$tr("admin.docTitle")}</th>
            <th class="hidden px-4 py-4 font-semibold xl:table-cell xl:px-6">{$tr("admin.language")}</th>
            <th class="hidden px-4 py-4 font-semibold xl:table-cell xl:px-6">{$tr("admin.dateAdded")}</th>
            <th class="px-4 py-4 font-semibold xl:px-6">{$tr("admin.status")}</th>
            <th class="px-4 py-4 font-semibold text-right xl:px-6"
              >{$tr("admin.actions")}</th
            >
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each paginatedDocuments as doc (doc.id)}
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="px-4 py-4 xl:px-6">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500"
                  >
                    📄
                  </div>
                  <!-- Les cotes sans espace (« N°2018/9387/CAB/PM ») se
                       coupent au lieu d'élargir la colonne. -->
                  <div class="coupe-mots min-w-0">
                    <span class="block font-medium text-slate-900"
                      >{doc.title}</span
                    >
                    <span class="text-xs text-slate-500"
                      >{doc.reference || ""}</span
                    >
                    <!-- Langue et date sous xl, où leurs colonnes sont
                         masquées. En liste de définitions, comme dans les
                         cartes : privé de son en-tête de colonne, « FR » seul
                         ne dirait rien au lecteur d'écran. -->
                    <dl
                      class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 xl:hidden"
                    >
                      <dt class="sr-only">{$tr("admin.language")}</dt>
                      <dd class="font-bold uppercase">{doc.language || "N/A"}</dd>
                      <dt class="sr-only">{$tr("admin.dateAdded")}</dt>
                      <dd>{formatDate(doc.created_at, $language.current)}</dd>
                    </dl>
                  </div>
                </div>
              </td>
              <td class="hidden px-4 py-4 xl:table-cell xl:px-6">
                <span class="uppercase text-xs font-bold"
                  >{doc.language || "N/A"}</span
                >
              </td>
              <td class="hidden whitespace-nowrap px-4 py-4 xl:table-cell xl:px-6"
                >{formatDate(doc.created_at, $language.current)}</td
              >
              <td class="px-4 py-4 xl:px-6">
                <StatusBadge status={doc.status} size="sm" />
              </td>
              <!-- 44 px de haut sur tablette, au doigt ; liens texte à partir
                   de lg, comme avant. -->
              <td class="whitespace-nowrap px-4 py-4 text-right xl:px-6">
                <button
                  on:click={() => editDocument(doc)}
                  class="mr-1 inline-flex min-h-11 items-center px-2 font-medium text-blue-600 hover:text-blue-800 transition-colors lg:mr-3 lg:min-h-0 lg:px-0"
                >
                  {$tr("admin.edit")}
                </button>
                <button
                  on:click={() => deleteDocument(doc.id, doc.title)}
                  class="inline-flex min-h-11 items-center px-2 font-medium text-red-600 hover:text-red-800 transition-colors lg:min-h-0 lg:px-0"
                >
                  {$tr("admin.delete")}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <!-- Une carte par document, sous md : titre sur deux lignes au plus,
         cote coupée au besoin, puis langue et date, puis des actions de
         44 px sur toute la largeur. -->
    <ul class="divide-y divide-slate-100">
      {#each paginatedDocuments as doc (doc.id)}
        <li class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="coupe-mots line-clamp-2 font-medium text-slate-900" title={doc.title}>
                {doc.title}
              </p>
              {#if doc.reference}
                <p class="coupe-mots mt-0.5 text-xs text-slate-500">{doc.reference}</p>
              {/if}
            </div>
            <StatusBadge status={doc.status} size="sm" />
          </div>
          <dl class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <dt class="sr-only">{$tr("admin.language")}</dt>
            <dd class="font-bold uppercase">{doc.language || "N/A"}</dd>
            <dt class="sr-only">{$tr("admin.dateAdded")}</dt>
            <dd>{formatDate(doc.created_at, $language.current)}</dd>
          </dl>
          <div class="flex gap-2">
            <button
              on:click={() => editDocument(doc)}
              class="h-11 flex-1 rounded-lg border border-slate-200 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              {$tr("admin.edit")}
            </button>
            <button
              on:click={() => deleteDocument(doc.id, doc.title)}
              class="h-11 flex-1 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              {$tr("admin.delete")}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <!-- Pagination -->
  <div
    class="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:gap-4 sm:px-6"
  >
    <span class="text-center text-sm text-slate-500 sm:text-left">
      {$tr("admin.showing")}
      {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)}
      {$tr("admin.on")}
      {filteredDocuments.length}
      {$tr("admin.docs")}
      {#if totalPages > 1}
        <span class="text-slate-500"
          >• {$tr("admin.page")}
          {currentPage}
          {$tr("admin.on")}
          {totalPages}</span
        >
      {/if}
    </span>

    {#if totalPages > 1}
      <!-- Sur une seule ligne, «« Précédent 1-5 Suivant »» faisait 430 px :
           Suivant et »» disparaissaient sur téléphone. Sous sm, «« et »»
           s'effacent et Précédent / Suivant deviennent des flèches, nommées
           par aria-label ; boutons de 44 px au doigt. Les flèches ont une
           largeur fixe : avant la police d'icônes, le mot de la ligature
           (« chevron_left ») est bien plus large que le pictogramme. -->
      <div class="flex flex-wrap items-center justify-center gap-1">
        <!-- First page button -->
        <button
          on:click={() => goToPage(1)}
          disabled={currentPage === 1}
          class="hidden h-10 min-w-10 items-center justify-center rounded px-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed sm:inline-flex"
          title={$tr("admin.firstPage")}
          aria-label={$tr("admin.firstPage")}
        >
          ««
        </button>

        <!-- Previous button -->
        <button
          on:click={prevPage}
          disabled={currentPage === 1}
          aria-label={$tr("admin.previous")}
          class="inline-flex h-11 min-w-11 items-center justify-center rounded px-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed sm:h-10 sm:min-w-10 sm:px-3"
        >
          <span class="material-icons w-5 overflow-hidden text-xl sm:hidden" aria-hidden="true">chevron_left</span>
          <span class="hidden sm:inline">{$tr("admin.previous")}</span>
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
              class="inline-flex h-11 min-w-11 items-center justify-center rounded px-3 text-sm transition-colors sm:h-10 sm:min-w-10 {currentPage ===
              pageNum
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'}"
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
          class="inline-flex h-11 min-w-11 items-center justify-center rounded px-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed sm:h-10 sm:min-w-10 sm:px-3"
        >
          <span class="material-icons w-5 overflow-hidden text-xl sm:hidden" aria-hidden="true">chevron_right</span>
          <span class="hidden sm:inline">{$tr("admin.next")}</span>
        </button>

        <!-- Last page button -->
        <button
          on:click={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          class="hidden h-10 min-w-10 items-center justify-center rounded px-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed sm:inline-flex"
          title={$tr("admin.lastPage")}
          aria-label={$tr("admin.lastPage")}
        >
          »»
        </button>
      </div>
    {/if}
  </div>
</div>
