<script lang="ts">
  import { API_URL } from '$lib/api';
  import { page } from "$app/stores";
  import { onMount, tick } from "svelte";
  import { language, switchLanguage } from "$lib/stores/language";

  $: lawId = $page.params.id;

  // -- State --
  let law: any = null;
  let isLoading = true;
  let error = "";

  // Language: use shared store
  $: currentLanguage = $language.current;

  const translations = {
    fr: {
      explorer: "Explorer",
      category: "Catégorie",
      loading: "Chargement...",
      return: "Retour à l'accueil",
      toc: "Table des matières",
      filter: "Filtrer les articles...",
      no_result: "Aucun résultat",
      law_decree: "Loi / Décret",
      updated: "Dernière mise à jour",
      articles: "Articles",
      share: "Partager",
      download: "Télécharger PDF",
    no_source_file: "Le fichier d'origine n'est pas disponible pour ce document",
      previous: "Précédent",
      next: "Suivant",
      in_force: "En vigueur",
      ai_title: "Explication Simplifiée (IA)",
      ai_desc:
        "L'intelligence artificielle analysera cet article dès que le système LlamaParse sera activé. En attendant, voici ce que vous pourrez voir :",
      ai_key_content: "Contenu clé",
      ai_key_desc: "Le résumé des points importants de l'article.",
      ai_implications: "Implications",
      ai_impl_desc: "Ce que cela signifie concrètement pour vous.",
      ai_ask: "Poser une question à l'Assistant IA",
      link_copied: "Lien copié !",
      article_prefix: "Article", // For "Article 1"
    },
    en: {
      explorer: "Explorer",
      category: "Category",
      loading: "Loading...",
      return: "Back to Home",
      toc: "Table of Contents",
      filter: "Filter articles...",
      no_result: "No result",
      law_decree: "Law / Decree",
      updated: "Last updated",
      articles: "Articles",
      share: "Share",
      download: "Download PDF",
    no_source_file: "The original file is not available for this document",
      previous: "Previous",
      next: "Next",
      in_force: "In Force",
      ai_title: "Simplified Explanation (AI)",
      ai_desc:
        "Artificial intelligence will analyze this article as soon as the LlamaParse system is enabled. In the meantime, here is what you will see:",
      ai_key_content: "Key Content",
      ai_key_desc: "Summary of the article's important points.",
      ai_implications: "Implications",
      ai_impl_desc: "What this concretely means for you.",
      ai_ask: "Ask the AI Assistant",
      link_copied: "Link copied!",
      article_prefix: "Article",
    },
  };

  function setLanguage(lang: "fr" | "en") {
    switchLanguage(lang);
  }

  // TOC Structure
  let tableOfContents: any[] = [];
  let flatArticles: any[] = [];

  let currentArticleIndex = 0;
  let searchQuery = "";

  // -- Logic --

  async function fetchLaw(id: string) {
    isLoading = true;
    error = "";
    try {
      const response = await fetch(`${API_URL}/laws/${id}`);
      if (!response.ok) throw new Error("Document non trouvé");
      law = await response.json();
      parseContent(law.content);
    } catch (e) {
      console.error(e);
      error = "Impossible de charger le document.";
    } finally {
      isLoading = false;
    }
  }

  function parseContent(rawText: string) {
    if (!rawText) return;

    // Clean text
    const cleanText = rawText
      .replace(/<<PAGE:?\s*\d+>>/gi, "")
      .replace(/\r\n/g, "\n");

    const lines = cleanText.split("\n");

    // Reset Data
    tableOfContents = [];
    flatArticles = [];

    let currentSection = {
      type: "section",
      title: "Préambule / Général",
      articles: [],
    };
    tableOfContents.push(currentSection);

    let currentArticle: any = null;

    // Heuristic Regex
    const sectionRegex = /^(LIVRE|TITRE|CHAPITRE)\s+[IVX0-9]+/i; // e.g., LIVRE I
    const articleRegex = /^Article\s+(\d+)/i; // e.g., Article 1

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (sectionRegex.test(line)) {
        // New Section Found
        currentSection = { type: "section", title: line, articles: [] };
        tableOfContents.push(currentSection);
        currentArticle = null; // Section break resets current article
      } else if (articleRegex.test(line)) {
        // New Article Found
        const match = line.match(articleRegex);
        const num = match ? match[1] : "?";

        let titleText = line.replace(/^Article\s+\d+\s*[:.-]?\s*/i, "");
        if (!titleText) titleText = `Texte de l'article ${num}`;

        currentArticle = {
          number: num,
          title: titleText,
          fullTitle: line,
          content: "",
          sectionTitle: currentSection.title,
        };

        currentSection.articles.push(currentArticle);
        flatArticles.push(currentArticle);
      } else {
        // Content
        if (currentArticle) {
          currentArticle.content += line + "\n";
        } else {
          // Potentially content for section headers
        }
      }
    }

    // Cleanup empty sections
    tableOfContents = tableOfContents.filter((s) => s.articles.length > 0);

    // Set initial view
    if (flatArticles.length > 0) {
      currentArticleIndex = 0;
    }
  }

  // Reactive: Current Article
  $: currentArticle = flatArticles[currentArticleIndex];
  // Reactive: Translator shorthand
  $: t = translations[currentLanguage];

  // Navigation
  function navigateToPrevious() {
    if (currentArticleIndex > 0) {
      currentArticleIndex--;
      scrollToTop();
    }
  }

  function navigateToNext() {
    if (currentArticleIndex < flatArticles.length - 1) {
      currentArticleIndex++;
      scrollToTop();
    }
  }

  function jumpToArticle(index: number) {
    currentArticleIndex = index;
    scrollToTop();
  }

  function scrollToTop() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function formatDate(date: string) {
    if (!date) return "";
    return new Date(date).toLocaleDateString(
      currentLanguage === "fr" ? "fr-FR" : "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );
  }

  $: if (lawId) {
    fetchLaw(lawId);
  }

  // Filtered TOC for sidebar
  $: filteredTOC = tableOfContents
    .map((section) => {
      const filteredArticles = section.articles.filter((art: any) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          art.title.toLowerCase().includes(q) ||
          art.number.includes(q) ||
          art.content.toLowerCase().includes(q)
        );
      });
      return { ...section, articles: filteredArticles };
    })
    .filter((s) => s.articles.length > 0);
