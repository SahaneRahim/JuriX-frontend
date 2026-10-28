<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { API_URL } from '$lib/api';
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import ImagePdfViewer from "$lib/components/ImagePdfViewer.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { afterNavigate, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import { formatDate } from "$lib/format";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import { blocsDeReponse } from "$lib/texte";
  import { LONGUEUR_MAX_NUMERO, normaliserNumeroArticle } from "$lib/article";

  /** Rempli par `+page.server.ts`. Un identifiant inexistant n'arrive plus ici : 404. */
  export let data;

  // `lawId` a disparu avec le chargement client : l'identifiant est lu par
  // `+page.server.ts`, qui seul en a besoin. Le garder ici en aurait fait une seconde
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

  const translations = {
    fr: {
      explorer: "Explorer",
      category: "Catégorie",
      loading: "Chargement...",
      return: "Retour à l'accueil",
      toc: "Table des matières",
      // Libellé court du bouton qui ouvre le sommaire sous `lg` : il partage
      // la barre Précédent / Suivant d'un écran de 320 px.
      toc_open: "Sommaire",
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
      copy_citation: "Copier la citation",
      citation_copied: "Citation copiée !",
      article_prefix: "Article", // For "Article 1"
      raw_fallback: "Affichage brut (structure non détectée) :",
    },
    en: {
      explorer: "Explorer",
      category: "Category",
      loading: "Loading...",
      return: "Back to Home",
      toc: "Table of Contents",
      toc_open: "Contents",
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
    const texte = currentArticle.content.trim();
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
  afterNavigate(({ type }) => {
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

  $: verrouillerDefilement(tocOuvert);
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

<svelte:window on:keydown={surTouche} />

<!-- `min-h-app` (app.css) et non `min-h-screen min-h-dvh` : Tailwind écrit
     `.min-h-dvh` AVANT `.min-h-screen`, et la paire valait toujours 100vh. -->
<div
  class="page text-slate-900 dark:text-gray-100 bg-[#F8F9FA] dark:bg-slate-900 min-h-app font-sans"
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
    class="breadcrumb bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 py-1 sm:py-4 sm:court:py-1.5 px-0 sticky top-0 z-40 shadow-sm"
  >
    <div
      class="container mx-auto px-3 sm:px-4 max-w-[1400px] flex items-center justify-between gap-3"
    >
      <!-- Left: Breadcrumb -->
      <!-- Sur une seule ligne : seul le titre se tronque (`min-w-0`), les
           autres morceaux gardent leur largeur. -->
      <div
        class="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
      >
        <!-- 44 px sous `sm`, où il n'est plus qu'une flèche : son nom passe
             par aria-label, le libellé visible étant masqué. -->
        <button
          class="-ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors sm:ml-0 sm:mr-2 sm:h-auto sm:w-auto"
          on:click={() => window.history.back()}
          aria-label={t.return}
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            /></svg
          >
          <span class="hidden sm:inline whitespace-nowrap">{t.return}</span>
        </button>
        <span class="hidden sm:inline text-gray-300 dark:text-slate-600" aria-hidden="true">|</span>
        <a href="/" class="hidden sm:inline shrink-0 whitespace-nowrap hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >{t.explorer}</a
        >
        <svg class="hidden sm:block w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
          ><path
            d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
          /></svg
        >
        {#if law?.category_id}
          <!-- Pointait vers "/" : le libellé annonçait une catégorie et le lien
               ramenait à l'accueil. La route /categories/[id] existe. -->
          <a
            href="/categories/{law.category_id}"
            class="hidden sm:inline shrink-0 whitespace-nowrap hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.category} {law.category_id}</a
          >
          <svg class="hidden sm:block w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
            ><path
              d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
            /></svg
          >
        {/if}
        <span
          class="min-w-0 truncate font-medium text-gray-900 dark:text-white sm:max-w-[400px]"
          >{law?.title || t.loading}</span
        >
      </div>

      <!-- Right: Language Switcher -->
      <!-- Masquée sous `sm` : doublon de la bascule du menu de l'en-tête, elle
           prenait la place du titre. -->
      <div class="hidden sm:flex items-center gap-3">
        <div class="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            class="px-2 py-1 text-xs font-bold rounded shadow-sm transition-all {currentLanguage ===
            'fr'
              ? 'bg-white dark:bg-slate-700 text-blue-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}"
            on:click={() => setLanguage("fr")}
            aria-pressed={currentLanguage === "fr"}
          >
            FR
          </button>
          <button
            class="px-2 py-1 text-xs font-bold rounded shadow-sm transition-all {currentLanguage ===
            'en'
              ? 'bg-white dark:bg-slate-700 text-blue-600'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}"
            on:click={() => setLanguage("en")}
            aria-pressed={currentLanguage === "en"}
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
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3 px-4">
        <button
          type="button"
          on:click={() => invalidateAll()}
          data-testid="law-retry"
          class="min-h-11 sm:min-h-0 px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-medium hover:border-primary hover:text-primary transition-colors"
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
    <div class="main-content py-4 sm:py-8">
      <div class="container mx-auto px-3 sm:px-4 max-w-[1400px]">
        <!-- `minmax(0, 1fr)` et non `1fr` (qui vaut minmax(auto, 1fr)) : un
             mot insécable, une cote ou une URL élargissait la colonne de
             lecture au-delà de l'écran entre 1 024 et 1 280 px. -->
        <div class="layout grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8">
          {#if tocOuvert}
            <!-- Fond du panneau du sommaire. Au-dessus du fil d'Ariane (z-40),
                 sous la boîte du profil (z-[60]). -->
            <div
              class="fond-sommaire fixed inset-0 z-[55] bg-slate-900/50 lg:hidden"
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
            class="sidebar sommaire flex-col bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 {tocOuvert
              ? 'fixed inset-x-0 bottom-0 z-[56] flex rounded-t-2xl border-t shadow-2xl pb-zone-sure px-zone-sure'
              : 'hidden'} lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:flex lg:h-fit lg:rounded-xl lg:border lg:p-0 lg:shadow-sm"
            class:ouvert={tocOuvert}
            role={tocOuvert ? "dialog" : undefined}
            aria-modal={tocOuvert ? "true" : undefined}
            aria-labelledby={tocOuvert ? "sommaire-titre" : undefined}
            use:piegerSiOuvert={tocOuvert}
          >
            <div
              class="sidebar-header flex shrink-0 items-center justify-between gap-3 px-4 pt-2 lg:mb-4 lg:px-6 lg:pt-6"
            >
              <h2 id="sommaire-titre" class="text-lg font-bold text-gray-900 dark:text-white">
                {t.toc}
              </h2>
              <button
                type="button"
                class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden"
                on:click={fermerSommaire}
                aria-label={$tr("common.close")}
                data-testid="law-toc-close"
              >
                <span class="material-icons" aria-hidden="true">close</span>
              </button>
            </div>

            <div
              class="search-box mx-4 mb-3 mt-1 flex shrink-0 items-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 lg:mx-6 lg:mb-6 lg:mt-0"
            >
              <svg
                class="w-4 h-4 shrink-0 text-gray-500 mr-2"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"
                />
              </svg>
              <!-- 16 px sous `lg`, là où il vit dans le panneau tactile : en
                   dessous, iOS zoome sur la page au focus et ne dézoome pas. -->
              <input
                type="text"
                class="bg-transparent border-none outline-none w-full min-w-0 text-base lg:text-sm text-gray-900 dark:text-white placeholder-gray-400"
                placeholder={t.filter}
                bind:value={searchQuery}
          aria-label={t.filter}
              />
            </div>

            <nav
              class="toc min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 space-y-6 lg:px-6 lg:pb-6"
              aria-labelledby="sommaire-titre"
            >
              {#each filteredTOC as section}
                <div class="toc-section">
                  <!-- Collé en haut de la liste qui défile : on sait toujours
                       dans quel titre ou chapitre on se trouve. -->
                  <div
                    class="sticky top-0 z-[1] bg-white dark:bg-slate-800 py-1 mb-2 lg:mb-3 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest coupe-mots"
                  >
                    {section.title}
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
                        class="text-left px-3 py-3 lg:py-2 rounded-md text-base lg:text-sm transition-all duration-200
                                 {isActive
                          ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'}"
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
                <div class="text-sm text-gray-500 dark:text-gray-400 italic">{t.no_result}</div>
              {/if}
            </nav>
          </div>

          <!-- Content Column -->
          <!-- `min-w-0` : élément de grille, il ne doit pas s'élargir sur son
               contenu le plus large. -->
          <main
            id="contenu"
            class="content min-w-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 md:p-10 shadow-sm relative"
          >
            <!-- Document Header -->
            <div
              class="document-header border-b border-gray-100 dark:border-slate-700 pb-6 mb-6 sm:pb-8 sm:mb-8"
            >
              <!-- Passe à la ligne : sur téléphone, la cote et la date
                   écrasaient le badge sur deux lignes. Les cotes du type
                   « N°2018/9387/CAB/PM » n'ont aucune coupure possible. -->
              <div class="document-meta flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                <span
                  class="inline-block shrink-0 whitespace-nowrap px-3 py-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-md text-xs font-bold uppercase tracking-wide"
                >
                  {t.law_decree}
                </span>
                <span class="min-w-0 coupe-mots text-sm text-gray-500"
                  >{law.reference || "Loi No " + law.id} - {formatDate(law.publication_date, currentLanguage)}</span
                >
              </div>
              <h1
                class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight coupe-mots"
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
              <!--
                Rangée qui passe à la ligne, chaque bouton s'étirant sur la
                place libre (`flex-1`, rendu à sa largeur à partir de `sm`).
                Elle ne passait pas à la ligne : les trois boutons demandaient
                environ 400 px pour 280 disponibles à 360 px, et TOUTE la page
                glissait de côté. Pas de grille à deux colonnes : « Document
                original » ne tient pas dans une demi-largeur de téléphone, il
                y aurait coupé son libellé sur deux lignes.
              -->
              <div class="document-actions flex flex-wrap gap-2 sm:gap-3">
                <button
                  class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 sm:min-h-0 sm:flex-none sm:px-4 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
                  on:click={copierLeLien}
                >
                  <svg
                    class="w-5 h-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
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
                    class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 sm:min-h-0 sm:flex-none sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm shadow-blue-600/20 transition-colors"
                    href={`${API_URL}/laws/${law.id}/download`}
                    download
                  >
                    <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
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
                    class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 sm:min-h-0 sm:flex-none sm:px-4 rounded-lg text-sm font-medium border transition-colors {afficherDocument
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
                    class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 sm:min-h-0 sm:flex-none sm:px-4 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-500 rounded-lg text-sm font-medium cursor-not-allowed"
                    disabled
                    title={t.no_source_file}
                  >
                    <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
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
              <!-- Bord à bord sur téléphone (`-mx-4` annule la marge de la
                   carte) : 32 px de plus pour la page, là où chaque pixel de
                   largeur grossit le texte du PDF. -->
              <div
                class="-mx-4 mt-6 mb-6 overflow-hidden border-y border-slate-200 dark:border-slate-700 sm:mx-0 sm:rounded-xl sm:border"
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
            -->
            <div
              bind:this={debutArticle}
              class="article-navigation flex justify-between items-center gap-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg p-2 sm:p-4 mb-6 sm:mb-10 border border-gray-100 dark:border-slate-700 scroll-mt-16 sm:scroll-mt-20 sm:court:scroll-mt-14 lg:scroll-mt-24"
            >
              <button
                class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 sm:h-auto sm:min-w-0 sm:py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-600 transition-colors"
                on:click={navigateToPrevious}
                disabled={!flatArticles.length || currentArticleIndex === 0}
                aria-label={t.previous}
              >
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
                  ><path
                    fill-rule="evenodd"
                    d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z"
                  /></svg
                >
                <span class="hidden sm:inline">{t.previous}</span>
              </button>
              <button
                type="button"
                class="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md px-3 text-gray-700 dark:text-gray-200 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400 disabled:opacity-50 transition-colors lg:hidden"
                on:click={ouvrirSommaire}
                disabled={!flatArticles.length}
                aria-haspopup="dialog"
                aria-expanded={tocOuvert}
                aria-controls="sommaire"
                data-testid="law-toc-toggle"
              >
                <span class="material-icons text-xl" aria-hidden="true">toc</span>
                <span class="flex min-w-0 flex-col items-start leading-tight">
                  <span class="text-sm font-semibold">{t.toc_open}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{compteur}</span>
                </span>
              </button>
              <div class="hidden lg:block text-sm font-medium text-gray-500">
                {compteur}
              </div>
              <button
                class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 sm:h-auto sm:min-w-0 sm:py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-600 transition-colors"
                on:click={navigateToNext}
                disabled={!flatArticles.length ||
                  currentArticleIndex === flatArticles.length - 1}
                aria-label={t.next}
              >
                <span class="hidden sm:inline">{t.next}</span>
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
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
                  class="article-header flex justify-between items-start gap-3 mb-6"
                >
                  <div class="min-w-0">
                    <p
                      class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 coupe-mots"
                    >
                      {currentArticle.sectionTitle || ""}
                    </p>
                    <h2
                      class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white"
                    >
                      {t.article_prefix}
                      {currentArticle.number}
                    </h2>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      on:click={copierCitationArticle}
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                      title={t.copy_citation}
                      aria-label={t.copy_citation}
                    >
                      <span class="material-icons text-base text-blue-600 dark:text-blue-400">
                        {citationCopiee ? "check" : "link"}
                      </span>
                      <span>{citationCopiee ? t.citation_copied : t.copy_citation}</span>
                    </button>
                    <span
                      class="shrink-0 whitespace-nowrap px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wide"
                    >
                      {t.in_force}
                    </span>
                  </div>
                </div>

                {#if currentArticle.title && currentArticle.title !== `Article ${currentArticle.number}` && currentArticle.title !== `Texte de l'article ${currentArticle.number}`}
                  <h3
                    class="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 sm:mb-8 coupe-mots"
                  >
                    {currentArticle.title}
                  </h3>
                {/if}

                <!-- 16 px sur téléphone (18 au-dessus), et coupure des cotes,
                     URL et références sans espace, qui débordaient de la
                     colonne. -->
                <div
                  class="article-content space-y-4 sm:space-y-6 text-base sm:text-lg leading-relaxed text-gray-700 dark:text-gray-300 coupe-mots"
                >
                  {#each currentArticle.content.split("\n") as paragraph}
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
                  class="ai-explanation mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-6 p-4 sm:p-6 bg-blue-50 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-700 rounded-xl relative overflow-hidden"
                >
                  <!-- Decorative bg -->
                  <div
                    class="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"
                  ></div>

                  <div
                    class="ai-icon w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20"
                  >
                    <svg
                      class="w-5 h-5 sm:w-6 sm:h-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM9.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"
                      />
                      <path
                        d="M13.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1-1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"
                      />
                    </svg>
                  </div>
                  <div class="ai-content flex-1 min-w-0 z-10 coupe-mots">
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
                            class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full motion-safe:animate-bounce"
                            style="animation-delay: 0ms"
                          ></span>
                          <span
                            class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full motion-safe:animate-bounce"
                            style="animation-delay: 150ms"
                          ></span>
                          <span
                            class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full motion-safe:animate-bounce"
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
                          class="mt-2 inline-flex min-h-11 items-center sm:min-h-0 underline font-medium hover:no-underline"
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
                        class="mt-4 w-full sm:w-auto min-h-11 sm:min-h-0 px-4 py-2 border border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-400 hover:bg-blue-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
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
                        class="ai-question-btn mt-6 w-full sm:w-auto min-h-11 sm:min-h-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
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
                class="article-navigation-bas mt-8 sm:mt-10 flex justify-between items-center gap-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg p-2 sm:p-4 border border-gray-100 dark:border-slate-700"
              >
                <button
                  class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 sm:h-auto sm:min-w-0 sm:py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-600 transition-colors"
                  on:click={navigateToPrevious}
                  disabled={currentArticleIndex === 0}
                  aria-label={t.previous}
                >
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
                    ><path
                      fill-rule="evenodd"
                      d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z"
                    /></svg
                  >
                  <span class="hidden sm:inline">{t.previous}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md px-3 text-gray-700 dark:text-gray-200 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors lg:hidden"
                  on:click={ouvrirSommaire}
                  aria-haspopup="dialog"
                  aria-expanded={tocOuvert}
                  aria-controls="sommaire"
                  data-testid="law-toc-toggle-bas"
                >
                  <span class="material-icons text-xl" aria-hidden="true">toc</span>
                  <span class="flex min-w-0 flex-col items-start leading-tight">
                    <span class="text-sm font-semibold">{t.toc_open}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">{compteur}</span>
                  </span>
                </button>
                <div class="hidden lg:block text-sm font-medium text-gray-500">
                  {compteur}
                </div>
                <button
                  class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-3 sm:h-auto sm:min-w-0 sm:py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-600 transition-colors"
                  on:click={navigateToNext}
                  disabled={currentArticleIndex === flatArticles.length - 1}
                  aria-label={t.next}
                >
                  <span class="hidden sm:inline">{t.next}</span>
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
                    ><path
                      fill-rule="evenodd"
                      d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                    /></svg
                  >
                </button>
              </div>
            {:else if flatArticles.length === 0 && law.content}
              <!-- Fallback if parsing failed but content exists -->
              <div class="prose dark:prose-invert max-w-none">
                <p>{t.raw_fallback}</p>
                <pre class="whitespace-pre-wrap font-sans coupe-mots">{law.content}</pre>
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
