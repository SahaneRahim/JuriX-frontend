<script lang="ts">
  import { API_URL } from '$lib/api';
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { language, tr } from "$lib/stores/language";
  import { fade, fly } from "svelte/transition";

  // Get category ID from URL params
  $: categoryId = $page.params.id;

  // State
  let documents: any[] = [];
  let isLoading = true;
  let error = "";
  let categoryTitle = "";
  let categoryDesc = "";

  // Helper to get category details from ID
  function getCategoryDetails(id: string) {
    const key = `cat.${id}`;
    const descKey = `catdesc.${id}`;
    // We use the store's value reactively
    return {
      title: $tr(key),
      description: $tr(descKey),
    };
  }

  // Update title/desc when categoryId or language changes
  $: {
    if (categoryId) {
      const details = getCategoryDetails(categoryId);
      categoryTitle = details.title;
      categoryDesc = details.description;
    }
  }

  // Fetch categories and find the ID for the current slug
  async function getCategoryIdFromName(slug: string): Promise<number | null> {
    try {
      const response = await fetch("${API_URL}/api/v1/categories");
      if (!response.ok) return null;

      const categories = await response.json();

      // Map frontend slugs to likely backend names (or partial match)
      // This is necessary because backend uses IDs and French names, frontend uses slugs
      const normalizedSlug = slug.toLowerCase();

      // 1. Try to match by simplified name
      const targetName =
        {
          constitutionnel: "constitution",
          international: "international",
          civil: "civil",
          penal: "p\u00e9nal", // pénal
          travail: "travail",
          fiscal: "fiscal",
          affaires: "affaires",
          lois: "lois",
          ordonnances: "ordonnances",
          decrets: "d\u00e9crets", // décrets
          arretes: "arr\u00eat\u00e9s", // arrêtés
          circulaires: "circulaires",
          decisions: "d\u00e9cisions", // décisions
          autres: "autres",
        }[normalizedSlug] || normalizedSlug;

      const found = categories.find(
        (c: any) =>
          c.name.toLowerCase().includes(targetName) ||
          (normalizedSlug === "penal" &&
            c.name.toLowerCase().includes("p\u00e9nal")),
      );

      return found ? found.id : null;
    } catch (e) {
      console.error("Error fetching categories:", e);
      return null;
    }
  }

  // Fetch documents for the category
  async function fetchCategoryDocuments(
    slug: string,
    language: string = "all",
  ) {
    isLoading = true;
    error = "";
    documents = [];

    try {
// 1. Get the numeric ID from the backend
      const backendId = await getCategoryIdFromName(slug);

      if (!backendId) {
        console.warn(`Category ID not found for slug: ${slug}`);
        // Fallback: Use search API if category mapping failed?
        const filterMap: Record<string, string> = {
          constitutionnel: "constitution",
          lois: "loi",
          ordonnances: "ordonnance",
          decrets: "decret",
          arretes: "arrete",
          circulaires: "circulaire",
          decisions: "decision",
          civil: "civil",
          penal: "penal",
          travail: "travail",
          fiscal: "fiscal",
          affaires: "affaires",
          international: "international",
          autres: "autre",
        };
        const filter = filterMap[slug] || slug;

        const searchBody: any = {
          query: filter,
          mode: "text",
          limit: 50,
        };
        if (language !== "all") {
          searchBody.filters = { language: language };
        }

        const response = await fetch(`${API_URL}/api/v1/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(searchBody),
        });

        if (!response.ok) throw new Error("Backend unavailable");
        const data = await response.json();
        documents = data.results || [];
        isLoading = false;
        return;
      }

      // 2. Fetch laws using the ID and language
      let url = `${API_URL}/api/v1/laws?category_id=${backendId}&limit=50`;
      if (language !== "all") {
        url += `&language=${language}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      documents = data;
    } catch (e) {
      console.error(e);
      error = $tr("categories.errorLoad");
    } finally {
      isLoading = false;
    }
  }

  // Initial fetch on mount
  onMount(() => {
    if (categoryId) {
      fetchCategoryDocuments(categoryId, selectedLanguage);
    }
  });

  function formatDate(dateString: string) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString(
      $language.current === "fr" ? "fr-FR" : "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );
  }

  // Search and Filter State
  let searchQuery = "";
  let selectedLanguage = $language.current; // Default to platform language ('fr' or 'en')

  // Filtered documents (Client-side search only, language is server-side)
  $: filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      searchQuery === "" ||
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Trigger fetch when category or language changes
  $: if (categoryId) {
    fetchCategoryDocuments(categoryId, selectedLanguage);
  }

  // Category Icon & Color mapping (duplicated from categories page for styling)
  const categoryStyles: Record<string, { icon: string; bg: string }> = {
    constitutionnel: {
      icon: "account_balance",
      bg: "bg-amber-100 text-amber-600",
    },
    international: { icon: "public", bg: "bg-blue-100 text-blue-600" },
    civil: { icon: "groups", bg: "bg-purple-100 text-purple-600" },
    penal: { icon: "lock", bg: "bg-rose-100 text-rose-600" },
    travail: { icon: "work", bg: "bg-sky-100 text-sky-600" },
    fiscal: { icon: "attach_money", bg: "bg-emerald-100 text-emerald-600" },
    affaires: { icon: "business_center", bg: "bg-red-100 text-red-600" },
    lois: { icon: "menu_book", bg: "bg-indigo-100 text-indigo-600" },
    ordonnances: {
      icon: "assignment_late",
      bg: "bg-orange-100 text-orange-600",
    },
    decrets: { icon: "description", bg: "bg-teal-100 text-teal-600" },
    arretes: { icon: "rule", bg: "bg-cyan-100 text-cyan-600" },
    circulaires: { icon: "campaign", bg: "bg-lime-100 text-lime-600" },
    decisions: { icon: "fact_check", bg: "bg-blue-100 text-blue-800" },
    autres: { icon: "category", bg: "bg-slate-100 text-slate-600" },
  };

  $: currentStyle = categoryStyles[categoryId?.toLowerCase()] || {
    icon: "folder",
    bg: "bg-slate-100 text-slate-500",
  };
</script>

<svelte:head>
  <title>JuriX - {categoryTitle}</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
  <!-- Blue Header Section -->
  <div
    class="bg-blue-600 dark:bg-blue-800 text-white pb-32 pt-8 px-4 relative overflow-hidden"
  >
    <!-- Background Pattern/Gradient (Optional) -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-700 opacity-50"
    ></div>

    <div class="max-w-7xl mx-auto relative z-10">
      <!-- Back Link -->
      <a
        href="/"
        class="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-8 font-medium"
      >
        <span class="material-icons text-sm">arrow_back</span>
        {$tr("categories.backHome")}
      </a>

      <!-- Icon & Title -->
      <div class="flex items-center gap-6">
        <div
          class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner"
        >
          <span class="material-icons text-4xl text-white"
            >{currentStyle.icon}</span
          >
        </div>
        <div>
          <h1
            class="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight"
          >
            {categoryTitle}
          </h1>
          <p class="text-blue-100 text-lg opacity-90 max-w-2xl">
            {categoryDesc}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content overlap -->
  <div class="max-w-7xl mx-auto px-4 -mt-24 relative z-20">
    <!-- Search Bar Card -->
    <div
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-2 mb-8 flex flex-col md:flex-row items-center gap-4"
    >
      <!-- Input -->
      <div class="flex-1 relative w-full">
        <span
          class="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-slate-400"
          >search</span
        >
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={$tr("categories.searchPlaceholder")}
          class="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-200 placeholder-slate-400 font-medium transition-shadow"
        />
      </div>

      <!-- Language Filter -->
      <div
        class="flex items-center gap-3 px-4 py-2 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 w-full md:w-auto justify-between md:justify-start"
      >
        <span class="text-sm font-semibold text-slate-500 mr-2"
          >{$tr("categories.langLabel")} :</span
        >
        <div class="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedLanguage ===
            'fr'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
            on:click={() => (selectedLanguage = "fr")}>FR</button
          >
          <button
            class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedLanguage ===
            'en'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
            on:click={() => (selectedLanguage = "en")}>EN</button
          >
          <button
            class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedLanguage ===
            'all'
              ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
            on:click={() => (selectedLanguage = "all")}
            >{$tr("categories.all")}</button
          >
        </div>
      </div>
    </div>

    <!-- Results Section -->
    <div>
      {#if isLoading}
        <div
          class="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100"
        >
          <div
            class="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"
          ></div>
          <p class="text-slate-500 font-medium">
            {$tr("categories.loadingDocs")}
          </p>
        </div>
      {:else if error}
        <div
          class="bg-red-50 dark:bg-red-900/20 text-red-600 p-8 rounded-2xl text-center border border-red-100 dark:border-red-900/30"
        >
          <span class="material-icons text-4xl mb-2">error_outline</span>
          <p class="font-medium mb-4">{error}</p>
          <button
            class="px-6 py-2 bg-white text-red-600 font-semibold rounded-lg shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
            on:click={() => fetchCategoryDocuments(categoryId)}
          >
            {$tr("categories.retry")}
          </button>
        </div>
      {:else if filteredDocuments.length === 0}
        <div
          class="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100"
        >
          <div
            class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <span class="material-icons text-3xl text-slate-400"
              >search_off</span
            >
          </div>
          <p class="text-slate-900 font-medium mb-1">
            {$tr("categories.noDocsTitle")}
          </p>
          <p class="text-slate-500 text-sm">{$tr("categories.noDocsDesc")}</p>
        </div>
      {:else}
        <p class="text-sm font-medium text-slate-500 mb-4 pl-1">
          {filteredDocuments.length}
          {$tr("categories.docsCount")}
        </p>

        <div class="grid gap-4">
          {#each filteredDocuments as doc, i}
            <a
              href="/laws/{doc.id}"
              class="group block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              in:fly={{ y: 20, duration: 400, delay: i * 50 }}
            >
              <div class="p-5 flex gap-5 items-start">
                <!-- Icon Box -->
                <div
                  class="shrink-0 w-12 h-12 rounded-xl {currentStyle.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                >
                  <span class="material-icons text-2xl"
                    >{currentStyle.icon}</span
                  >
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 pt-0.5">
                  <h3
                    class="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-2 group-hover:text-blue-600 transition-colors"
                  >
                    {doc.title || $tr("search.noTitle")}
                  </h3>

                  <p
                    class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed"
                  >
                    {(doc.content || $tr("categories.noPreview"))
                      .replace(/<<PAGE:?\s*\d+>>/gi, "")
                      .replace(/\s+/g, " ")
                      .trim()}
                  </p>

                  <!-- Footer Tags -->
                  <div class="flex items-center gap-3">
                    <!-- Language Tag (Mock) -->
                    <span
                      class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wide"
                    >
                      FR
                    </span>

                    <!-- Date -->
                    {#if doc.date || doc.publication_date}
                      <span
                        class="flex items-center gap-1.5 text-xs font-medium text-slate-400"
                      >
                        <span class="material-icons text-[14px]"
                          >calendar_today</span
                        >
                        {formatDate(doc.date || doc.publication_date)}
                      </span>
                    {/if}
                  </div>
                </div>

                <!-- Chevron -->
                <div class="self-center pl-2">
                  <span
                    class="material-icons text-slate-300 group-hover:text-blue-500 transition-colors"
                    >chevron_right</span
                  >
                </div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