</script>

<svelte:head>
  <title>JuriX - {law?.title || "Document"}</title>
</svelte:head>

<div
  class="page text-slate-900 dark:text-gray-100 bg-[#F8F9FA] dark:bg-slate-900 min-h-screen font-sans"
>
  <!-- Breadcrumb & Top Nav -->
  <div
    class="breadcrumb bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 py-4 px-0 sticky top-0 z-50 shadow-sm"
  >
    <div
      class="container mx-auto px-4 max-w-[1400px] flex items-center justify-between"
    >
      <!-- Left: Breadcrumb -->
      <div
        class="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
      >
        <button
          class="mr-2 flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
          on:click={() => window.history.back()}
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            /></svg
          >
          <span class="hidden sm:inline">{t.return}</span>
        </button>
        <span class="text-gray-300">|</span>
        <a href="/" class="hover:text-blue-600 transition-colors"
          >{t.explorer}</a
        >
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"
          ><path
            d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
          /></svg
        >
        {#if law?.category_id}
          <a href="/" class="hover:text-blue-600 transition-colors"
            >{t.category} {law.category_id}</a
          >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"
            ><path
              d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
            /></svg
          >
        {/if}
        <span
          class="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[400px]"
          >{law?.title || t.loading}</span
        >
      </div>

      <!-- Right: Language Switcher -->
      <div class="flex items-center gap-3">
        <div class="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            class="px-2 py-1 text-xs font-bold rounded shadow-sm transition-all {currentLanguage ===
            'fr'
              ? 'bg-white dark:bg-slate-700 text-blue-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}"
            on:click={() => setLanguage("fr")}
          >
            FR
          </button>
          <button
            class="px-2 py-1 text-xs font-bold rounded shadow-sm transition-all {currentLanguage ===
            'en'
              ? 'bg-white dark:bg-slate-700 text-blue-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}"
            on:click={() => setLanguage("en")}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center h-[50vh]">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
      ></div>
    </div>
  {:else if error}
    <div class="text-center py-20">
      <h2 class="text-2xl font-bold text-gray-700 dark:text-gray-300">
        {error}
      </h2>
      <a href="/" class="text-blue-600 hover:underline mt-4 inline-block"
        >{t.return}</a
      >
    </div>
  {:else}
    <!-- Main Content -->
    <div class="main-content py-8">
      <div class="container mx-auto px-4 max-w-[1400px]">
        <div class="layout grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <!-- Sidebar -->
          <aside
            class="sidebar hidden lg:block sticky top-24 h-fit max-h-[calc(100vh-100px)] overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 shadow-sm"
          >
            <div class="sidebar-header mb-4">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">
                {t.toc}
              </h2>
            </div>

            <div
              class="search-box flex items-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-6"
            >
              <svg
                class="w-4 h-4 text-gray-400 mr-2"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"
                />
              </svg>
              <input
                type="text"
                class="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white placeholder-gray-400"
                placeholder={t.filter}
                bind:value={searchQuery}
              />
            </div>

            <div class="toc space-y-6">
              {#each filteredTOC as section}
                <div class="toc-section">
                  <div
                    class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3"
                  >
                    {section.title}
                  </div>
                  <div class="articles-list flex flex-col gap-1">
                    {#each section.articles as article}
                      {@const isActive =
                        currentArticle &&
                        article.number === currentArticle.number &&
                        article.title === currentArticle.title}
                      <button
                        class="text-left px-3 py-2 rounded-md text-sm transition-all duration-200
                                 {isActive
                          ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'}"
                        on:click={() => {
                          // Find index in flat list
                          const idx = flatArticles.findIndex(
                            (a) => a === article,
                          );
                          if (idx !== -1) jumpToArticle(idx);
                        }}
                      >
                        {t.article_prefix}
                        {article.number}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}

              {#if filteredTOC.length === 0}
                <div class="text-sm text-gray-400 italic">{t.no_result}</div>
              {/if}
            </div>
          </aside>

          <!-- Content Column -->
          <main
            class="content bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 md:p-10 shadow-sm relative"
          >
            <!-- Document Header -->
            <div
              class="document-header border-b border-gray-100 dark:border-slate-700 pb-8 mb-8"
            >
              <div class="document-meta flex items-center gap-3 mb-4">
                <span
                  class="inline-block px-3 py-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-md text-xs font-bold uppercase tracking-wide"
                >
                  {t.law_decree}
                </span>
                <span class="text-sm text-gray-500"
                  >{law.reference || "Loi No " + law.id} - {formatDate(
                    law.publication_date,
                  )}</span
                >
              </div>
              <h1
                class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight"
              >
                {law.title}
              </h1>
              <div
                class="document-info flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-6"
              >
                <span>{flatArticles.length} {t.articles}</span>
                <span class="text-gray-300">•</span>
                <!-- Etait code en dur a "2024". -->
                <span>{t.updated} : {formatDate(law.updated_at || law.created_at)}</span>
              </div>
              <div class="document-actions flex gap-3">
                <button
                  class="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
                  on:click={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert(t.link_copied);
                  }}
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    /></svg
                  >
                  {t.share}
                </button>
                <!-- Telechargement du document D'ORIGINE, servi par l'API.
                     Ce bouton appelait window.print(), qui imprime la page
                     telle qu'affichee : comme la page ne monte qu'UN article a
                     la fois et qu'aucune feuille @media print n'existe, le PDF
                     obtenu contenait le seul article lu, le sommaire et le fil
                     d'Ariane — jamais le document. -->
                {#if law.file_id}
                  <a
                    class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm shadow-blue-600/20 transition-colors"
                    href={`${API_URL}/laws/${law.id}/download`}
                    download={law.original_filename || ""}
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"
                      ><path
                        fill-rule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      /></svg
                    >
                    {t.download}
                  </a>
                {:else}
                  <!-- Loi creee sans televersement : l'endpoint repondrait 404.
                       Bouton desactive et explique, plutot que masque sans
                       raison visible. -->
                  <button
                    class="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-lg text-sm font-medium cursor-not-allowed"
                    disabled
                    title={t.no_source_file}
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"
                      ><path
                        fill-rule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      /></svg
                    >
                    {t.download}
                  </button>
                {/if}
              </div>
            </div>

            <!-- Navigation -->
            <div
              class="article-navigation flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 rounded-lg p-4 mb-10 border border-gray-100 dark:border-slate-700"
            >
              <button
                class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-600 transition-colors"
                on:click={navigateToPrevious}
                disabled={!flatArticles.length || currentArticleIndex === 0}
              >
                <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"
                  ><path
                    fill-rule="evenodd"
                    d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z"
                  /></svg
                >
                {t.previous}
              </button>
              <div class="text-sm font-medium text-gray-500">
                {#if flatArticles.length > 0}
                  {currentArticleIndex + 1} / {flatArticles.length}
                {:else}
                  0 / 0
                {/if}
              </div>
              <button
                class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-600 transition-colors"
                on:click={navigateToNext}
                disabled={!flatArticles.length ||
                  currentArticleIndex === flatArticles.length - 1}
              >
                {t.next}
                <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"
                  ><path
                    fill-rule="evenodd"
                    d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                  /></svg
                >
              </button>
            </div>

            <!-- Article Content -->
            {#if currentArticle}
              <article class="article">
                <div
                  class="article-header flex justify-between items-start mb-6"
                >
                  <div>
                    <p
                      class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
                    >
                      {currentArticle.sectionTitle || ""}
                    </p>
                    <h2
                      class="text-3xl font-bold text-gray-900 dark:text-white"
                    >
                      {t.article_prefix}
                      {currentArticle.number}
                    </h2>
                  </div>
                  <span
                    class="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wide"
                  >
                    {t.in_force}
                  </span>
                </div>

                {#if currentArticle.title && currentArticle.title !== `Article ${currentArticle.number}` && currentArticle.title !== `Texte de l'article ${currentArticle.number}`}
                  <h3
                    class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-8"
                  >
                    {currentArticle.title}
                  </h3>
                {/if}

                <div
                  class="article-content space-y-6 text-lg leading-relaxed text-gray-700 dark:text-gray-300"
                >
                  {#each currentArticle.content.split("\n") as paragraph}
                    {#if paragraph.trim()}
                      <p>{paragraph}</p>
                    {/if}
                  {/each}
                </div>

                <!-- AI Explanation -->
                <div
                  class="ai-explanation mt-12 flex gap-6 p-6 bg-blue-50 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-700 rounded-xl relative overflow-hidden"
                >
                  <!-- Decorative bg -->
                  <div
                    class="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"
                  ></div>

                  <div
                    class="ai-icon w-12 h-12 shrink-0 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20"
                  >
                    <svg
                      class="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M12 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM9.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"
                      />
                      <path
                        d="M13.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1-1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"
                      />
                    </svg>
                  </div>
                  <div class="ai-content flex-1 z-10">
                    <h4
                      class="ai-title font-bold text-gray-900 dark:text-white mb-2"
                    >
                      {t.ai_title}
                    </h4>
                    <p
                      class="ai-description text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed"
                    >
                      {t.ai_desc}
                    </p>
                    <ol
                      class="ai-list list-decimal pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-400 marker:text-blue-600 marker:font-bold"
                    >
                      <li>
                        <strong>{t.ai_key_content} :</strong>
                        {t.ai_key_desc}
                      </li>
                      <li>
                        <strong>{t.ai_implications} :</strong>
                        {t.ai_impl_desc}
                      </li>
                    </ol>
                    <button
                      class="ai-question-btn mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t.ai_ask}
                    </button>
                  </div>
                </div>
              </article>
            {:else if flatArticles.length === 0 && law.content}
              <!-- Fallback if parsing failed but content exists -->
              <div class="prose dark:prose-invert max-w-none">
                <p>Affichage brut (Structure non détectée) :</p>
                <pre class="whitespace-pre-wrap font-sans">{law.content}</pre>
              </div>
            {:else}
              <div class="py-20 text-center text-gray-400">{t.loading}</div>
            {/if}
          </main>
        </div>
      </div>
    </div>
  {/if}
</div>
