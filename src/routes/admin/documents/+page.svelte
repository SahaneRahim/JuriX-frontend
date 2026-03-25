<script lang="ts">
  import { API_URL } from '$lib/api';
  import { onMount } from "svelte";
  import UploadModal from "$lib/components/admin/UploadModal.svelte";
  import EditModal from "$lib/components/admin/EditModal.svelte";
  import { language, tr } from "$lib/stores/language";

  let searchQuery = "";
let documents: any[] = [];
  let categories: any[] = [];
  let loading = true;
  let showUploadModal = false;
  let showEditModal = false;
  let selectedDocument: any = null;

  // Filter states
  let selectedCategoryId: string = "";
  let selectedLanguage: string = "";
  let selectedStatus: string = "";

  onMount(async () => {
    await Promise.all([fetchDocuments(), fetchCategories()]);
  });

  async function fetchCategories() {
    try {
      const response = await fetch(`${API_URL}/api/v1/categories`);
      if (response.ok) {
        categories = await response.json();
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }

  async function fetchDocuments() {
    loading = true;
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
      if (selectedStatus) {
        params.append("law_status", selectedStatus);
      }

      const response = await fetch(
        `${API_URL}/api/v1/laws?${params.toString()}`,
      );
      if (response.ok) {
        documents = await response.json();
      } else {
        console.error("Failed to fetch documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      loading = false;
    }
  }

  // Reactive filter - refetch when filters change
  function applyFilters() {
    fetchDocuments();
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "active":
      case "published":
        return "bg-emerald-100 text-emerald-800";
      case "processing":
        return "bg-amber-100 text-amber-800 animate-pulse";
      case "pending":
        return "bg-blue-100 text-blue-800";
      case "refused":
        return "bg-red-100 text-red-800";
      case "archived":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "active":
      case "published":
        return $tr("admin.published");
      case "processing":
        return $tr("admin.processing");
      case "pending":
        return $tr("admin.pending");
      case "refused":
        return $tr("admin.refused");
      case "archived":
        return $tr("admin.archived");
      default:
        return status;
    }
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
      const response = await fetch(`${API_URL}/api/v1/admin/laws/${lawId}`, {
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

  function editDocument(doc: any) {
    selectedDocument = doc;
    showEditModal = true;
  }

  // Pagination state
  let currentPage = 1;
  const itemsPerPage = 15;

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
  $: totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
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

  // Generate page numbers to display (show max 7 pages with ellipsis)
  $: visiblePages = (() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  })();
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
  <button
    on:click={() => (showUploadModal = true)}
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
      class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
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
    />
  </div>
  <select
    class="rounded-lg border-slate-200 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
    bind:value={selectedCategoryId}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allCategories")}</option>
    {#each categories as category}
      <option value={category.id}>{category.name}</option>
    {/each}
  </select>
  <select
    class="rounded-lg border-slate-200 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
    bind:value={selectedLanguage}
    on:change={applyFilters}
  >
    <option value="">{$tr("admin.allLanguages")}</option>
    <option value="fr">🇫🇷 Français</option>
    <option value="en">🇬🇧 English</option>
  </select>
  <select
    class="rounded-lg border-slate-200 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
    bind:value={selectedStatus}
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
              >{new Date(doc.created_at).toLocaleDateString()}</td
            >
            <td class="px-6 py-4">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                {getStatusStyle(doc.status)}"
              >
                {getStatusLabel(doc.status)}
              </span>
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
        <span class="text-slate-400"
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
          {#each visiblePages as pageNum}
            {#if pageNum === "..."}
              <span class="px-2 py-1 text-slate-400">...</span>
            {:else}
              <button
                on:click={() => goToPage(Number(pageNum))}
                class="rounded px-3 py-1 text-sm transition-colors {currentPage ===
                pageNum
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'}"
              >
                {pageNum}
              </button>
            {/if}
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
