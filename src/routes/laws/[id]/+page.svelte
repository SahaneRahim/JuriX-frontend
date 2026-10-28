<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { API_URL } from '$lib/api';
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import Icone from "$lib/components/Icone.svelte";
  import ImagePdfViewer from "$lib/components/ImagePdfViewer.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { afterNavigate, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { language, tr } from "$lib/stores/language";
  import { classesBadgeDeType, typeDeTexte } from "$lib/type-de-texte";
  import { nomCategorie } from "$lib/categories";
  import { formatDate } from "$lib/format";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import { blocsDeReponse } from "$lib/texte";
  import { LONGUEUR_MAX_NUMERO, normaliserNumeroArticle } from "$lib/article";

  /** Rempli par `+page.ts`. Un identifiant inexistant n'arrive plus ici : 404. */
  export let data;

  // `lawId` a disparu avec le chargement client : l'identifiant est lu par
  // `+page.ts`, qui seul en a besoin. Le garder ici en aurait fait une seconde
  // source de verite pour la meme valeur.

  // Article demande par l'URL, pose par les citations du chat et les articles
  // trouves par la recherche. La page reconstruit sa liste depuis le texte du
  // document : elle ne connait pas les identifiants de ligne, seulement les
  // numeros.
  // Borne : la valeur vient de l'URL et passe par des expressions rendues au
  // serveur (voir $lib/article).
  $: requestedArticle =
    $page.url.searchParams.get("article")?.slice(0, LONGUEUR_MAX_NUMERO) || null;

  // -- State --
  // `law` et `error` ne sont plus des variables locales : elles sont derivees de
  // `data` plus bas. `isLoading` a disparu — la page n'est plus rendue avant que
  // ses donnees soient la, un indicateur de chargement n'y serait jamais vrai.

  // Language: use shared store
  $: currentLanguage = $language.current;

  // La ponctuation vit DANS les chaînes (« Contenu clé : », « Key content: ») :
  // écrite dans le gabarit, l'espace française avant le deux-points restait
  // dans l'interface anglaise (« Last updated : », « Key Content : »).
  // `\u00a0` : espace insécable, le deux-points ne passe jamais seul à la
  // ligne.
  const translations = {
    fr: {
      // Repli du fil d'Ariane, quand l'API ne joint pas la catégorie : le
      // libellé n'affiche plus son identifiant (« Catégorie 6 »).
      category: "Catégorie",
      loading: "Chargement...",
      // Le retour du fil d'Ariane ramène à la page d'où l'on vient (recherche,
      // liste, catégorie), pas à l'accueil : « Retour à l'accueil » y mentait.
      back: "Retour",
      // Le lien du message d'erreur, lui, mène bien à l'accueil.
      return_home: "Retour à l'accueil",
      toc: "Table des matières",
      // Libellé court du bouton qui ouvre le sommaire sous `lg` : il partage
      // la barre Précédent / Suivant d'un écran de 320 px.
      toc_open: "Sommaire",
      filter: "Filtrer les articles...",
      no_result: "Aucun résultat",
      // « Mis à jour le 14 octobre 2026 » et non « Dernière mise à jour : … » :
      // plus court de 70 px, la ligne « 24 articles • … » tient sur un
      // téléphone de 360 px au lieu de passer sur deux.
      updated: "Mis à jour le",
      // En minuscules, comme la liste des documents (« 4 articles »).
      article_one: "article",
      articles: "articles",
      share: "Partager",
      download: "Télécharger PDF",
    no_source_file: "Le fichier d'origine n'est pas disponible pour ce document",
      previous: "Précédent",
      next: "Suivant",
      in_force: "En vigueur",
      ai_title: "Explication simplifiée (IA)",
      ai_desc:
        "Demandez à l'assistant d'expliquer cet article en langage courant, à partir de son texte et de son document d'origine. Vous obtiendrez :",
      ai_key_content: "Contenu clé\u00a0:",
      ai_key_desc: "Le résumé des points importants de l'article.",
      ai_implications: "Implications\u00a0:",
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
      copy_citation: "Copier la citation",
      citation_copied: "Citation copiée !",
      article_prefix: "Article", // For "Article 1"
      raw_fallback: "Affichage brut (structure non détectée) :",
    },
    en: {
      category: "Category",
      loading: "Loading...",
      back: "Back",
      return_home: "Back to home",
      toc: "Table of Contents",
      toc_open: "Contents",
      filter: "Filter articles...",
      no_result: "No result",
      updated: "Updated",
      article_one: "article",
      articles: "articles",
      share: "Share",
      download: "Download PDF",
    no_source_file: "The original file is not available for this document",
      previous: "Previous",
      next: "Next",
      in_force: "In force",
      ai_title: "Simplified explanation (AI)",
      ai_desc:
        "Ask the assistant to explain this article in plain language, from its text and its parent document. You will get:",
      ai_key_content: "Key content:",
      ai_key_desc: "Summary of the article's important points.",
      ai_implications: "Implications:",
      ai_impl_desc: "What this concretely means for you.",
      ai_explain: "Explain this article",
      ai_loading: "Generating explanation…",
      ai_regenerate: "Regenerate",
      ai_error_not_found: "This article could not be found in the document.",
      ai_disclaimer:
        "AI-generated answer. Check it against the article text above.",
      show_document: "Original document",
      show_text: "Back to text",
      link_copied: "Link copied!",
      link_copy_failed: "Copy failed. Copy the address from the browser bar.",
      copy_citation: "Copy citation",
      citation_copied: "Citation copied!",
      article_prefix: "Article",
      raw_fallback: "Raw display (structure not detected):",
    },
  };

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

    // Section des articles qui précèdent le premier LIVRE, TITRE ou CHAPITRE :
    // le document ne lui donne aucun titre. Titre vide, et libellé traduit à
    // l'affichage (`laws.preamble`) : écrit ici en dur, « Préambule /
    // Général » restait en français dans l'interface anglaise.
    let currentSection: SectionTDM = {
      type: "section",
      title: "",
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

        // Le numéro, son ordinal et la ponctuation qui le suit, emphase
        // comprise des deux côtés (« **ARTICLE 1er.**- Le… »). L'OCR lit
        // aussi « 1er » en « 1ºr » ou « 1° » : non retirés, ces débris
        // ouvraient le texte de l'article (« ºr.- Le présent décret… »).
        let titleText = line.replace(
          /^\**\s*Article\s*\d+\s*(?:er|ère|ème|[º°]\s*r?)?\s*[:.\-–—]*\s*\**\s*[:.\-–—]*\s*/i,
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
    const wanted = normaliserNumeroArticle(requestedArticle);
    const trouve = (law?.articles ?? []).find(
      (a) => normaliserNumeroArticle(a.number) === wanted,
    );
    return trouve?.page_number && trouve.page_number > 1 ? trouve.page_number : 1;
  })();

  /**
   * Se place sur l'article demandé par `?article=`. Comparaison normalisée :
   * "1er", "1ER" et "1" désignent le même article.
   *
   * Appelée par un bloc `$:` placé APRÈS `parseContent` (voir plus bas) : placé
   * ici, avant lui, il lisait une liste encore vide, puis `parseContent`
   * remettait l'index à 0 — un lien « article 94 » du chat ouvrait l'article 1.
   * Ses seules dépendances sont la liste et l'article demandé : lire
   * `currentArticleIndex` dans le bloc le relançait à chaque « Suivant », et
   * ramenait le lecteur à l'article du lien.
   */
  function allerALArticleDemande(articles: ArticleTDM[], demande: string | null) {
    if (articles.length === 0 || !demande) return;
    const wanted = normaliserNumeroArticle(demande);
    const found = articles.findIndex((a) => normaliserNumeroArticle(a.number) === wanted);
    if (found >= 0) currentArticleIndex = found;
  }

  /**
   * Le « titre » d'un article est-il en réalité son texte ?
   *
   * `parseContent` prend pour titre ce qui suit « Article N » sur la même
   * ligne. Dans les décrets, c'est presque toujours la première phrase de
   * l'article, souvent tout l'article (« Article 1er.- Le présent décret
   * fixe… »). Rendue en intertitre (20 px, demi-gras, sur toute la largeur),
   * elle se lisait comme un sous-titre, et aucun paragraphe ne suivait. Un
   * vrai intitulé (« Imputabilité ») est court et suivi du texte ; ici,
   * l'article n'a pas d'autre texte, ou la ligne est longue, ou elle annonce
   * une liste (« … on entend par : »).
   */
  function titreEstLeTexte(article: ArticleTDM): boolean {
    const titre = article.title.trim();
    if (!titre || titre === `Texte de l'article ${article.number}`) return false;
    return !article.content.trim() || titre.length > 100 || /[:;]$/.test(titre);
  }

  /**
   * Le texte de l'article, sa première ligne comprise quand c'en est une.
   * Le même pour l'affichage, la citation copiée et l'extrait envoyé avec
   * « Expliquer l'article » : la citation de l'article 1 ci-dessus copiait
   * « » vide, son texte étant tout entier dans le titre.
   */
  function texteDeLArticle(article: ArticleTDM): string {
    return titreEstLeTexte(article) ? `${article.title.trim()}\n${article.content}` : article.content;
  }

  /**
   * « CHAPITRE III DE LA PARTICIPATION… » : le numéro, court, et l'intitulé.
   *
   * Le titre entier, en capitales à chasse fixe très espacées, s'étalait sur
   * cinq lignes dans la colonne du sommaire, illisible. Le numéro garde le
   * style du surtitre ; l'intitulé passe en texte courant, coupé à deux
   * lignes dans le sommaire. Un titre qui ne commence pas par un numéro
   * reconnu reste entier, en intitulé.
   */
  function decouperSection(titre: string, langue: string = "fr"): { numero: string; intitule: string } {
    const morceaux = /^((LIVRE|TITRE|CHAPITRE)\s+([IVX0-9]+)(?:\s*(?:er|ère|ème))?)(?![\p{L}\d])\s*[-–—:.]*\s*(.*)$/iu.exec(
      titre.trim(),
    );
    if (!morceaux) return { numero: "", intitule: titre.trim() };
    // Dans l'interface anglaise, le mot du numéro suit la langue (CHAPITRE III
    // → CHAPTER III, sans le « er » de « 1er ») : il voisinait avec
    // « PREAMBLE / GENERAL », traduit, dans la même liste. L'intitulé est le
    // texte du document, en français seulement : il reste tel quel.
    const numero =
      langue === "en" ? `${MOT_DE_SECTION_EN[morceaux[2].toLowerCase()]} ${morceaux[3]}` : morceaux[1];
    return { numero, intitule: morceaux[4] };
  }

  const MOT_DE_SECTION_EN: Record<string, string> = { livre: "BOOK", titre: "TITLE", chapitre: "CHAPTER" };

  /**
   * Élément d'une ligne de méta (cote • date, articles • mise à jour).
   *
   * Le « • » est dessiné AVANT chaque élément, centré dans l'écart de 16 px
   * qui le sépare du précédent, et la ligne est décalée de cet écart vers la
   * gauche (`-ml-4`) dans un cadre qui coupe ce qui dépasse
   * (`overflow-hidden`) : en début de ligne, le point tombe hors du cadre.
   * Écrit en <span> à part, il restait seul en bout de ligne sur téléphone
   * (« 28 articles • », la date dessous).
   */
  const ELEMENT_SEPARE =
    "relative ml-4 before:absolute before:-left-4 before:w-4 before:text-center before:text-zinc-400 before:content-['•'] dark:before:text-zinc-600";

  /**
   * Taille du titre du document, selon sa longueur.
   *
   * Un intitulé de décret dépasse souvent 200 caractères : à 36 px, il
   * prenait 8 lignes à 1 024 px à côté du sommaire, 9 sur téléphone, et à
   * 740×360 il était à lui seul plus haut que l'écran ; le texte de l'article
   * commençait sous la ligne de flottaison. Un titre court (« Code pénal »)
   * garde la recette des titres de page (guide, § 4.2) ; plus il est long,
   * plus il descend, jusqu'à 20 px sur téléphone et 24 px au-delà (8 lignes
   * de 30 px à 1 024 px pour /laws/1740 auparavant, 6 de 24 px désormais ;
   * 6 de 30 px à 740×360, 4 de 20 px). Sur écran court (`court:`, téléphone
   * en paysage), la taille du téléphone en portrait : la hauteur y manque
   * plus que la largeur.
   */
  function tailleDuTitre(titre: string): string {
    if (titre.length <= 40) return "text-3xl sm:text-4xl court:text-3xl";
    if (titre.length <= 100) return "text-2xl sm:text-3xl court:text-2xl";
    return "text-xl sm:text-2xl court:text-xl";
  }

  /**
   * Retour du fil d'Ariane : la page d'où l'on vient quand c'en est une du
   * site (recherche, liste, catégorie, avec ses filtres et sa position),
   * sinon la liste des documents, cible du lien.
   *
   * L'ancien bouton appelait `history.back()` sans condition, sous le libellé
   * « Retour à l'accueil » : venu de /search ou de /laws, il n'allait pas à
   * l'accueil ; arrivé depuis un moteur de recherche, il quittait le site.
   * `pagePrecedenteDuSite` est posé par `afterNavigate` (plus bas), qui
   * connaît la page de départ d'une navigation dans le site ; nulle au
   * premier chargement.
   */
  let pagePrecedenteDuSite = false;

  function revenir(event: MouseEvent) {
    // Ouverture dans un nouvel onglet (clic du milieu, Ctrl, Cmd, Maj) : le
    // lien garde son comportement.
    if (!pagePrecedenteDuSite || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    history.back();
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

  let citationCopiee = false;
  let minuterieCitation: ReturnType<typeof setTimeout>;

  async function copierCitationArticle() {
    if (!currentArticle || !law) return;
    const texte = texteDeLArticle(currentArticle).trim();
    const titreLoi = law.title || "Texte de loi";
    const refLoi = law.reference ? ` (${law.reference})` : "";
    const url = typeof window !== "undefined" ? window.location.href : `https://jurix.cm/laws/${law.id}`;
    
    // Format officiel de citation juridique
    const citation = `« ${texte} »\n\n— Article ${currentArticle.number}, ${titreLoi}${refLoi}.\nSource : JuriX (${url})`;
    
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(citation);
        citationCopiee = true;
        clearTimeout(minuterieCitation);
        minuterieCitation = setTimeout(() => {
          citationCopiee = false;
        }, 3000);
      }
    } catch {
      alert(t.link_copy_failed);
    }
  }

  // Reactive: Translator shorthand
  $: t = translations[currentLanguage];

  // Navigation
  function navigateToPrevious() {
    if (currentArticleIndex > 0) {
      currentArticleIndex--;
      allerAuDebutDeLArticle();
    }
  }

  function navigateToNext() {
    if (currentArticleIndex < flatArticles.length - 1) {
      currentArticleIndex++;
      allerAuDebutDeLArticle();
    }
  }

  function jumpToArticle(index: number) {
    currentArticleIndex = index;
    // Sur téléphone, le choix se fait dans le panneau du sommaire, qui
    // recouvre justement le texte demandé.
    tocOuvert = false;
    allerAuDebutDeLArticle();
  }

  /**
   * Barre Précédent / Suivant du haut : début de l'article, et cible du
   * défilement. La barre plutôt que le titre de l'article : elle reste sous
   * le doigt pour enchaîner les « Suivant ».
   */
  let debutArticle: HTMLElement | undefined;

  /**
   * Amène le début de l'article juste sous le fil d'Ariane collant (marge
   * `scroll-mt-*` de la barre).
   *
   * Remplace un `window.scrollTo({ top: 0 })`, qui renvoyait le lecteur
   * au-dessus du titre, des boutons et, s'il était ouvert, du document
   * d'origine : sur téléphone, 450 à 1 000 px à redescendre à chaque article.
   *
   * Après `tick()` : si le panneau du sommaire vient de se fermer, la page doit
   * avoir retrouvé son défilement. Animation douce, sauf pour qui a demandé
   * moins de mouvement — et pour un lien profond, où le saut est immédiat.
   */
  async function allerAuDebutDeLArticle(immediat = false) {
    if (typeof window === "undefined") return;
    await tick();
    const moinsDeMouvement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    debutArticle?.scrollIntoView({
      block: "start",
      behavior: immediat || moinsDeMouvement ? "auto" : "smooth",
    });
  }

  /**
   * Sommaire en panneau, sous `lg`.
   *
   * La colonne du sommaire n'existait qu'à partir de 1 024 px, sans rien à sa
   * place en dessous : sur téléphone et tablette en portrait, un code de 199
   * articles ne se parcourait qu'un article à la fois. Le MÊME élément sert de
   * colonne sur grand écran et de panneau qui monte du bas sur petit écran :
   * une seule liste dans le DOM, donc un seul bouton par article pour les
   * lecteurs d'écran et pour les tests.
   */
  let tocOuvert = false;

  function ouvrirSommaire() {
    tocOuvert = true;
  }

  function fermerSommaire() {
    tocOuvert = false;
  }

  // Un double appui sur « Sommaire » tombait, au second appui, sur le fond tout
  // juste affiché : le panneau s'ouvrait et se refermait aussitôt. Même garde
  // que le fond de ChoixPersona.
  function surLeFond(event: MouseEvent) {
    if (event.detail <= 1) fermerSommaire();
  }

  // Le garde est dans le gestionnaire : <svelte:window> ne peut pas vivre dans
  // un bloc (même motif que SiteHeader).
  function surTouche(event: KeyboardEvent) {
    if (tocOuvert && event.key === "Escape") fermerSommaire();
  }

  /**
   * `piegerFocus`, armé seulement pendant que le sommaire est ouvert en
   * panneau.
   *
   * L'élément est aussi la colonne du grand écran : posée telle quelle,
   * l'action volerait le focus dès le chargement de la page sur ordinateur.
   * Elle s'arme à l'ouverture — sur l'article en cours, `aria-current`, pour
   * que la liste s'ouvre là où en est le lecteur — et se désarme à la
   * fermeture, en rendant le focus au bouton « Sommaire ».
   */
  function piegerSiOuvert(noeud: HTMLElement, ouvert: boolean) {
    let piege: ReturnType<typeof piegerFocus> | null = null;
    let voulu = false;

    function appliquer(actif: boolean) {
      voulu = actif;
      if (!actif) {
        piege?.destroy();
        piege = null;
        return;
      }
      // Après le rendu : la classe qui affiche le panneau peut être posée
      // après cet appel, et `piegerFocus` écarte les éléments encore masqués.
      tick().then(() => {
        if (voulu && !piege) piege = piegerFocus(noeud, { initial: '[aria-current="true"]' });
      });
    }

    appliquer(ouvert);
    return {
      update: appliquer,
      destroy() {
        voulu = false;
        piege?.destroy();
        piege = null;
      },
    };
  }

  // Panneau ouvert, la page derrière lui ne défile plus : même verrou que sous
  // la boîte du profil (src/routes/+layout.svelte), qui rend en fermant la
  // valeur trouvée en ouvrant.
  let debordementAvant: string | null = null;

  function verrouillerDefilement(verrouille: boolean) {
    if (typeof document === "undefined") return;
    if (verrouille && debordementAvant === null) {
      debordementAvant = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else if (!verrouille && debordementAvant !== null) {
      document.body.style.overflow = debordementAvant;
      debordementAvant = null;
    }
  }

  onDestroy(() => verrouillerDefilement(false));

  onMount(() => {
    // Passé à `lg` (tablette tournée, fenêtre agrandie), le panneau redevient
    // la colonne : le fermer retire le fond et rend le défilement.
    const grandEcran = window.matchMedia("(min-width: 1024px)");
    const surChangement = (event: MediaQueryListEvent) => {
      if (event.matches) tocOuvert = false;
    };
    grandEcran.addEventListener("change", surChangement);
    return () => grandEcran.removeEventListener("change", surChangement);
  });

  /**
   * Lien profond `?article=94` (citation du chat, résultat de recherche) :
   * l'article était bien sélectionné, mais la page restait en haut, l'article
   * sous la ligne de flottaison.
   *
   * Dans `afterNavigate`, et non au montage : SvelteKit remet la page en haut
   * APRÈS le montage, à chaque navigation. Rien n'est fait quand la page a déjà
   * une position — retour arrière, ou rechargement qui la restaure : la
   * remplacer ferait perdre au lecteur l'endroit où il en était.
   */
  afterNavigate(({ from, type }) => {
    // Voir `revenir` : une page du site précède celle-ci.
    pagePrecedenteDuSite = from !== null;
    tocOuvert = false;
    if (type === "popstate" || window.scrollY > 0 || !requestedArticle) return;
    const voulu = normaliserNumeroArticle(requestedArticle);
    if (flatArticles.some((a) => normaliserNumeroArticle(a.number) === voulu)) {
      allerAuDebutDeLArticle(true);
    }
  });

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
          // l'ignore dès qu'il trouve la vraie ligne. Première ligne comprise
          // quand elle porte le texte (`texteDeLArticle`) : l'extrait était
          // vide pour un article tenant sur sa ligne « Article N ».
          excerpt: texteDeLArticle(currentArticle).slice(0, 12000),
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
  $: allerALArticleDemande(flatArticles, requestedArticle);

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

  // Lu par les deux barres Précédent / Suivant et par le bouton du sommaire.
  // Placé, comme tout bloc `$:` qui lit `flatArticles`, APRÈS `parseContent`.
  $: compteur =
    flatArticles.length > 0 ? `${currentArticleIndex + 1} / ${flatArticles.length}` : "0 / 0";

  /**
   * UN seul nombre d'articles sur la page : celui que le lecteur parcourt.
   *
   * L'en-tête affichait `law.article_count`, compté en base (28 pour
   * /laws/1740), quand le sommaire et le compteur « 1 / 24 » comptent les
   * articles reconstruits depuis le texte : deux chiffres contradictoires sur
   * le même écran. Le compteur ne peut aller que jusqu'aux articles affichés,
   * l'en-tête dit donc le même nombre. Le compte de la base ne sert plus
   * qu'au texte brut, quand aucun article n'a été reconnu.
   */
  $: nombreDArticles = flatArticles.length > 0 ? flatArticles.length : (law?.article_count ?? 0);

  /**
   * Nom du domaine dans le fil d'Ariane, dans la langue de l'interface : il
   * affichait l'identifiant (« Catégorie 6 », 6 étant le droit
   * administratif). `GET /laws/{id}` joint la catégorie (`law.category`) ;
   * sans elle, le mot « Catégorie » seul, plutôt qu'un numéro.
   */
  $: nomDeLaCategorie = nomCategorie(law?.category?.name, currentLanguage) || t.category;

  // Libellé et icône du type (loi, décret, arrêté…), la table commune à
  // /laws, /search et la page d'une catégorie.
  $: typeDuTexte = typeDeTexte(law?.type, law?.title);

  $: classeTitre = tailleDuTitre(law?.title ?? "");

  $: verrouillerDefilement(tocOuvert);
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
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

<svelte:window on:keydown={surTouche} />

<!-- `min-h-app` (app.css) et non `min-h-screen min-h-dvh` : Tailwind écrit
     `.min-h-dvh` AVANT `.min-h-screen`, et la paire valait toujours 100vh. -->
<div
  class="page text-zinc-950 dark:text-zinc-100 bg-background-light dark:bg-background-dark min-h-app font-sans"
>
  <!-- Breadcrumb & Top Nav -->
  <!--
    Compacté sous `sm` : il reste collé en haut de l'écran pendant toute la
    lecture. Sur deux ou trois lignes (retour | Explorer › Catégorie › titre,
    plus la bascule FR/EN), il prenait environ 80 px, soit 12 % d'un téléphone
    en portrait et un quart en paysage. Il n'y garde que le retour et le
    titre ; la langue se change dans le menu de l'en-tête.

    z-40 et non z-50 : le panneau du menu mobile de l'en-tête (z-50) doit
    passer devant lui quand on fait défiler la page menu ouvert.

    `sm:court:` (téléphone en paysage, plus de 640 px de large) et non
    `court:` seul : Tailwind écrit les règles `court:` AVANT celles de `sm:`,
    qui l'emporteraient.
  -->
  <div
    class="breadcrumb bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 py-1 sm:py-4 sm:court:py-1.5 px-0 sticky top-0 z-40 shadow-sm dark:shadow-none"
  >
    <div
      class="mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3"
    >
      <!-- Left: Breadcrumb -->
      <!-- Sur une seule ligne : le titre se tronque (`min-w-0`), le nom de la
           catégorie aussi, à largeur bornée ; les autres morceaux gardent la
           leur. -->
      <div
        class="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <!-- 44 px sous `sm`, où il n'est plus qu'une flèche : son nom passe
             par aria-label, le libellé visible étant masqué. Un lien vers la
             liste des documents, que `revenir` change en retour arrière
             quand on vient d'une page du site : il marche aussi sans
             JavaScript et pour qui arrive d'un moteur de recherche. -->
        <a
          href="/laws"
          class="-ml-3.5 inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors sm:ml-0 sm:mr-2 sm:h-auto sm:w-auto"
          on:click={revenir}
          aria-label={t.back}
        >
          <Icone nom="arrow-left" class="w-4 h-4 shrink-0" />
          <span class="hidden sm:inline whitespace-nowrap">{t.back}</span>
        </a>
        <span class="hidden sm:inline text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
        <!-- « Documents », la liste du corpus (/laws), entrée active de
             l'en-tête sur cette page. L'ancien « Explorer » menait à
             l'accueil et restait en français dans l'interface anglaise. -->
        <a href="/laws" class="hidden sm:inline shrink-0 whitespace-nowrap hover:text-zinc-950 dark:hover:text-white transition-colors"
          >{$tr("nav.documents")}</a
        >
        <Icone nom="chevron-right" class="hidden sm:block w-4 h-4 shrink-0" />
        {#if law?.category_id}
          <!-- Pointait vers "/" : le libellé annonçait une catégorie et le lien
               ramenait à l'accueil. La route /categories/[id] existe.
               Largeur bornée (le nom entier en infobulle) : « Droit des
               personnes, de la famille et état civil » ne laissait plus de
               place au titre du document à 640 px. -->
          <a
            href="/categories/{law.category_id}"
            title={nomDeLaCategorie}
            class="hidden sm:block shrink-0 max-w-[9rem] lg:max-w-[16rem] truncate hover:text-zinc-950 dark:hover:text-white transition-colors">{nomDeLaCategorie}</a
          >
          <Icone nom="chevron-right" class="hidden sm:block w-4 h-4 shrink-0" />
        {/if}
        <span
          class="min-w-0 truncate font-medium text-zinc-950 dark:text-white sm:max-w-[400px]"
          >{law?.title || t.loading}</span
        >
      </div>

      <!-- Plus de bascule FR / EN ici. Elle doublait celle de l'en-tête
           (texte « FR | EN » à 1 440 px) avec un autre dessin, et, posée sur
           la barre du texte, elle laissait croire à une version anglaise du
           décret : « EN » actif au-dessus d'un texte en français. Elle ne
           change que la langue de l'interface, ce que font l'en-tête et son
           menu. -->
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
      <h2 class="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
        {error}
      </h2>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3 px-4">
        <button
          type="button"
          on:click={() => invalidateAll()}
          data-testid="law-retry"
          class="min-h-11 lg:[@media(pointer:fine)]:min-h-0 px-5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-medium hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white transition-colors"
        >
          {$tr("common.retry")}
        </button>
        <a href="/" class="font-medium text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white">{t.return_home}</a>
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
    <!-- Marges de l'en-tête (16, 24 puis 48 px) et non celles d'un
         `container` de 1 400 px : en 1 440, fil d'Ariane et colonnes
         s'alignaient sur 37 et 1 404 px, ni sur le logo (48) ni sur le bord
         droit de « Créer un compte » (1 392). -->
    <div class="main-content py-4 sm:py-8">
      <div class="mx-auto w-full max-w-[96rem] px-4 sm:px-6 lg:px-12">
        <!-- `minmax(0, 1fr)` et non `1fr` (qui vaut minmax(auto, 1fr)) : un
             mot insécable, une cote ou une URL élargissait la colonne de
             lecture au-delà de l'écran entre 1 024 et 1 280 px. -->
        <div class="layout grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8">
          {#if tocOuvert}
            <!-- Fond du panneau du sommaire. Au-dessus du fil d'Ariane (z-40),
                 sous la boîte du profil (z-[60]). -->
            <div
              class="fond-sommaire fixed inset-0 z-[55] bg-zinc-950/40 backdrop-blur-sm lg:hidden"
              role="presentation"
              on:click={surLeFond}
            ></div>
          {/if}
          <!-- Sidebar -->
          <!--
            Colonne collante à partir de `lg` ; en dessous, masquée, ou panneau
            qui monte du bas une fois ouverte par le bouton « Sommaire » des
            barres Précédent / Suivant. Le titre et le filtre restent visibles,
            seule la liste défile. Hauteurs maximales : <style> en fin de
            fichier, avec un repli pour les navigateurs sans unité dvh.
          -->
          <div
            id="sommaire"
            data-testid="law-toc"
            class="sidebar sommaire flex-col bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:shadow-none {tocOuvert
              ? 'fixed inset-x-0 bottom-0 z-[56] flex rounded-t-2xl border-t shadow-xl pb-zone-sure px-zone-sure'
              : 'hidden'} lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:flex lg:h-fit lg:rounded-2xl lg:border lg:p-0 lg:shadow-sm"
            class:ouvert={tocOuvert}
            role={tocOuvert ? "dialog" : undefined}
            aria-modal={tocOuvert ? "true" : undefined}
            aria-labelledby={tocOuvert ? "sommaire-titre" : undefined}
            use:piegerSiOuvert={tocOuvert}
          >
            <div
              class="sidebar-header flex shrink-0 items-center justify-between gap-3 px-4 pt-2 lg:mb-4 lg:px-6 lg:pt-6"
            >
              <h2 id="sommaire-titre" class="text-lg font-bold text-zinc-950 dark:text-white">
                {t.toc}
              </h2>
              <button
                type="button"
                class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors lg:hidden"
                on:click={fermerSommaire}
                aria-label={$tr("common.close")}
                data-testid="law-toc-close"
              >
                <Icone nom="x" class="text-2xl" />
              </button>
            </div>

            <!-- Le cadre dessine le champ et son focus (bordure et anneau,
                 comme les champs du site) ; le champ lui-même reste
                 transparent, sans anneau propre qui doublerait celui-ci. En
                 sombre, la recette des champs : fond zinc-950, bordure
                 zinc-500 (zinc-800 se perdait dans le panneau zinc-900).
                 Hauteur et loupe des autres champs du site : 44 px à
                 partir de `lg` (`min-h-11`, et `py-2.5` sur le champ), 46
                 en dessous où le texte passe à 16 px ; loupe de 20 px et
                 texte à 49 px du bord, comme la barre de recherche et le
                 champ d'une catégorie. Le cadre (`py-2`) s'ajoutait à la
                 marge propre du champ que pose @tailwindcss/forms : 54 px,
                 plus haut que tous les champs de la page dans une colonne
                 de 230 px, autour d'une loupe de 16 px. -->
            <div
              class="search-box mx-4 mb-3 mt-1 flex min-h-11 shrink-0 items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-500 rounded-xl pl-4 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 dark:focus-within:border-zinc-200 dark:focus-within:ring-zinc-200 lg:mx-6 lg:mb-6 lg:mt-0"
            >
              <Icone nom="search" class="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <!-- 16 px sous `lg`, là où il vit dans le panneau tactile : en
                   dessous, iOS zoome sur la page au focus et ne dézoome pas.
                   `self-stretch` : le champ occupe toute la hauteur du
                   cadre, un appui au-dessus ou au-dessous du texte le
                   touche encore. -->
              <input
                type="text"
                class="self-stretch bg-transparent border-none outline-none focus:ring-0 w-full min-w-0 py-2.5 pl-3 pr-4 text-base lg:text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
                placeholder={t.filter}
                bind:value={searchQuery}
          aria-label={t.filter}
              />
            </div>

            <!-- Fondu en bas de la liste (`after:`, collé au bas de la zone
                 qui défile) : la liste s'arrêtait net au bord de la carte,
                 un titre de chapitre à 5 px du bord, sans rien qui dise
                 qu'il en reste. Blanc vers transparent (zinc-900 en
                 sombre), la couleur du panneau : un repère de défilement,
                 pas un décor. En fin de liste, il ne couvre que du vide. -->
            <nav
              class="toc min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 space-y-6 lg:px-6 lg:pb-6 after:pointer-events-none after:sticky after:bottom-0 after:z-[2] after:block after:h-8 after:bg-gradient-to-t after:from-white after:content-[''] dark:after:from-zinc-900"
              aria-labelledby="sommaire-titre"
            >
              {#each filteredTOC as section}
                <div class="toc-section">
                  <!-- Collé en haut de la liste qui défile : on sait toujours
                       dans quel titre ou chapitre on se trouve. Le numéro
                       (« CHAPITRE III ») en surtitre, l'intitulé en texte
                       courant sur deux lignes au plus, entier en infobulle
                       (voir `decouperSection`). -->
                  <div
                    class="sticky top-0 z-[1] bg-white dark:bg-zinc-900 py-1 mb-2 lg:mb-3"
                    title={section.title || undefined}
                  >
                    {#if section.title}
                      {@const morceaux = decouperSection(section.title, currentLanguage)}
                      {#if morceaux.numero}
                        <p class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          {morceaux.numero}
                        </p>
                      {/if}
                      {#if morceaux.intitule}
                        <p class="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-400 line-clamp-2 coupe-mots">
                          {morceaux.intitule}
                        </p>
                      {/if}
                    {:else}
                      <p class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        {$tr("laws.preamble")}
                      </p>
                    {/if}
                  </div>
                  <div class="articles-list flex flex-col gap-1">
                    {#each section.articles as article}
                      {@const isActive =
                        currentArticle &&
                        article.number === currentArticle.number &&
                        article.title === currentArticle.title}
                      <!-- `aria-current` : l'article en cours n'était signalé
                           que par la couleur. Il sert aussi de point d'entrée
                           du focus à l'ouverture du panneau. -->
                      <button
                        class="text-left px-3 py-3 lg:py-2 rounded-xl text-base lg:text-sm transition-all duration-200
                                 {isActive
                          ? 'bg-zinc-950 text-white font-medium dark:bg-white dark:text-zinc-950'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'}"
                        aria-current={isActive ? "true" : undefined}
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
                <div class="text-sm text-zinc-500 dark:text-zinc-400 italic">{t.no_result}</div>
              {/if}
            </nav>
          </div>

          <!-- Content Column -->
          <!-- `min-w-0` : élément de grille, il ne doit pas s'élargir sur son
               contenu le plus large. -->
          <main
            id="contenu"
            data-hors-du-bouton
            class="content min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 md:p-10 shadow-sm dark:shadow-none relative"
          >
            <!-- Document Header -->
            <div
              class="document-header border-b border-zinc-200 dark:border-zinc-800 pb-6 mb-6 sm:pb-8 sm:mb-8"
            >
              <!-- Passe à la ligne : sur téléphone, la cote et la date
                   écrasaient le badge sur deux lignes. Les cotes du type
                   « N°2018/9387/CAB/PM » n'ont aucune coupure possible.
                   Cote et date séparées par « • », comme dans les listes
                   (un tiret ici seulement) ; sans cote, la date seule : le
                   repli « Loi No 12 » était du français en dur, et faux pour
                   un décret.
                   Cote et date à la recette « Méta » du guide (§ 4.2) :
                   chasse fixe, 12 px, comme sur /laws, /search et /compare.
                   En sans-serif de 14 px ici, la même cote changeait de
                   dessin entre la recherche et le texte qu'elle ouvre. -->
              <div class="document-meta flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                <!-- Le type du texte, traduit et avec son icône, comme sur
                     /laws et /search ($lib/type-de-texte). C'était « LOI /
                     DÉCRET » en capitales mono, un libellé FIXE qui annonçait
                     aussi un arrêté ou une ordonnance comme « Loi / Décret ». -->
                <span class={classesBadgeDeType(typeDuTexte)}>
                  <Icone nom={typeDuTexte.icone} class="text-sm" />
                  {$tr(typeDuTexte.cle)}
                </span>
                <div class="min-w-0 overflow-hidden">
                  <div class="-ml-4 flex flex-wrap items-center font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                    {#if law.reference}
                      <span class="{ELEMENT_SEPARE} min-w-0 coupe-mots">{law.reference}</span>
                    {/if}
                    <span class={ELEMENT_SEPARE}>{formatDate(law.publication_date, currentLanguage)}</span>
                  </div>
                </div>
              </div>
              <!-- Taille selon la longueur du titre (`tailleDuTitre`). -->
              <h1
                class="{classeTitre} font-bold text-zinc-950 dark:text-white mb-4 leading-tight coupe-mots tracking-tight"
              >
                {law.title}
              </h1>
              <div class="document-info mb-6 overflow-hidden font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                <!-- Le nombre d'articles est celui du sommaire et du
                     compteur « 1 / 24 » (`nombreDArticles`). Même recette
                     « Méta » que la ligne de la cote : un nombre et une
                     date, que le reste du site écrit en chasse fixe (la
                     ligne « 24 octobre 2026 • 4 min de lecture » du blog). -->
                <div class="-ml-4 flex flex-wrap items-center gap-y-1">
                  <span class={ELEMENT_SEPARE}
                    >{nombreDArticles} {nombreDArticles === 1 ? t.article_one : t.articles}</span
                  >
                  <!-- Etait code en dur a "2024". -->
                  <span class={ELEMENT_SEPARE}
                    >{t.updated} {formatDate(law.updated_at || law.created_at, currentLanguage)}</span
                  >
                </div>
              </div>
              <!--
                Rangée qui passe à la ligne, chaque bouton s'étirant sur la
                place libre (`flex-1`, rendu à sa largeur à partir de `sm`).
                Elle ne passait pas à la ligne : les trois boutons demandaient
                environ 400 px pour 280 disponibles à 360 px, et TOUTE la page
                glissait de côté. Pas de grille à deux colonnes : « Document
                original » ne tient pas dans une demi-largeur de téléphone, il
                y aurait coupé son libellé sur deux lignes.

                L'action principale, « Télécharger PDF », passe EN TÊTE, sur
                toute la largeur au téléphone (`basis-full`) ; « Partager » et
                « Document original » se partagent la ligne suivante. Placée
                entre les deux, elle était réduite à une demi-largeur, et
                « Document original », seul et pleine largeur sur la seconde
                ligne, passait pour l'action principale.
                44 px de haut, sauf à partir de lg sous un pointeur fin (la
                règle de /search et de /compare) : réduits à 38 px dès sm, ils
                l'étaient aussi sur un téléphone en paysage et une tablette.
              -->
              <div class="document-actions flex flex-wrap gap-2 sm:gap-3">
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
                    class="inline-flex min-h-11 basis-full items-center justify-center gap-2 whitespace-nowrap px-3 py-2 lg:[@media(pointer:fine)]:min-h-0 sm:basis-auto sm:flex-none sm:px-4 bg-zinc-950 text-white rounded-xl hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-medium shadow-sm dark:shadow-none transition-colors"
                    href={`${API_URL}/laws/${law.id}/download`}
                    download
                  >
                    <Icone nom="download" class="w-5 h-5 shrink-0" />
                    {t.download}
                  </a>
                {:else}
                  <!-- Loi creee sans televersement : l'endpoint repondrait 404.
                       Bouton desactive et explique, plutot que masque sans
                       raison visible. Meme dessin que le lien de
                       telechargement, estompe comme tout bouton desactive du
                       site : c'est la meme action, indisponible. -->
                  <button
                    class="inline-flex min-h-11 basis-full items-center justify-center gap-2 whitespace-nowrap px-3 py-2 lg:[@media(pointer:fine)]:min-h-0 sm:basis-auto sm:flex-none sm:px-4 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                    title={t.no_source_file}
                  >
                    <Icone nom="download" class="w-5 h-5 shrink-0" />
                    {t.download}
                  </button>
                {/if}
                <button
                  class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 lg:[@media(pointer:fine)]:min-h-0 sm:flex-none sm:px-4 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white text-sm font-medium transition-colors"
                  on:click={copierLeLien}
                >
                  <Icone nom="share-2" class="w-5 h-5 shrink-0" />
                  {t.share}
                </button>
                {#if law.file_id}
                  <!-- ImagePdfViewer et PdfViewer étaient complets et testés,
                       mais importés NULLE PART : le document d'origine n'était
                       consultable qu'en le téléchargeant. -->
                  <button
                    on:click={() => (afficherDocument = !afficherDocument)}
                    data-testid="law-toggle-document"
                    class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 lg:[@media(pointer:fine)]:min-h-0 sm:flex-none sm:px-4 rounded-xl text-sm font-medium border transition-colors {afficherDocument
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white'}"
                  >
                    <!-- `file-image` : la visionneuse montre les pages d'origine
                         en images ; `file-down` aurait dit « télécharger ». -->
                    <Icone nom="file-image" class="text-lg" />
                    {afficherDocument ? t.show_text : t.show_document}
                  </button>
                {/if}
              </div>
            </div>

            {#if afficherDocument && law.file_id}
              <!-- Bord à bord sur téléphone (`-mx-4` annule la marge de la
                   carte) : 32 px de plus pour la page, là où chaque pixel de
                   largeur grossit le texte du PDF. -->
              <div
                class="-mx-4 mt-6 mb-6 overflow-hidden border-y border-zinc-200 dark:border-zinc-800 sm:mx-0 sm:rounded-xl sm:border"
                data-testid="law-document-viewer"
              >
                <!-- Recréée pour chaque document : SvelteKit réutilise la page
                     d'une fiche à l'autre, et la visionneuse ne lit son
                     adresse qu'au montage. Sans clé, /laws/2 aurait gardé les
                     pages de /laws/1. -->
                {#key law.id}
                  <ImagePdfViewer
                    url={`${API_URL}/laws/${law.id}/download`}
                    initialPage={pageDemandee}
                  />
                {/key}
              </div>
            {/if}

            <!-- Navigation -->
            <!--
              Flèches seules sous `sm`, le nom passant par aria-label : en
              français, « Précédent  12 / 199  Suivant » débordait dès 360 px.
              Sous `lg`, où la colonne du sommaire n'existe pas, le compteur
              devient le bouton qui l'ouvre. « Suivant » reste le DERNIER
              bouton de la barre : les tests e2e le prennent par
              `.article-navigation button` puis `.last()`.

              Cible du défilement à chaque changement d'article : `scroll-mt-*`
              suit la hauteur du fil d'Ariane collant (53 px sous `sm`, 65 px
              au-dessus, 45 px en paysage), plus un peu d'air.

              Survol en `enabled:` : au premier ou au dernier article, le
              bouton désactivé ne doit pas réagir comme s'il menait ailleurs.

              Boutons au dessin de la pagination du site (/search, /laws) :
              carrés arrondis de 44 px à toutes les tailles (40 à partir de sm
              auparavant, sur les écrans tactiles aussi), bord zinc-200
              (zinc-700 en sombre : zinc-800 se perdait dans la barre),
              fond zinc-100 au survol. Ils faisaient 34 px, en rounded-lg et
              bord zinc-300 : une quatrième pagination, différente des trois
              autres.
            -->
            <div
              bind:this={debutArticle}
              class="article-navigation flex justify-between items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2 sm:p-4 mb-6 sm:mb-10 border border-zinc-200 dark:border-zinc-700/60 scroll-mt-16 sm:scroll-mt-20 sm:court:scroll-mt-14 lg:scroll-mt-24"
            >
              <button
                class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                on:click={navigateToPrevious}
                disabled={!flatArticles.length || currentArticleIndex === 0}
                aria-label={t.previous}
              >
                <Icone nom="chevron-left" class="w-4 h-4 shrink-0" />
                <span class="hidden sm:inline">{t.previous}</span>
              </button>
              <button
                type="button"
                class="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-zinc-700 dark:text-zinc-200 enabled:hover:bg-white enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors lg:hidden"
                on:click={ouvrirSommaire}
                disabled={!flatArticles.length}
                aria-haspopup="dialog"
                aria-expanded={tocOuvert}
                aria-controls="sommaire"
                data-testid="law-toc-toggle"
              >
                <Icone nom="table-of-contents" class="text-xl" />
                <span class="flex min-w-0 flex-col items-start leading-tight">
                  <span class="text-sm font-semibold">{t.toc_open}</span>
                  <span class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{compteur}</span>
                </span>
              </button>
              <div class="hidden lg:block text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400 font-mono">
                {compteur}
              </div>
              <button
                class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                on:click={navigateToNext}
                disabled={!flatArticles.length ||
                  currentArticleIndex === flatArticles.length - 1}
                aria-label={t.next}
              >
                <span class="hidden sm:inline">{t.next}</span>
                <Icone nom="chevron-right" class="w-4 h-4 shrink-0" />
              </button>
            </div>

            <!-- Article Content -->
            {#if currentArticle}
              <article class="article">
                <!-- Titre, puis boutons dessous sur téléphone : côte à côte
                     dès 390 px, « Copier la citation » et « En vigueur »
                     (environ 250 px) ne laissaient qu'une soixantaine de
                     pixels au titre, « Article 1 » passait sur deux lignes et
                     le nom de la section se coupait en plein mot. Côte à
                     côte à partir de sm, comme avant. -->
                <div
                  class="article-header flex flex-col gap-3 mb-6 sm:flex-row sm:justify-between sm:items-start"
                >
                  <!-- Le chapitre de l'article : numéro en surtitre,
                       intitulé en texte courant (`decouperSection`), comme
                       dans le sommaire. -->
                  <div class="min-w-0">
                    {#if currentArticle.sectionTitle}
                      {@const morceaux = decouperSection(currentArticle.sectionTitle, currentLanguage)}
                      {#if morceaux.numero}
                        <p class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
                          {morceaux.numero}
                        </p>
                      {/if}
                      {#if morceaux.intitule}
                        <p
                          class="text-xs leading-snug text-zinc-600 dark:text-zinc-400 mb-1 line-clamp-2 coupe-mots"
                          title={currentArticle.sectionTitle}
                        >
                          {morceaux.intitule}
                        </p>
                      {/if}
                    {:else}
                      <p class="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
                        {$tr("laws.preamble")}
                      </p>
                    {/if}
                    <h2
                      class="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight"
                    >
                      {t.article_prefix}
                      {currentArticle.number}
                    </h2>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      on:click={copierCitationArticle}
                      class="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white rounded-xl text-xs font-semibold transition-colors shadow-sm dark:shadow-none lg:[@media(pointer:fine)]:min-h-0"
                      title={t.copy_citation}
                      aria-label={t.copy_citation}
                    >
                      <Icone nom={citationCopiee ? "check" : "link"} class="text-base text-zinc-950 dark:text-white" />
                      <span>{citationCopiee ? t.citation_copied : t.copy_citation}</span>
                    </button>
                    <!-- Statut actif du guide (§ 4.9) : badge inversé et
                         icône `check`, le sens passant par le libellé et
                         l'icône. Il était gris, en capitales mono, sans
                         icône, comme un simple surtitre. -->
                    <span
                      class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white"
                    >
                      <Icone nom="check" class="text-sm" />
                      {t.in_force}
                    </span>
                  </div>
                </div>

                <!-- L'intertitre ne sert qu'à un vrai intitulé ; une ligne
                     qui porte le texte de l'article passe en premier
                     paragraphe, avec la recette du corps (`titreEstLeTexte`). -->
                {#if currentArticle.title && !titreEstLeTexte(currentArticle) && currentArticle.title !== `Article ${currentArticle.number}` && currentArticle.title !== `Texte de l'article ${currentArticle.number}`}
                  <h3
                    class="text-lg sm:text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-6 sm:mb-8 coupe-mots"
                  >
                    {currentArticle.title}
                  </h3>
                {/if}

                <!-- 16 px sur téléphone (18 au-dessus), et coupure des cotes,
                     URL et références sans espace, qui débordaient de la
                     colonne. Mesure de lecture de 36em (650 px en 18 px,
                     environ 67 à 77 caractères) : en 1 440, la ligne prenait
                     toute la carte, 935 px et 100 à 110 caractères. -->
                <div
                  class="article-content max-w-[36em] space-y-4 sm:space-y-6 text-base sm:text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 coupe-mots"
                >
                  {#each texteDeLArticle(currentArticle).split("\n") as paragraph}
                    {#if paragraph.trim()}
                      <p>{paragraph}</p>
                    {/if}
                  {/each}
                </div>

                <!-- AI Explanation -->
                <!-- Empilé sous `sm` : l'icône de 48 px à côté du texte, avec
                     ses marges, laissait environ 156 px de colonne à 360 px —
                     une vingtaine de caractères par ligne pour l'explication,
                     la fonction phare de la page. -->
                <div
                  class="ai-explanation mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-6 p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-xl relative overflow-hidden"
                >
                  <!-- `sparkles` et non l'ancien engrenage : l'icône dit « IA »,
                       pas « réglages ». -->
                  <div
                    class="ai-icon w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-xl flex items-center justify-center"
                  >
                    <Icone nom="sparkles" class="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div class="ai-content flex-1 min-w-0 z-10 coupe-mots">
                    <h4
                      class="ai-title font-bold text-zinc-950 dark:text-white mb-2"
                    >
                      {t.ai_title}
                    </h4>
                    <p
                      class="ai-description text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed"
                    >
                      {t.ai_desc}
                    </p>
                    {#if explicationEnCours}
                      <div
                        role="status"
                        aria-live="polite"
                        data-testid="law-explain-loading"
                        class="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <span class="flex items-center gap-1" aria-hidden="true">
                          <span
                            class="w-2 h-2 bg-zinc-950 dark:bg-white rounded-full motion-safe:animate-bounce"
                            style="animation-delay: 0ms"
                          ></span>
                          <span
                            class="w-2 h-2 bg-zinc-950 dark:bg-white rounded-full motion-safe:animate-bounce"
                            style="animation-delay: 150ms"
                          ></span>
                          <span
                            class="w-2 h-2 bg-zinc-950 dark:bg-white rounded-full motion-safe:animate-bounce"
                            style="animation-delay: 300ms"
                          ></span>
                        </span>
                        {t.ai_loading}
                      </div>
                    {:else if explicationErreur}
                      <div
                        role="alert"
                        data-testid="law-explain-error"
                        class="flex gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
                      >
                        <Icone nom="circle-alert" class="mt-0.5 text-base" />
                        <div class="min-w-0">
                          <p>{explicationErreur}</p>
                          <button
                            on:click={expliquerArticle}
                            data-testid="law-explain-retry"
                            class="mt-2 inline-flex min-h-11 items-center lg:[@media(pointer:fine)]:min-h-0 underline font-medium hover:no-underline"
                          >
                            {$tr("common.retry")}
                          </button>
                        </div>
                      </div>
                    {:else if explication}
                      <div
                        data-testid="law-explain-answer"
                        aria-live="polite"
                        class="space-y-3 text-base leading-relaxed text-zinc-800 dark:text-zinc-200"
                      >
                        <!--
                          Rendu en NOEUDS Svelte, donc echappe. Le prompt
                          systeme « citoyen » du backend demande du markdown ;
                          `blocsDeReponse` le reconnait ici plutot que de le
                          passer a `{@html}`, que ce depot s'interdit.
                        -->
                        {#each blocsDeReponse(explication) as bloc}
                          {#if bloc.type === "titre"}
                            <h5 class="font-bold text-zinc-950 dark:text-white pt-1">
                              {bloc.texte}
                            </h5>
                          {:else if bloc.type === "puce"}
                            <!-- Puce en gras, et elle seule (`before:font-bold`) :
                                 sans le bleu d'avant, elle se perdait dans le
                                 texte ; un paragraphe entier en demi-gras se
                                 serait lu comme un intertitre. -->
                            <p class="pl-5 relative before:content-['•'] before:absolute before:left-1 before:font-bold before:text-zinc-950 dark:before:text-white">
                              {bloc.texte}
                            </p>
                          {:else}
                            <p>{bloc.texte}</p>
                          {/if}
                        {/each}
                      </div>
                      <p
                        class="mt-4 text-xs italic text-zinc-500 dark:text-zinc-400"
                        data-testid="law-explain-disclaimer"
                      >
                        {t.ai_disclaimer}
                      </p>
                      <button
                        on:click={expliquerArticle}
                        data-testid="law-explain-regenerate"
                        class="mt-4 w-full sm:w-auto min-h-11 lg:[@media(pointer:fine)]:min-h-0 px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        {t.ai_regenerate}
                      </button>
                    {:else}
                      <ol
                        class="ai-list list-decimal pl-5 space-y-2 text-sm text-zinc-600 dark:text-zinc-400 marker:text-zinc-950 dark:marker:text-zinc-200 marker:font-bold"
                      >
                        <!-- Deux-points dans la chaîne traduite (voir
                             `translations`). -->
                        <li>
                          <strong>{t.ai_key_content}</strong>
                          {t.ai_key_desc}
                        </li>
                        <li>
                          <strong>{t.ai_implications}</strong>
                          {t.ai_impl_desc}
                        </li>
                      </ol>
                      <button
                        on:click={expliquerArticle}
                        data-testid="law-explain"
                        class="ai-question-btn mt-6 w-full sm:w-auto min-h-11 lg:[@media(pointer:fine)]:min-h-0 px-4 py-2 bg-zinc-950 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-xl text-sm font-medium transition-colors shadow-sm dark:shadow-none"
                      >
                        {t.ai_explain}
                      </button>
                    {/if}
                  </div>
                </div>
              </article>

              <!--
                La barre, répétée sous l'article : elle n'existait qu'au-dessus,
                et il fallait remonter tout un long article pour passer au
                suivant. Classe distincte de `article-navigation` : les tests
                qui visent la barre du haut la trouvent seule.
              -->
              <div
                class="article-navigation-bas mt-8 sm:mt-10 flex justify-between items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2 sm:p-4 border border-zinc-200 dark:border-zinc-700/60"
              >
                <button
                  class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  on:click={navigateToPrevious}
                  disabled={currentArticleIndex === 0}
                  aria-label={t.previous}
                >
                  <Icone nom="chevron-left" class="w-4 h-4 shrink-0" />
                  <span class="hidden sm:inline">{t.previous}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-zinc-700 dark:text-zinc-200 enabled:hover:bg-white enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white transition-colors lg:hidden"
                  on:click={ouvrirSommaire}
                  aria-haspopup="dialog"
                  aria-expanded={tocOuvert}
                  aria-controls="sommaire"
                  data-testid="law-toc-toggle-bas"
                >
                  <Icone nom="table-of-contents" class="text-xl" />
                  <span class="flex min-w-0 flex-col items-start leading-tight">
                    <span class="text-sm font-semibold">{t.toc_open}</span>
                    <span class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{compteur}</span>
                  </span>
                </button>
                <div class="hidden lg:block text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400 font-mono">
                  {compteur}
                </div>
                <button
                  class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  on:click={navigateToNext}
                  disabled={currentArticleIndex === flatArticles.length - 1}
                  aria-label={t.next}
                >
                  <span class="hidden sm:inline">{t.next}</span>
                  <Icone nom="chevron-right" class="w-4 h-4 shrink-0" />
                </button>
              </div>
            {:else if flatArticles.length === 0 && law.content}
              <!-- Fallback if parsing failed but content exists -->
              <div class="prose prose-zinc dark:prose-invert max-w-none">
                <p>{t.raw_fallback}</p>
                <pre class="whitespace-pre-wrap font-sans coupe-mots">{law.content}</pre>
              </div>
            {:else}
              <div class="py-20 text-center text-zinc-500 dark:text-zinc-400">{t.loading}</div>
            {/if}
          </main>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Le bouton de l'assistant, comme sur la recherche et l'accueil : il
     manquait ici, et l'accès au chat changeait d'une page à l'autre de la
     section. Il se retire quand le texte passe dessous (`eviter`), et le
     pied de page lui réserve sa place en fin de défilement. -->
<ChatFab eviter="[data-hors-du-bouton]" />
<SiteFooter reserverBouton />

<style>
  /*
   * Hauteurs maximales du sommaire. Ici plutot qu'en classes Tailwind : une
   * classe `max-h-[80dvh]` n'ecrit que la valeur en dvh, et un navigateur qui
   * ne la connait pas laisserait le panneau sans limite — fixe en bas de
   * l'ecran, il deborderait par le haut sans pouvoir defiler. La valeur en vh,
   * ecrite d'abord, sert de repli.
   */
  @media not all and (min-width: 1024px) {
    .sommaire {
      max-height: 80vh;
      max-height: 80dvh;
    }
  }

  @media (min-width: 1024px) {
    .sommaire {
      max-height: calc(100vh - 7rem);
      max-height: calc(100dvh - 7rem);
    }
  }

  /*
   * Le panneau monte du bas et le fond apparait en fondu : le lecteur voit d'ou
   * vient le sommaire et ou il retournera. Rien de tout cela pour qui a demande
   * moins d'animations.
   */
  @media (prefers-reduced-motion: no-preference) {
    .sommaire.ouvert {
      animation: monter 0.2s ease-out;
    }

    .fond-sommaire {
      animation: fondu 0.2s ease-out;
    }
  }

  @keyframes monter {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes fondu {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
