<script lang="ts">
  import { API_URL } from '$lib/api';
  import ImagePdfViewer from "$lib/components/ImagePdfViewer.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import { formatDate } from "$lib/format";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import { blocsDeReponse } from "$lib/texte";

  /** Rempli par `+page.ts`. Un identifiant inexistant n'arrive plus ici : 404. */
  export let data;

  // `lawId` a disparu avec le chargement client : l'identifiant est lu par
  // `+page.ts`, qui seul en a besoin. Le garder ici en aurait fait une seconde
  // source de verite pour la meme valeur.

  // Article demande par l'URL, pose par les citations du chat et les articles
  // trouves par la recherche. La page reconstruit sa liste depuis le texte du
  // document : elle ne connait pas les identifiants de ligne, seulement les
  // numeros.
  $: requestedArticle = $page.url.searchParams.get("article");

  // -- State --
  // `law` et `error` ne sont plus des variables locales : elles sont derivees de
  // `data` plus bas. `isLoading` a disparu — la page n'est plus rendue avant que
  // ses donnees soient la, un indicateur de chargement n'y serait jamais vrai.

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
        "Demandez à l'assistant d'expliquer cet article en langage courant, à partir de son texte et de son document d'origine. Vous obtiendrez :",
      ai_key_content: "Contenu clé",
      ai_key_desc: "Le résumé des points importants de l'article.",
      ai_implications: "Implications",
      ai_impl_desc: "Ce que cela signifie concrètement pour vous.",
      ai_explain: "Expliquer l'article",
      ai_loading: "Explication en cours\u2026",
      ai_regenerate: "Régénérer",
      ai_error_not_found:
        "Cet article n'a pas pu être retrouvé dans le document.",
      ai_disclaimer:
        "Réponse générée par une IA. Vérifiez-la sur le texte de l'article ci-dessus.",
      show_document: "Document original",
      show_text: "Revenir au texte",
      link_copied: "Lien copié !",
      link_copy_failed: "Copie impossible. Copiez l'adresse depuis la barre du navigateur.",
      article_prefix: "Article", // For "Article 1"
      raw_fallback: "Affichage brut (structure non détectée) :",
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
        "Ask the assistant to explain this article in plain language, from its text and its parent document. You will get:",
      ai_key_content: "Key Content",
      ai_key_desc: "Summary of the article's important points.",
      ai_implications: "Implications",
      ai_impl_desc: "What this concretely means for you.",
      ai_explain: "Explain this article",
      ai_loading: "Generating explanation\u2026",
      ai_regenerate: "Regenerate",
      ai_error_not_found: "This article could not be found in the document.",
      ai_disclaimer:
        "AI-generated answer. Check it against the article text above.",
      show_document: "Original document",
      show_text: "Back to text",
      link_copied: "Link copied!",
      link_copy_failed: "Copy failed. Copy the address from the browser bar.",
      article_prefix: "Article",
      raw_fallback: "Raw display (structure not detected):",
    },
  };

  function setLanguage(lang: "fr" | "en") {
    switchLanguage(lang);
  }

  /**
   * Structure de la table des matieres.
   *
   * Elle est RECONSTRUITE depuis `law.content` par `parseContent`. L'API
   * sert bien un sommaire (`law.articles`, des `ArticleSummary` sans contenu),
   * que la page utilise pour la page du PDF ; mais le TEXTE de chaque article
   * n'existe que dans `law.content`, d'ou cette reconstruction. Ces types sont
   * locaux a la page — les mettre dans `$lib/types` laisserait croire qu'ils
   * decrivent une reponse de l'API.
   */
  interface ArticleTDM {
    number: string;
    title: string;
    /** Ligne d'origine, entiere, telle qu'elle apparait dans le document. */
    fullTitle: string;
    content: string;
    sectionTitle: string;
  }

  interface SectionTDM {
    type: string;
    title: string;
    articles: ArticleTDM[];
  }

  let tableOfContents: SectionTDM[] = [];
  let flatArticles: ArticleTDM[] = [];

  let currentArticleIndex = 0;
  let searchQuery = "";

  /**
   * Affichage du document d'origine.
   *
   * ImagePdfViewer affiche des pages rendues par le serveur (endpoints
   * /pdf-info et /page/{n}), sans bibliothèque de rendu côté client. Le
   * composant concurrent, qui importait pdfjs-dist statiquement, a été supprimé
   * avec la dépendance : il n'était monté nulle part et pesait ~10 Mo à
   * l'installation pour du code jamais expédié.
   */
  let afficherDocument = false;

  // -- Logic --

  function parseContent(rawText: string) {
    if (!rawText) {
      // Vider, et non sortir : un retour anticipe laisserait la table des
      // matieres du document precedent apres une navigation vers une fiche en
      // erreur.
      tableOfContents = [];
      flatArticles = [];
      return;
    }

    // Clean text
    const cleanText = rawText
      .replace(/<<PAGE:?\s*\d+>>/gi, "")
      .replace(/\r\n/g, "\n");

    const lines = cleanText.split("\n");

    // Reset Data
    tableOfContents = [];
    flatArticles = [];

    let currentSection: SectionTDM = {
      type: "section",
      title: "Préambule / Général",
      articles: [],
    };
    tableOfContents.push(currentSection);

    let currentArticle: ArticleTDM | null = null;

    // Rempli localement, puis AFFECTE a `flatArticles` a la fin.
    //
    // Svelte n'observe que les affectations, jamais les mutations : une suite
    // de `flatArticles.push(...)` remplit le tableau sans jamais l'invalider.
    // Rien ne s'en apercevait tant que `currentArticleIndex` changeait par
    // ailleurs — c'etait un piege dormant, pas la panne. Une affectation unique
    // le desamorce.
    const articlesPlats: ArticleTDM[] = [];

    // Heuristic Regex
    const sectionRegex = /^(LIVRE|TITRE|CHAPITRE)\s+[IVX0-9]+/i; // e.g., LIVRE I
    // Le PDF converti ecrit `**ARTICLE 1er.**-` et parfois `**Article35.-**` :
    // emphase markdown avant le mot, et pas toujours d'espace avant le numero.
    // `/^Article\s+(\d+)/` ratait les deux, si bien que le sommaire de ces
    // documents restait vide et qu'un lien `?article=35` ne trouvait rien.
    const articleRegex = /^\**\s*Article\s*(\d+)/i;

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

        let titleText = line.replace(
          /^\**\s*Article\s*\d+\s*(?:er|ère|ème)?\s*[:.-]*\**\s*/i,
          "",
        );
        if (!titleText) titleText = `Texte de l'article ${num}`;

        currentArticle = {
          number: num,
          title: titleText,
          fullTitle: line,
          content: "",
          sectionTitle: currentSection.title,
        };

        currentSection.articles.push(currentArticle);
        articlesPlats.push(currentArticle);
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
    flatArticles = articlesPlats;

    // Set initial view
    if (flatArticles.length > 0) {
      currentArticleIndex = 0;
    }
  }


  /**
   * Page du PDF correspondant à l'article demandé par `?article=`.
   *
   * `GET /laws/{id}` sert désormais les articles avec leur `page_number`. Sur
   * le corpus actuel toutes les pages valent 1 : le markdown stocké ne porte
   * qu'un seul marqueur `<<PAGE:n>>`, hérité d'une extraction antérieure à la
   * restitution des pages. Le câblage est correct et deviendra utile dès que
   * le contenu sera ré-extrait ; d'ici là il ne déplace rien, ce qui vaut
   * mieux que de déplacer vers une page fausse.
   */
  $: pageDemandee = (() => {
    if (!requestedArticle) return 1;
    const wanted = normaliseArticleNumber(requestedArticle);
    const trouve = (law?.articles ?? []).find(
      (a) => normaliseArticleNumber(a.number) === wanted,
    );
    return trouve?.page_number && trouve.page_number > 1 ? trouve.page_number : 1;
  })();

  // Des que la liste est prete, se placer sur l'article demande. Comparaison
  // normalisee : "1er", "1ER" et "1" designent le meme article.
  $: if (flatArticles.length > 0 && requestedArticle) {
    const wanted = normaliseArticleNumber(requestedArticle);
    const found = flatArticles.findIndex(
      (a) => normaliseArticleNumber(a.number) === wanted,
    );
    if (found >= 0 && found !== currentArticleIndex) {
      currentArticleIndex = found;
    }
  }

  /**
   * Copie le lien de la page.
   *
   * L'ancienne version n'attendait pas la promesse et n'attrapait rien : en
   * contexte non sécurisé la copie échouait, le rejet partait non traité, et
   * « Lien copié ! » s'affichait quand même.
   */
  async function copierLeLien() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert(t.link_copied);
    } catch {
      alert(t.link_copy_failed);
    }
  }

  function normaliseArticleNumber(value: string | number | undefined) {
    if (value === undefined || value === null) return "";
    return String(value)
      .trim()
      .toUpperCase()
      .replace(/^(ARTICLE|ART\.?|SECTION)\s+/, "")
      .replace(/^(\d+)\s*(ER|ÈRE|ERE)$/, "$1")
      .replace(/[.:\-\s]+$/, "");
  }
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

  // ---------------------------------------------------------------------------
  // Explication de l'article par le modèle
  //
  // La réponse s'affiche ICI, dans le bloc, et ne part pas vers /chat : le
  // lecteur garde l'article sous les yeux pendant qu'il lit l'explication.
  // Le bouton renvoyait auparavant vers l'assistant avec une question
  // pré-remplie — qu'il fallait encore envoyer soi-même, sur une page où le
  // texte expliqué n'était plus visible.
  // ---------------------------------------------------------------------------

  let explication = "";
  let explicationEnCours = false;
  let explicationErreur = "";
  /** Jeton anti-course. Voir `reinitialiserExplication`. */
  let explicationJeton = 0;

  /**
   * Remet le bloc IA à zéro quand on change d'article ou de document.
   *
   * Le bloc ne se démonte pas d'un article à l'autre : `{#if currentArticle}`
   * reste vrai et Svelte réutilise les mêmes nœuds. Sans cette remise à zéro,
   * l'explication de l'article 12 resterait affichée sous le texte du 13.
   *
   * Le jeton couvre le second cas, invisible au test manuel : l'utilisateur
   * clique, puis pagine pendant les quelques secondes de génération. La réponse
   * arrive pour l'article précédent ; l'incrément la rend périmée et
   * `expliquerArticle` la jette.
   *
   * Les trois affectations ne figurent pas dans la liste de dépendances de la
   * ligne réactive : pas de boucle.
   */
  function reinitialiserExplication(_index: number, _lawId: number | undefined) {
    explication = "";
    explicationErreur = "";
    explicationEnCours = false;
    explicationJeton += 1;
  }

  $: reinitialiserExplication(currentArticleIndex, law?.id);

  async function expliquerArticle() {
    if (!law || !currentArticle) return;

    const jeton = ++explicationJeton;
    explicationEnCours = true;
    explicationErreur = "";
    explication = "";

    try {
      const reponse = await fetch(`${API_URL}/laws/${law.id}/explain-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: currentArticle.number,
          language: currentLanguage,
          // Le texte affiché. Il permet au serveur de répondre même quand la
          // base n'a pas de ligne pour ce numéro — la page en reconnaît 193 là
          // où la base en compte 230 pour le même document. Le serveur vérifie
          // que cet extrait provient bien du document avant de s'en servir, et
          // l'ignore dès qu'il trouve la vraie ligne.
          excerpt: currentArticle.content.slice(0, 12000),
        }),
      });

      // L'utilisateur a changé d'article pendant la génération : cette réponse
      // ne concerne plus ce qui est à l'écran.
      if (jeton !== explicationJeton) return;

      if (reponse.ok) {
        const donnees = await reponse.json();
        explication = donnees.explanation ?? "";
        if (!explication.trim()) explicationErreur = $tr("chat.errorServer");
      } else if (reponse.status === 404) {
        explicationErreur = t.ai_error_not_found;
      } else if (reponse.status === 429) {
        explicationErreur = $tr("chat.errorQuota");
      } else if (reponse.status === 503) {
        explicationErreur = $tr("chat.errorOverloaded");
      } else {
        explicationErreur = $tr("chat.errorServer");
      }
    } catch {
      if (jeton === explicationJeton) explicationErreur = $tr("chat.errorNetwork");
    } finally {
      if (jeton === explicationJeton) explicationEnCours = false;
    }
  }

  function scrollToTop() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }


  /**
   * Le document vient du `load`, et sa table des matieres est recalculee a
   * CHAQUE changement de `data.law`.
   *
   * C'est le piege central de cette migration : SvelteKit reutilise le meme
   * composant en naviguant de /laws/1 a /laws/2. Un `parseContent` appele une
   * seule fois au montage laisserait a l'ecran la table des matieres du document
   * precedent, sous le titre du nouveau. Le bloc reactif ci-dessous depend
   * explicitement de `data.law` pour que ce cas soit couvert.
   */
  $: law = data.law;
  $: error = data.erreur ? $tr(data.erreur) : "";
  $: parseContent(law?.content ?? "");

  /**
   * L'article affiche. DECLARE APRES `parseContent`, et ce n'est pas cosmetique.
   *
   * Svelte 4 triait les blocs `$:` par dependances : cette declaration pouvait
   * vivre plus haut dans le fichier, le compilateur la placait apres celle qui
   * remplit `flatArticles`. Svelte 5 — utilise ici en mode legacy, faute de
   * runes — les execute dans l'ORDRE DU SOURCE. Declaree avant `parseContent`,
   * elle lisait donc un tableau encore vide et ne se recalculait plus.
   *
   * L'effet visible : `{#if currentArticle}` restait faux et la page affichait
   * « Chargement... » a la place du texte, alors que le sommaire et le compteur
   * « 1 / 199 » — qui lisent `flatArticles` directement dans le gabarit —
   * etaient corrects. Le premier clic sur « Suivant » affectait
   * `currentArticleIndex`, relancait le calcul, et tout apparaissait : le defaut
   * ne se voyait qu'au tout premier affichage, et disparaissait des qu'on
   * paginait.
   */
  $: currentArticle = flatArticles[currentArticleIndex];

  // Filtered TOC for sidebar
  $: filteredTOC = tableOfContents
    .map((section) => {
      const filteredArticles = section.articles.filter((art) => {
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
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
</script>

<!--
  Le titre du document et un extrait de son texte sont maintenant présents dans
  le HTML rendu par le serveur, sans JavaScript. C'est le bénéfice entier de
  l'étape : jusqu'ici la page la plus indexable du site n'expédiait qu'une
  coquille vide.

  `type="article"` et non `website` : c'est un document daté et signé, pas une
  page de portail — la distinction change l'aperçu au partage.
-->
<MetaSeo
  titre={law?.title || $tr("laws.title")}
  description={descriptionDepuis(law?.content)}
  canonique={urlCanonique($page.url)}
  type="article"
/>

<SiteHeader />

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
          <!-- Pointait vers "/" : le libellé annonçait une catégorie et le lien
               ramenait à l'accueil. La route /categories/[id] existe. -->
          <a
            href="/categories/{law.category_id}"
            class="hover:text-blue-600 transition-colors">{t.category} {law.category_id}</a
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

  {#if error}
    <!-- data-testid conservé, mais son rôle a changé. Il servait à distinguer
         une fiche réelle d'une fiche inexistante, faute de statut fiable : la
         page chargeait dans un bloc réactif et répondait 200 sur n'importe quel
         identifiant. Depuis `+page.ts`, un identifiant inexistant répond 404 et
         n'atteint jamais ce balisage — le test d'intégrité contrôle désormais le
         statut. Ce bloc ne couvre plus que la panne : backend éteint ou 5xx. -->
    <div class="text-center py-20" data-testid="law-error" role="alert">
      <h2 class="text-2xl font-bold text-gray-700 dark:text-gray-300">
        {error}
      </h2>
      <div class="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          on:click={() => invalidateAll()}
          data-testid="law-retry"
          class="px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-medium hover:border-primary hover:text-primary transition-colors"
        >
          {$tr("common.retry")}
        </button>
        <a href="/" class="text-blue-600 hover:underline">{t.return}</a>
      </div>
    </div>
  <!--
    `{:else if law}` et non `{:else}` : sans cette garde, tout le corps de la
    page lit `law.x` sur une valeur que le type dit nullable — douze erreurs sous
    `strict`. La brancher ici plutot que de disperser des `law!.` dans le
    balisage garde la garantie a UN endroit. Le cas « ni erreur ni document » est
    impossible par construction — `+page.ts` pose l'un ou l'autre — mais la
    garde le rend inoffensif plutot qu'invisible.
  -->
  {:else if law}
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
              class="search-box flex items-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-6 focus-within:ring-2 focus-within:ring-blue-500"
            >
              <svg
                class="w-4 h-4 text-gray-500 mr-2"
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
          aria-label={t.filter}
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
                <div class="text-sm text-gray-500 italic">{t.no_result}</div>
              {/if}
            </div>
          </aside>

          <!-- Content Column -->
          <main
            id="contenu"
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
                  >{law.reference || "Loi No " + law.id} - {formatDate(law.publication_date, currentLanguage)}</span
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
                <!-- `law.article_count` vient de la base ; `flatArticles` est
                     reconstruit par expression régulière sur le contenu et en
                     trouve 193 là où la base en compte 230 pour le même
                     document. Deux chiffres pour une seule vérité : on garde
                     celui qui compte les lignes réellement stockées. -->
                <span>{law.article_count ?? flatArticles.length} {t.articles}</span>
                <span class="text-gray-300">•</span>
                <!-- Etait code en dur a "2024". -->
                <span>{t.updated} : {formatDate(law.updated_at || law.created_at, currentLanguage)}</span>
              </div>
              <div class="document-actions flex gap-3">
                <button
                  class="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
                  on:click={copierLeLien}
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
                  <!-- download nu, sans valeur : le nom propose est celui que
                       l'API annonce dans Content-Disposition, construit sur le
                       TITRE du document. Y mettre original_filename rendrait le
                       nom brut du fichier aspire
                       ("10691_decret-n-2026-164-du-..."). -->
                  <a
                    class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm shadow-blue-600/20 transition-colors"
                    href={`${API_URL}/laws/${law.id}/download`}
                    download
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"
                      ><path
                        fill-rule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      /></svg
                    >
                    {t.download}
                  </a>
                  <!-- ImagePdfViewer et PdfViewer étaient complets et testés,
                       mais importés NULLE PART : le document d'origine n'était
                       consultable qu'en le téléchargeant. -->
                  <button
                    on:click={() => (afficherDocument = !afficherDocument)}
                    data-testid="law-toggle-document"
                    class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors {afficherDocument
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                  >
                    <span class="material-icons text-lg" aria-hidden="true">picture_as_pdf</span>
                    {afficherDocument ? t.show_text : t.show_document}
                  </button>
                {:else}
                  <!-- Loi creee sans televersement : l'endpoint repondrait 404.
                       Bouton desactive et explique, plutot que masque sans
                       raison visible. -->
                  <button
                    class="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-500 rounded-lg text-sm font-medium cursor-not-allowed"
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

            {#if afficherDocument && law.file_id}
              <div
                class="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                data-testid="law-document-viewer"
              >
                <ImagePdfViewer
                  url={`${API_URL}/laws/${law.id}/download`}
                  initialPage={pageDemandee}
                />
              </div>
            {/if}

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
                      class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
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
                    {#if explicationEnCours}
                      <div
                        role="status"
                        aria-live="polite"
                        data-testid="law-explain-loading"
                        class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"
                      >
                        <span class="flex items-center gap-1" aria-hidden="true">
                          <span
                            class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce"
                            style="animation-delay: 0ms"
                          ></span>
                          <span
                            class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce"
                            style="animation-delay: 150ms"
                          ></span>
                          <span
                            class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce"
                            style="animation-delay: 300ms"
                          ></span>
                        </span>
                        {t.ai_loading}
                      </div>
                    {:else if explicationErreur}
                      <div
                        role="alert"
                        data-testid="law-explain-error"
                        class="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-sm text-red-700 dark:text-red-300"
                      >
                        <p>{explicationErreur}</p>
                        <button
                          on:click={expliquerArticle}
                          data-testid="law-explain-retry"
                          class="mt-2 underline font-medium hover:no-underline"
                        >
                          {$tr("common.retry")}
                        </button>
                      </div>
                    {:else if explication}
                      <div
                        data-testid="law-explain-answer"
                        aria-live="polite"
                        class="space-y-3 text-base leading-relaxed text-gray-700 dark:text-gray-300"
                      >
                        <!--
                          Rendu en NOEUDS Svelte, donc echappe. Le prompt
                          systeme « citoyen » du backend demande du markdown ;
                          `blocsDeReponse` le reconnait ici plutot que de le
                          passer a `{@html}`, que ce depot s'interdit.
                        -->
                        {#each blocsDeReponse(explication) as bloc}
                          {#if bloc.type === "titre"}
                            <h5 class="font-bold text-gray-900 dark:text-white pt-1">
                              {bloc.texte}
                            </h5>
                          {:else if bloc.type === "puce"}
                            <p class="pl-5 relative before:content-['•'] before:absolute before:left-1 before:text-blue-600 dark:before:text-blue-400">
                              {bloc.texte}
                            </p>
                          {:else}
                            <p>{bloc.texte}</p>
                          {/if}
                        {/each}
                      </div>
                      <p
                        class="mt-4 text-xs italic text-gray-500 dark:text-gray-400"
                        data-testid="law-explain-disclaimer"
                      >
                        {t.ai_disclaimer}
                      </p>
                      <button
                        on:click={expliquerArticle}
                        data-testid="law-explain-regenerate"
                        class="mt-4 px-4 py-2 border border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                      >
                        {t.ai_regenerate}
                      </button>
                    {:else}
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
                        on:click={expliquerArticle}
                        data-testid="law-explain"
                        class="ai-question-btn mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {t.ai_explain}
                      </button>
                    {/if}
                  </div>
                </div>
              </article>
            {:else if flatArticles.length === 0 && law.content}
              <!-- Fallback if parsing failed but content exists -->
              <div class="prose dark:prose-invert max-w-none">
                <p>{t.raw_fallback}</p>
                <pre class="whitespace-pre-wrap font-sans">{law.content}</pre>
              </div>
            {:else}
              <div class="py-20 text-center text-gray-500">{t.loading}</div>
            {/if}
          </main>
        </div>
      </div>
    </div>
  {/if}
</div>

<SiteFooter />
