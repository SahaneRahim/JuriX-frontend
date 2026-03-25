<script lang="ts">
  import { API_URL } from '$lib/api';
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import { themeStore } from "$lib/stores/theme";

// State
  let searchQuery = "";
  let activeTab = "all";
  let isLoading = true;
  let results: any[] = [];
  let totalResults = 0;
  let searchTimeMs = 0;
  let currentPage = 1;
  let errorMessage = "";
  let sortBy = "relevance";

  // Dynamic translations - computed
  $: categories = [
    $tr("search.laborLaw"),
    $tr("search.civilLaw"),
    $tr("search.criminalLaw"),
    $tr("search.businessLaw"),
    $tr("search.taxLaw"),
    $tr("search.constitutionalLaw"),
  ];

  $: tabFilters = [
    {
      id: "all",
      icon: "description",
      label: $tr("search.allTexts"),
      filter: null,
    },
    { id: "laws", icon: "gavel", label: $tr("search.laws"), filter: "loi" },
    {
      id: "decrees",
      icon: "assignment",
      label: $tr("search.decrees"),
      filter: "decret",
    },
    {
      id: "articles",
      icon: "article",
      label: $tr("search.articles"),
      filter: "article",
    },
  ];

  onMount(() => {
    const urlQuery = $page.url.searchParams.get("q");
    if (urlQuery) {
      searchQuery = urlQuery;
      performSearch();
    } else {
      isLoading = false;
    }
  });

  // Removed: reactive block was preventing user from editing input
  // The onMount above handles initial URL parameter loading

  async function performSearch() {
    if (!searchQuery.trim()) {
      results = [];
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMessage = "";

    try {
      const response = await fetch(`${API_URL}/api/v1/search/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          mode: "text",
          limit: 20,
          filters: { status: "published" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results = data.results || [];
        totalResults = data.total || results.length;
        searchTimeMs = data.search_time_ms || 0;
      } else {
        errorMessage = $tr("search.errorSearch");
        results = [];
      }
    } catch (error) {
      console.error("Search error:", error);
      errorMessage = $tr("search.errorServer");
      results = [];
    } finally {
      isLoading = false;
    }
  }

  function handleSearchSubmit() {
    goto(`/search?q=${encodeURIComponent(searchQuery)}`, {
      replaceState: true,
    });
    performSearch();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSearchSubmit();
    }
  }

  $: filteredResults =
    activeTab === "all"
      ? results
      : results.filter((r) => {
          const tab = tabFilters.find((t) => t.id === activeTab);
          if (!tab?.filter) return true;
          const title = (r.title || "").toLowerCase();
          const ref = (r.reference || "").toLowerCase();
          return title.includes(tab.filter) || ref.includes(tab.filter);
        });

  function getBadgeInfo(result: any): {
    color: string;
    labelKey: string;
    icon: string;
  } {
    const title = (result.title || "").toLowerCase();
    const ref = (result.reference || "").toLowerCase();

    if (title.includes("loi") || ref.includes("loi")) {
      return {
        color:
          "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
        labelKey: "badge.law",
        icon: "gavel",
      };
    }
    if (
      title.includes("décret") ||
      ref.includes("décret") ||
      ref.includes("decret")
    ) {
      return {
        color:
          "bg-slate-100 dark:bg-card-dark text-slate-600 dark:text-slate-300",
        labelKey: "badge.decree",
        icon: "assignment",
      };
    }
    if (title.includes("constitution")) {
      return {
        color:
          "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        labelKey: "badge.constitution",
        icon: "account_balance",
      };
    }
    if (title.includes("ordonnance")) {
      return {
        color:
          "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
        labelKey: "badge.ordinance",
        icon: "description",
      };
    }
    return {
      color:
        "bg-slate-100 dark:bg-card-dark text-slate-600 dark:text-slate-300",
      labelKey: "badge.text",
      icon: "article",
    };
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(
        $language.current === "fr" ? "fr-FR" : "en-US",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
      );
    } catch {
      return dateString;
    }
  }
</script>

<svelte:head>
  <title>JuriX - {$tr("title.search")}</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body min-h-screen flex flex-col transition-colors duration-300"
>
  <!-- Header -->
  <header
    class="w-full py-4 px-6 md:px-12 flex justify-between items-center bg-white dark:bg-card-dark border-b border-slate-200 dark:border-slate-800"
  >
    <a href="/" class="flex items-center gap-3">
      <div
        class="bg-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30"
      >
        <span class="material-icons text-white text-xl">balance</span>
      </div>
      <span
        class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >JuriX</span
      >
    </a>

    <nav
      class="hidden md:flex items-center gap-8 text-sm font-medium text-secondary-text-light dark:text-secondary-text-dark"
    >
      <a class="hover:text-primary transition-colors" href="/"
        >{$tr("nav.home")}</a
      >
      <a class="hover:text-primary transition-colors" href="/categories"
        >{$tr("nav.explore")}</a
      >
      <a class="hover:text-primary transition-colors" href="/about"
        >{$tr("nav.about")}</a
      >

      <div class="h-4 w-px bg-white/10 mx-2"></div>

      <div
        class="relative flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg"
      >
        <!-- Sliding Pill Background -->
        <div
          class="sliding-pill absolute top-1 bottom-1 w-10 rounded-md bg-white dark:bg-white/10 shadow-sm"
          class:translate-x-0={$language.current === "fr"}
          class:translate-x-full={$language.current === "en"}
        ></div>

        <button
          on:click={() => switchLanguage("fr")}
          class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
          'fr'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
          >FR</button
        >
        <button
          on:click={() => switchLanguage("en")}
          class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
          'en'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
          >EN</button
        >
      </div>

      <!-- Dark Mode Toggle -->
      <button
        on:click={themeStore.toggle}
        class="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        aria-label="Toggle Dark Mode"
      >
        {#if $themeStore === "dark"}
          <span class="material-icons text-lg">light_mode</span>
        {:else}
          <span class="material-icons text-lg">dark_mode</span>
        {/if}
      </button>

      <div class="flex items-center gap-3 ml-2">
        <a
          class="px-5 py-2 rounded-lg font-semibold text-sm transition-colors bg-white text-blue-600 hover:bg-gray-50 border border-transparent shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-blue-400 dark:hover:bg-white/10"
          href="/login"
        >
          {$tr("nav.login")}
        </a>
        <a
          class="px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          href="/signup"
        >
          {$tr("nav.signup")}
        </a>
      </div>
    </nav>
  </header>

  <!-- Main Content -->
  <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
    <!-- Search Header -->
    <div class="mb-10">
      <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-6">
        {#if searchQuery}
          {$tr("search.resultsFor")} "{searchQuery}"
        {:else}
          {$tr("nav.search")}
        {/if}
      </h1>

      <!-- Search Bar -->
      <div class="relative max-w-3xl group">
        <div
          class="absolute -inset-0.5 bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-indigo-900 dark:to-blue-900 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"
        ></div>
        <div
          class="relative flex items-center bg-white dark:bg-card-dark rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-2"
        >
          <div class="pl-4 text-slate-400">
            <span class="material-icons">search</span>
          </div>
          <input
            type="text"
            bind:value={searchQuery}
            on:keydown={handleKeydown}
            class="w-full bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 px-4 py-3 text-base"
            placeholder={$tr("search.searchLaw")}
          />
          {#if searchQuery}
            <button
              on:click={() => {
                searchQuery = "";
              }}
              class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              title={$tr("search.clearSearch")}
            >
              <span class="material-icons text-xl">close</span>
            </button>
          {/if}
          <button
            on:click={handleSearchSubmit}
            class="bg-primary hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-primary/25"
          >
            {$tr("search.button")}
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-3 mt-6 overflow-x-auto pb-2">
        {#each tabFilters as tab}
          <button
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all {activeTab ===
            tab.id
              ? 'bg-slate-100 dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
            on:click={() => (activeTab = tab.id)}
          >
            <span class="material-icons text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Layout -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- Sidebar Filters -->
      <aside class="w-full lg:w-64 flex-shrink-0">
        <div
          class="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-slate-700/50 p-6 sticky top-24 shadow-soft"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-slate-900 dark:text-white">
              {$tr("search.filters")}
            </h3>
            <button class="text-xs text-primary font-medium hover:underline"
              >{$tr("search.reset")}</button
            >
          </div>

          <!-- Date Filter -->
          <div class="mb-6">
            <h4
              class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3"
            >
              {$tr("search.datePublication")}
            </h4>
            <div class="space-y-2">
              {#each [$tr("search.allTime"), $tr("search.thisYear"), $tr("search.last5Years")] as label}
                <label class="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="date"
                    class="form-radio text-primary border-slate-300 focus:ring-primary h-4 w-4"
                  />
                  <span
                    class="text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    >{label}</span
                  >
                </label>
              {/each}
            </div>
          </div>

          <!-- Category Filter -->
          <div class="mb-6">
            <h4
              class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3"
            >
              {$tr("search.category")}
            </h4>
            <div class="space-y-2">
              {#each categories as category}
                <label class="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    class="form-checkbox text-primary rounded border-slate-300 focus:ring-primary h-4 w-4"
                  />
                  <span
                    class="text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    >{category}</span
                  >
                </label>
              {/each}
            </div>
          </div>

          <!-- Source Filter -->
          <div>
            <h4
              class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3"
            >
              {$tr("search.source")}
            </h4>
            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked
                  class="form-checkbox text-primary rounded border-slate-300 focus:ring-primary h-4 w-4"
                />
                <span
                  class="text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                  >{$tr("search.officialJournal")}</span
                >
              </label>
              <label class="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  class="form-checkbox text-primary rounded border-slate-300 focus:ring-primary h-4 w-4"
                />
                <span
                  class="text-sm text-secondary-text-light dark:text-secondary-text-dark group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                  >{$tr("search.caseLaw")}</span
                >
              </label>
            </div>
          </div>
        </div>
      </aside>

      <!-- Results -->
      <div class="flex-grow space-y-4">
        <!-- Results Meta -->
        <div
          class="flex justify-between items-center text-sm text-secondary-text-light dark:text-secondary-text-dark pb-2"
        >
          {#if isLoading}
            <span>{$tr("search.searching")}</span>
          {:else if errorMessage}
            <span class="text-red-500">{errorMessage}</span>
          {:else}
            <span
              >{$tr("search.aboutResults")}
              {totalResults}
              {$tr("search.resultsFound")} ({(searchTimeMs / 1000).toFixed(2)}
              {$tr("search.seconds")})</span
            >
          {/if}
          <div class="flex items-center gap-2">
            <span>{$tr("search.sortBy")}</span>
            <select
              bind:value={sortBy}
              class="bg-transparent border-none text-slate-900 dark:text-white font-medium focus:ring-0 cursor-pointer pr-8 text-sm"
            >
              <option value="relevance">{$tr("search.relevance")}</option>
              <option value="date_desc">{$tr("search.recentDate")}</option>
              <option value="date_asc">{$tr("search.oldestDate")}</option>
            </select>
          </div>
        </div>

        <!-- Loading State -->
        {#if isLoading}
          <div class="space-y-4">
            {#each [1, 2, 3] as _}
              <div
                class="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft animate-pulse"
              >
                <div
                  class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3"
                ></div>
                <div
                  class="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"
                ></div>
                <div
                  class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"
                ></div>
                <div
                  class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"
                ></div>
              </div>
            {/each}
          </div>

          <!-- Empty State -->
        {:else if !searchQuery}
          <div
            class="bg-white dark:bg-card-dark p-12 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft text-center"
          >
            <span
              class="material-icons text-6xl text-slate-300 dark:text-slate-600 mb-4"
              >search</span
            >
            <h3
              class="text-xl font-semibold text-slate-900 dark:text-white mb-2"
            >
              {$tr("search.startTitle")}
            </h3>
            <p class="text-secondary-text-light dark:text-secondary-text-dark">
              {$tr("search.startDesc")}
            </p>
          </div>

          <!-- No Results -->
        {:else if filteredResults.length === 0}
          <div
            class="bg-white dark:bg-card-dark p-12 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft text-center"
          >
            <span
              class="material-icons text-6xl text-slate-300 dark:text-slate-600 mb-4"
              >search_off</span
            >
            <h3
              class="text-xl font-semibold text-slate-900 dark:text-white mb-2"
            >
              {$tr("search.noResultsTitle")}
            </h3>
            <p class="text-secondary-text-light dark:text-secondary-text-dark">
              {$tr("search.noResultsDesc")}
            </p>
          </div>

          <!-- Results List -->
        {:else}
          {#each filteredResults as result, index}
            {@const badge = getBadgeInfo(result)}
            <article
              class="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
            >
              {#if index === 0}
                <div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
              {/if}

              <div class="flex justify-between items-start mb-2">
                <div>
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 {badge.color}"
                  >
                    <span class="material-icons text-xs">{badge.icon}</span>
                    {$tr(badge.labelKey)}
                  </span>
                  <h2
                    class="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors cursor-pointer"
                  >
                    {result.title || $tr("search.noTitle")}
                  </h2>
                </div>
                <button
                  class="text-slate-400 hover:text-primary transition-colors"
                >
                  <span class="material-icons">bookmark_border</span>
                </button>
              </div>

              <p
                class="text-secondary-text-light dark:text-secondary-text-dark mb-4 leading-relaxed line-clamp-2"
              >
                {#if result.highlights?.content}
                  {@html result.highlights.content}
                {:else}
                  {result.content?.substring(0, 200) ||
                    $tr("search.noDescription")}...
                {/if}
              </p>

              <div
                class="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-secondary-text-light dark:text-secondary-text-dark border-t border-slate-100 dark:border-slate-800 pt-4 mt-2"
              >
                {#if result.publication_date || result.date}
                  <div class="flex items-center gap-1.5">
                    <span class="material-icons text-base">calendar_today</span>
                    {formatDate(result.publication_date || result.date)}
                  </div>
                {/if}
                {#if result.category_name}
                  <div class="flex items-center gap-1.5">
                    <span class="material-icons text-base">folder_open</span>
                    {result.category_name}
                  </div>
                {/if}
                {#if result.reference}
                  <div class="flex items-center gap-1.5">
                    <span class="material-icons text-base">tag</span>
                    {result.reference}
                  </div>
                {/if}

                <a
                  href="/laws/{result.law_id || result.id}"
                  class="ml-auto flex items-center gap-1 text-primary font-medium hover:underline"
                >
                  {$tr("search.readFull")}
                  <span class="material-icons text-sm">arrow_forward</span>
                </a>
              </div>
            </article>
          {/each}

          <!-- Pagination -->
          {#if totalResults > 20}
            <div class="flex justify-center items-center gap-2 mt-8 pt-4">
              <button
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                disabled={currentPage === 1}
              >
                <span class="material-icons">chevron_left</span>
              </button>
              <button
                class="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white font-medium shadow-lg shadow-primary/25"
                >1</button
              >
              <button
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >2</button
              >
              <button
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >3</button
              >
              <span class="text-slate-400 px-2">...</span>
              <button
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span class="material-icons">chevron_right</span>
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </main>

  <!-- FAB -->
  <div class="fixed bottom-6 right-6 z-40">
    <a
      href="/"
      class="w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
    >
      <span class="material-icons text-2xl">smart_toy</span>
    </a>
  </div>
</div>

<style>
  :global(body) {
    font-family: "Inter", sans-serif;
  }

  /* Smooth transitions for sliding pill */
  .sliding-pill {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
