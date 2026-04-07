<script lang="ts">
  import SearchBar from "$lib/components/SearchBar.svelte";
  import ChatInterface from "$lib/components/ChatInterface.svelte";
  import CategoryCard from "$lib/components/CategoryCard.svelte";
  import { fade, fly, slide } from "svelte/transition";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { tr, language } from "$lib/stores/language";
  import { API_BASE_URL as BASE_API } from '$lib/api';
  let activeTab = "search";
  let activeMode = "search"; // 'search' or 'chat'

  let searchQuery = "";
  let isSearching = false;
  let searchResults: any[] = [];
  let hasSearched = false; // Track if search was performed

  let chatMessages: any[] = [];

  // Initialize chat with welcome message based on language
  $: chatMessages =
    chatMessages.length === 0
      ? [{ role: "assistant", content: $tr("chat.welcome") }]
      : chatMessages;
  let isChatLoading = false;

  let rawCategories: any[] = [];
  let loadingCategories = true;

  // Category name translation mapping
  const categoryKeyMap: Record<string, string> = {
    "Droit Constitutionnel": "cat.constitutionnel",
    "Droit Civil": "cat.civil",
    "Droit Pénal": "cat.penal",
    "Droit du Travail": "cat.travail",
    "Droit Fiscal": "cat.fiscal",
    "Droit des Affaires": "cat.affaires",
    "Lois Internationales Ratifiées": "cat.international",
    "Lois": "cat.lois",
    "Ordonnances": "cat.ordonnances",
    "Décrets": "cat.decrets",
    "Arrêtés": "cat.arretes",
    "Circulaires": "cat.circulaires",
    "Décisions": "cat.decisions",
    "Autres": "cat.autres",
  };

  function getCategoryTranslation(name: string): string {
    const key = categoryKeyMap[name];
    return key ? $tr(key) : name;
  }

  function getDescriptionTranslation(name: string): string {
    const key = categoryKeyMap[name];
    if (key) {
      // Convert 'cat.xyz' to 'catdesc.xyz'
      const descKey = key.replace("cat.", "catdesc.");
      return $tr(descKey);
    }
    return "";
  }

  // Reactive: rebuild categories when language changes
  $: categories = rawCategories.map((cat: any, index: number) => ({
    id: cat.id,
    icon: cat.icon || "📌",
    title: getCategoryTranslation(cat.name),
    count: `${cat.law_count} ${$tr("categories.laws")}`,
    color: getColorForCategory(index),
    description: getDescriptionTranslation(cat.name),
  }));

  onMount(async () => {
    try {
      const res = await fetch(`${BASE_API}/api/v1/categories?limit=20`);
      if (res.ok) {
        rawCategories = await res.json();
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    } finally {
      loadingCategories = false;
    }
  });

  function getColorForCategory(index: number) {
    const colors = [
      "blue",
      "indigo",
      "emerald",
      "violet",
      "amber",
      "rose",
      "cyan",
      "slate",
    ];
    return colors[index % colors.length];
  }

  async function handleSearch(event: CustomEvent<{ query: string }>) {
    searchQuery = event.detail.query;
    activeMode = "search";
    isSearching = true;
    searchResults = [];
    hasSearched = false; // Reset before search

    try {
      // Use standard text search
      const response = await fetch(`${BASE_API}/api/v1/search/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, mode: "text", limit: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Search response:", {
          direct_navigation: data.direct_navigation,
          target_article: data.target_article,
          results: data.results?.length,
        });

        // Map backend response to frontend expected format if needed
        searchResults = data.results || [];
        hasSearched = true; // Mark search as performed

        // Check for direct navigation (article-specific search)
        if (data.direct_navigation && data.results?.length === 1) {
          const lawId = data.results[0].law_id || data.results[0].id;
          const targetArticle = data.target_article;

          console.log("Direct navigation triggered:", { lawId, targetArticle });

          // Redirect directly to the document with article highlight
          if (targetArticle) {
            goto(`/laws/${lawId}?article=${encodeURIComponent(targetArticle)}`);
          } else {
            goto(`/laws/${lawId}`);
          }
          return;
        }

        // If target_article is set but multiple results, attach to links
        // (handled in template below)
      } else {
        console.error("Search failed:", response.statusText);
        searchResults = []; // clear results on failure
        hasSearched = true; // Mark search as performed even on error
      }
    } catch (error) {
      console.error("Search error:", error);
      searchResults = [];
      hasSearched = true; // Mark search as performed even on error
    } finally {
      isSearching = false;
    }
  }

  async function handleChatSend(event: CustomEvent<{ message: string }>) {
    const userMessage = event.detail.message;
    chatMessages = [...chatMessages, { role: "user", content: userMessage }];
    isChatLoading = true;

    try {
      const response = await fetch(`${BASE_API}/api/v1/rag/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          top_k: 5,
          language: $language.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        chatMessages = [
          ...chatMessages,
          { role: "assistant", content: data.answer, sources: data.sources },
        ];
      } else {
        chatMessages = [
          ...chatMessages,
          {
            role: "assistant",
            content:
              "Je rencontre des difficultés pour joindre le serveur. Veuillez réessayer.",
          },
        ];
      }
    } catch (error) {
      chatMessages = [
        ...chatMessages,
        { role: "assistant", content: "Erreur de connexion au service d'IA." },
      ];
    } finally {
      isChatLoading = false;
    }
  }

  function clearSearch() {
    searchQuery = "";
    searchResults = [];
    hasSearched = false; // Reset search state
  }

  function handleCategoryClick(categoryTitle: string) {
    searchQuery = categoryTitle;
    handleSearch(
      new CustomEvent("search", { detail: { query: categoryTitle } }),
    );
  }
</script>

<div class="relative pb-20">
  <!-- Gradient Background Decoration -->
  <div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div
      class="absolute -top-[20%] -left-[10%] h-[70vh] w-[70vw] rounded-full bg-blue-100/50 blur-[100px]"
    ></div>
    <div
      class="absolute top-[10%] -right-[10%] h-[60vh] w-[60vw] rounded-full bg-indigo-100/40 blur-[100px]"
    ></div>
    <div
      class="absolute bottom-[0%] left-[20%] h-[50vh] w-[50vw] rounded-full bg-amber-50/60 blur-[100px]"
    ></div>
  </div>

  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <!-- Hero Section -->
    <div
      class="flex flex-col items-center justify-center pt-12 sm:pt-20 pb-16 text-center"
    >
      <div
        class="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/50 px-4 py-1.5 text-sm font-medium text-blue-700 backdrop-blur-sm"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
          ></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"
          ></span>
        </span>
        IA Juridique Camerounaise v2.1
      </div>

      <h1
        class="mb-6 max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl"
      >
        {$tr("hero.title")}
      </h1>

      <p class="mb-10 max-w-2xl text-lg text-slate-600">
        {$tr("hero.subtitle")}
      </p>

      <!-- Toggle Mode -->
      <div
        class="mb-8 flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 backdrop-blur ring-1 ring-slate-900/5"
      >
        <button
          class="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all {activeMode ===
          'search'
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
            : 'text-slate-500 hover:text-slate-900'}"
          on:click={() => (activeMode = "search")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          {$tr("mode.search")}
        </button>
        <button
          class="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all {activeMode ===
          'chat'
            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-900/5'
            : 'text-slate-500 hover:text-slate-900'}"
          on:click={() => (activeMode = "chat")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          {$tr("mode.chat")}
        </button>
      </div>

      <!-- Main Interaction Area -->
      <div class="w-full max-w-3xl">
        {#if activeMode === "search"}
          <div in:fly={{ y: 20, duration: 400 }} out:fade>
            <SearchBar
              placeholder={$tr("search.placeholder")}
              value={searchQuery}
              loading={isSearching}
              size="large"
              on:search={handleSearch}
              on:clear={clearSearch}
            />
          </div>
        {:else}
          <div in:fly={{ y: 20, duration: 400 }} out:fade class="text-left">
            <ChatInterface
              messages={chatMessages}
              loading={isChatLoading}
              on:send={handleChatSend}
            />
          </div>
        {/if}
      </div>
    </div>

    <!-- Results Section (only if there are results and in search mode) -->
    {#if activeMode === "search" && searchResults.length > 0}
      <div class="mt-8 animate-fade-in" in:slide>
        <button
          on:click={clearSearch}
          class="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Retour aux catégories
        </button>

        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-2xl font-bold text-slate-900">
            Résultats de recherche
          </h2>
          <span
            class="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600"
            >{searchResults.length} résultats</span
          >
        </div>
        <div class="grid gap-6 md:grid-cols-2">
          {#each searchResults as result}
            <div
              class="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
            >
              <div>
                <div class="mb-4 flex items-center justify-between">
                  <span
                    class="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {result.category_name || result.category || "Général"}
                  </span>
                  <span class="text-xs font-semibold text-emerald-600"
                    >{((result.relevance_score || 0) * 100).toFixed(0)}%
                    pertinent</span
                  >
                </div>
                <h3
                  class="mb-2 text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
                >
                  {result.title || "Document Juridique Sans Titre"}
                </h3>
                <p
                  class="mb-4 text-sm leading-relaxed text-slate-600 line-clamp-4"
                >
                  {@html result.highlights?.content ||
                    result.content ||
                    "Aucun contenu disponible"}
                </p>
              </div>
              <a
                href={`/laws/${result.law_id || result.id}`}
                class="mt-2 w-fit text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group-hover:underline"
              >
                Lire le document complet
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    fill-rule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                    clip-rule="evenodd"
                  />
                </svg>
              </a>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Empty State (when search performed but no results) -->
    {#if activeMode === "search" && hasSearched && searchResults.length === 0 && !isSearching}
      <div class="mt-8 animate-fade-in" in:fade={{ duration: 400 }}>
        <button
          on:click={clearSearch}
          class="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-4 w-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Retour aux catégories
        </button>

        <div class="flex flex-col items-center justify-center py-16 px-4">
          <div class="mb-6 rounded-full bg-slate-100 p-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="h-16 w-16 text-slate-400"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
              />
            </svg>
          </div>
          <h3 class="mb-2 text-2xl font-bold text-slate-900">
            Aucun résultat trouvé
          </h3>
          <p class="mb-6 max-w-md text-center text-slate-600">
            Nous n'avons trouvé aucun document correspondant à votre recherche "<span
              class="font-semibold">{searchQuery}</span
            >".
          </p>
          <div class="flex flex-col items-center gap-4 text-sm text-slate-500">
            <p class="font-medium">Suggestions :</p>
            <ul class="list-disc list-inside space-y-1 text-left">
              <li>Vérifiez l'orthographe de vos mots-clés</li>
              <li>Essayez des termes plus généraux</li>
              <li>Utilisez moins de mots-clés</li>
              <li>Explorez les catégories ci-dessous</li>
            </ul>
          </div>
        </div>
      </div>
    {/if}

    <!-- Categories Grid (Only visible if no search has been performed) -->
    {#if activeMode === "search" && !hasSearched && searchResults.length === 0}
      <div id="categories" class="scroll-mt-24" in:fade={{ duration: 400 }}>
        <div class="mb-10 text-center">
          <h2 class="text-2xl font-bold text-slate-900 sm:text-3xl">
            {$tr("categories.title")}
          </h2>
          <p class="mt-4 text-slate-600">{$tr("categories.subtitle")}</p>
        </div>

        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {#each categories as category}
            <CategoryCard
              title={category.title}
              icon={category.icon}
              description={category.description}
              color={category.color}
              on:click={() => goto(`/categories/${category.id}`)}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
