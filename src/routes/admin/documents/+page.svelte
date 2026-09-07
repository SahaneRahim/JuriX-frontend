<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { onMount } from "svelte";
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

  $: visiblePages = pagesVisibles(currentPage, totalPages);
</script>

<UploadModal bind:show={showUploadModal} on:refresh={fetchDocuments} />
<EditModal
  bind:show={showEditModal}
  document={selectedDocument}
  on:refresh={fetchDocuments}
/>

<div class="mb-8 flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold text-slate-900">
      {$tr("admin.docManagement")}
    </h1>
    <p class="mt-1 text-slate-500">
      {$tr("admin.docManagementDesc")}
    </p>
  </div>
  <div class="flex items-center gap-3">
    <!-- /admin/documents/batch-upload existait mais n'était liée depuis nulle
         part : la page n'était atteignable qu'en tapant l'URL à la main. -->
    <a
      href="/admin/documents/batch-upload"
      data-testid="doc-batch-upload-link"
      class="flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition-all hover:border-blue-400 hover:text-blue-700"
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

<!-- Filters -->
<div
  class="mb-6 flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
>
  <div class="relative flex-1">
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
      class="w-full rounded-lg border-slate-200 pl-10 text-sm focus:border-blue-500 focus:ring-blue-500"
      bind:value={searchQuery}
          aria-label={$tr("a11y.searchField")}
    />
  </div>
  <select
    class="rounded-lg border-slate-200 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
    bind:value={selectedCategoryId}
          aria-label={$tr("a11y.filterCategory")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allCategories")}</option>
    {#each categories as category}
      <option value={category.id}>{nomCategorie(category.name, $language.current)}</option>
    {/each}
  </select>
  <select
    class="rounded-lg border-slate-200 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
    bind:value={selectedLanguage}
          aria-label={$tr("a11y.filterLanguage")}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allLanguages")}</option>
    <option value="fr">🇫🇷 Français</option>
    <option value="en">🇬🇧 English</option>
  </select>
  <select
    class="rounded-lg border-slate-200 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
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
  <table class="w-full text-left text-sm text-slate-600">
    <thead class="bg-slate-50 text-xs uppercase text-slate-500">
      <tr>
        <th class="px-6 py-4 font-semibold">{$tr("admin.docTitle")}</th>
        <th class="px-6 py-4 font-semibold">{$tr("admin.language")}</th>
        <th class="px-6 py-4 font-semibold">{$tr("admin.dateAdded")}</th>
        <th class="px-6 py-4 font-semibold">{$tr("admin.status")}</th>
        <th class="px-6 py-4 font-semibold text-right"
          >{$tr("admin.actions")}</th
        >
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      {#if loading}
        <tr
          ><td colspan="5" class="px-6 py-4 text-center"
            >{$tr("admin.loading")}</td
          ></tr
        >
        {:else if erreur}
          <!-- Sans cette branche, un serveur injoignable affichait « Aucun
               document trouve » : l'operateur concluait que la base etait vide. -->
          <tr>
            <td colspan="6" class="px-6 py-16 text-center" role="alert">
              <p class="mb-4 font-medium text-red-700" data-testid="docs-error">{erreur}</p>
              <button
                on:click={fetchDocuments}
                data-testid="docs-retry"
                class="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
                >{$tr("common.retry")}</button
              >
            </td>
          </tr>
      {:else if filteredDocuments.length === 0}
        <tr
          ><td colspan="5" class="px-6 py-4 text-center"
            >{$tr("admin.noDocFound")}</td
          ></tr
        >
      {:else}
        {#each paginatedDocuments as doc}
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-500"
                >
                  📄
                </div>
                <div>
                  <span class="block font-medium text-slate-900"
                    >{doc.title}</span
                  >
                  <span class="text-xs text-slate-500"
                    >{doc.reference || ""}</span
                  >
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="uppercase text-xs font-bold"
                >{doc.language || "N/A"}</span
              >
            </td>
            <td class="px-6 py-4"
              >{formatDate(doc.created_at, $language.current)}</td
            >
            <td class="px-6 py-4">
              <StatusBadge status={doc.status} size="sm" />
            </td>
            <td class="px-6 py-4 text-right">
              <button
                on:click={() => editDocument(doc)}
                class="font-medium text-blue-600 hover:text-blue-800 mr-3 transition-colors"
              >
                {$tr("admin.edit")}
              </button>
              <button
                on:click={() => deleteDocument(doc.id, doc.title)}
                class="font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                {$tr("admin.delete")}
              </button>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>

  <!-- Pagination -->
  <div
    class="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 px-6 py-4 gap-4"
  >
    <span class="text-sm text-slate-500">
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
      <div class="flex items-center gap-1">
        <!-- First page button -->
        <button
          on:click={() => goToPage(1)}
          disabled={currentPage === 1}
          class="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          title={$tr("admin.firstPage")}
        >
          ««
        </button>

        <!-- Previous button -->
        <button
          on:click={prevPage}
          disabled={currentPage === 1}
          class="rounded px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {$tr("admin.previous")}
        </button>

        <!-- Page numbers -->
        <div class="flex items-center gap-1 mx-2">
          <!-- La branche « ... » a disparu avec l'ancienne fenetre a sept
               numeros : pagesVisibles rend une plage contigue de nombres, donc
               le rendu n'a plus a distinguer number et string. -->
          {#each visiblePages as pageNum (pageNum)}
            <button
              on:click={() => goToPage(pageNum)}
              data-testid="docs-page-{pageNum}"
              aria-current={pageNum === currentPage ? "page" : undefined}
              class="rounded px-3 py-1 text-sm transition-colors {currentPage ===
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
          class="rounded px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {$tr("admin.next")}
        </button>

        <!-- Last page button -->
        <button
          on:click={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          class="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          title={$tr("admin.lastPage")}
        >
          »»
        </button>
      </div>
    {/if}
  </div>
</div>
