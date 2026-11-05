<script lang="ts">
  /**
   * La page d'un texte : la lecture article par article ou du texte entier
   * (P10), le statut juridique prouvé et daté (P1), une adresse et une
   * référence propres pour chaque article (P2), les titres et le texte
   * officiel en Literata (Q5). Maquettes : data/ux-recherche/maquettes/pages/
   * loi-p1a, constitution-p1a, loi-p10a, loi-q5a, loi-q5a-texte.
   *
   * PAGE EN CACHE (ISR, +page.server.ts). Rien n'y dépend du visiteur : le
   * rendu serveur montre toujours le texte ouvert sur son premier article, en
   * lecture article par article. Le navigateur applique ensuite l'adresse
   * (`?article=N`, `#art-N`) APRÈS l'hydratation (`afterNavigate`) : le
   * premier rendu du client est celui du serveur, sans remplacement de tout
   * l'article au réveil de la page.
   *
   * Le découpage du texte, le statut, les références et les composants de la
   * page vivent dans src/lib/components/loi/, en fonctions pures testées.
   *
   * REFONTE A (maquette docs/refonte/maquettes/RefonteLecture, PASSATION E5).
   * Plus de grande carte blanche : le texte est posé sur le fond de la page,
   * en trois colonnes à partir de 1 280 px (sommaire de 200 px, lecture de
   * 34 em au plus, note de l'IA de 280 px), la note passant sous le texte en
   * dessous. Une ligne de statut (pastille tamponnée), les deux actions de
   * l'article et la mention « fait foi », une navigation « Précédent /
   * Suivant » avec le voisin, et un article qui glisse dans le sens de la
   * lecture (`feuilleter`). Rien n'est retiré (décision L1) : partage,
   * téléchargement, document d'origine, onglet « Historique », texte entier,
   * « Copier le texte », compteur, type, dates et encadré d'article restent,
   * au second plan. La logique d'adresse (`?article=`, `#art-N`, P2) ne
   * change pas.
   */
  import { onDestroy, onMount, tick } from "svelte";
  import { afterNavigate, invalidateAll, pushState, replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { ancrerLaNote } from "$lib/actions/ancrer-la-note";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import { ajouteLe, dateDeLActe, nombreDeTextesDeLHistorique, type DateDeLActe } from "$lib/api-publique";
  import { LONGUEUR_MAX_NUMERO, normaliserNumeroArticle, numeroAAfficher } from "$lib/article";
  import { nomCategorie } from "$lib/categories";
  import { API_URL } from "$lib/config";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import ImagePdfViewer from "$lib/components/ImagePdfViewer.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import ActionsDeLArticle from "$lib/components/loi/ActionsDeLArticle.svelte";
  import BasculeDeLecture from "$lib/components/loi/BasculeDeLecture.svelte";
  import HistoriqueDuTexte from "$lib/components/loi/HistoriqueDuTexte.svelte";
  import LienDePartage from "$lib/components/loi/LienDePartage.svelte";
  import ListeDuSommaire from "$lib/components/loi/ListeDuSommaire.svelte";
  import NoteDeLIA from "$lib/components/loi/NoteDeLIA.svelte";
  import StatutDeLArticle from "$lib/components/loi/StatutDeLArticle.svelte";
  import StatutDuTexte from "$lib/components/loi/StatutDuTexte.svelte";
  import TexteEntier from "$lib/components/loi/TexteEntier.svelte";
  import { remplir } from "$lib/components/listes/reperes";
  import {
    decouperLeTexte,
    divisionsPrincipales,
    enTetePrincipal,
    extraitDeLArticle,
    intituleDeLArticle,
    libelleDeDivision,
    paragraphesACopier,
    paragraphesDeLArticle,
    type ArticleDuTexte,
    type EnTeteDeDivision,
    type TexteDecoupe,
  } from "$lib/components/loi/decoupage";
  import {
    ancreDeLArticle,
    lienDeSignalement,
    lireAncre,
    nomCourtDuTexte,
    numeroDArticleEcrit,
    referenceACopier,
    referenceDeLArticle,
    referenceDuTexte,
    texteACopier,
  } from "$lib/components/loi/reference";
  import {
    changementsParArticle,
    marqueDuSommaire,
    type ChangementsDeLArticle,
    type MarqueDuSommaire,
  } from "$lib/components/loi/statut";
  import { lirePassages, segmenter, type Passage } from "$lib/components/loi/surlignage";
  import { BOUTON_SECONDAIRE, POLICE_DES_TITRES, POLICE_DU_TEXTE_OFFICIEL } from "$lib/components/loi/typographie";
  import { formatDate } from "$lib/format";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import { language, tr } from "$lib/stores/language";
  import { classesBadgeDeType, typeDeTexte } from "$lib/type-de-texte";

  /** Rempli par `+page.server.ts`. Un identifiant inexistant n'arrive plus ici : 404. */
  export let data;

  type Mode = "article" | "texte";

  // ---------------------------------------------------------------------------
  // Données
  // ---------------------------------------------------------------------------

  $: law = data.law;
  $: statut = data.statut ?? null;
  $: error = data.erreur ? $tr(data.erreur) : "";
  $: langue = $language.current;
  // Langue du DOCUMENT, pour l'attribut `lang` du texte officiel : un lecteur
  // d'écran en anglais lit alors le décret avec la voix française.
  $: langueDuTexte = (law?.language === "en" ? "en" : "fr") as "fr" | "en";

  /**
   * Le texte découpé, recalculé à CHAQUE changement de `data.law` : SvelteKit
   * réutilise la page de /laws/1 à /laws/2, et un découpage fait une fois au
   * montage laisserait le sommaire du texte précédent sous le nouveau titre.
   */
  $: decoupe = decouperLeTexte(law?.content);
  $: articles = decoupe.articles;
  $: changements = changementsParArticle(statut, decoupe);
  // Le document en base intègre déjà des modifications (`version_en_base`) :
  // aucun encadré d'article ne le dit « version d'origine » (statut.ts).
  $: consolide = Boolean(statut?.version_en_base);
  $: marques = marquesDuSommaire(changements);
  $: nombreHistorique = statut ? nombreDeTextesDeLHistorique(statut) : 0;

  function marquesDuSommaire(parRang: Map<number, ChangementsDeLArticle>): Map<number, MarqueDuSommaire> {
    const resultat = new Map<number, MarqueDuSommaire>();
    for (const [rang, entree] of parRang) {
      const marque = marqueDuSommaire(entree);
      if (marque) resultat.set(rang, marque);
    }
    return resultat;
  }

  // ---------------------------------------------------------------------------
  // État de lecture
  // ---------------------------------------------------------------------------

  /** Article par article (par défaut, et seul mode du rendu serveur) ou texte entier. */
  let mode: Mode = "article";
  /** Article affiché en lecture article par article. */
  let rangCourant = 0;
  /**
   * Article lu en texte entier, suivi au défilement ; -1 avant le premier
   * article (en-tête du document, visas) : le fil d'Ariane s'arrête alors au
   * texte, et le sommaire ne marque aucun article.
   */
  let rangVisible = 0;
  let onglet: "texte" | "historique" = "texte";
  /**
   * Document d'origine (pages rendues par le serveur, sans bibliothèque de
   * rendu côté client) : ImagePdfViewer.
   */
  let afficherDocument = false;
  /** Saisie du filtre du sommaire, et la valeur appliquée (150 ms après la frappe). */
  let saisieDuFiltre = "";
  let filtre = "";
  /**
   * La classe de feuilletage de l'article (`feuilleter`, plus bas), et la
   * bascule entre ses deux noms. Vide au rendu serveur : aucun glissement.
   */
  let feuillete = "";
  let basculeDuFeuilletage = false;

  /** Nouveau texte : la lecture repart de zéro. L'adresse est appliquée ensuite (`afterNavigate`). */
  let idAffiche: number | undefined = undefined;
  $: changerDeTexte(law?.id);
  function changerDeTexte(id: number | undefined) {
    if (id === idAffiche) return;
    idAffiche = id;
    mode = "article";
    rangCourant = 0;
    rangVisible = 0;
    onglet = "texte";
    afficherDocument = false;
    saisieDuFiltre = "";
    filtre = "";
    feuillete = "";
  }

  $: rangAffiche = mode === "texte" ? rangVisible : rangCourant;
  $: articleCourant = articles[rangCourant] as ArticleDuTexte | undefined;
  $: articleAffiche = articles[rangAffiche] as ArticleDuTexte | undefined;
  $: divisionAffichee = articleAffiche ? decoupe.divisions[articleAffiche.division] : undefined;
  $: divisionCourante = articleCourant ? decoupe.divisions[articleCourant.division] : undefined;

  /**
   * La place d'un article dans le texte : TOUTE la chaîne des divisions qui le
   * contiennent (`ancetres`, « Titre II · Chapitre 1 »), pour le fil d'Ariane
   * et le surtitre de l'article. Le fil ne gardait que le dernier en-tête :
   * « Loi n° 96/06 › Chapitre 1 › Article 6 », alors que la Constitution a un
   * « Chapitre 1 » dans plusieurs titres (vérification r2 du 29/10/2026). Et
   * pas la chaîne du sommaire (`enTetesDuSommaire`), qui ne garde que les
   * en-têtes lus depuis la division précédente : les articles 15 à 19 de la
   * Constitution, au chapitre 1 du titre III, n'y sont que « Chapitre 1 ».
   * Le sommaire a le titre juste au-dessus ; le fil et le surtitre, non.
   */
  function nommerLaChaine(entetes: EnTeteDeDivision[], traduire: (cle: string) => string): string {
    return entetes.map((entete) => libelleDeDivision(entete, traduire)).join(" · ");
  }
  $: chaineDuFil = divisionAffichee ? nommerLaChaine(divisionAffichee.ancetres, $tr) : "";

  // ---------------------------------------------------------------------------
  // Noms, dates, références (P1, P2)
  // ---------------------------------------------------------------------------

  // Libellé et icône du type (loi, décret, arrêté…), la table commune à
  // /laws, /search et la page d'une catégorie.
  $: typeDuTexte = typeDeTexte(law?.type, law?.title);
  // « Décret n° 2021/745 » : fil d'Ariane et partage. Jamais la cote interne.
  $: nomCourt = law ? nomCourtDuTexte(law, $tr) : "";
  /**
   * Nom du domaine dans le fil d'Ariane, dans la langue de l'interface :
   * `GET /laws/{id}` joint la catégorie (`law.category`) ; sans elle, le mot
   * « Catégorie » seul, plutôt qu'un numéro.
   */
  $: nomDeLaCategorie = nomCategorie(law?.category?.name, langue) || $tr("loi.categorie");

  /**
   * « Signé le 28 décembre 2021 » : la date de l'acte (contrat, §1.1), pas sa
   * publication au Journal officiel. Ancienne API : la date d'avant, sans
   * « Signé », ou l'année seule pour un 1er janvier que l'intitulé ne
   * confirme pas.
   */
  $: dateDuTexte = law ? dateDeLActe(law) : null;
  $: libelleDate = ecrireLaDate(dateDuTexte, langue, $tr);
  function ecrireLaDate(date: DateDeLActe | null, lang: "fr" | "en", traduire: (cle: string) => string): string {
    if (!date) return "";
    if (date.genre === "signature") return traduire("loi.date.signe").replace("{date}", formatDate(date.date, lang));
    if (date.genre === "journal_officiel") return traduire("loi.date.jo").replace("{date}", formatDate(date.date, lang));
    if (date.genre === "annee") return traduire("loi.date.annee").replace("{annee}", String(date.annee));
    return formatDate(date.date, lang);
  }
  /** « Ajouté à JuriX le 3 octobre 2026 » : jamais `updated_at`, la dernière écriture en base. */
  $: ajout = law ? ajouteLe(law) : null;

  /**
   * UN seul nombre d'articles sur la page : celui que le lecteur parcourt
   * (sommaire, compteur « 1 / 24 »). Le compte de la base ne sert que quand
   * aucun article n'a été reconnu.
   */
  $: nombreDArticles = articles.length > 0 ? articles.length : (law?.article_count ?? 0);
  $: libelleNombre = $tr(nombreDArticles === 1 ? "loi.compte.article" : "loi.compte.articles").replace(
    "{n}",
    String(nombreDArticles),
  );
  /**
   * « 24 articles · 7 chapitres », « 69 articles · 13 titres », à côté de la
   * bascule de lecture : les divisions du plus haut rang qui structurent le
   * texte (`divisionsPrincipales`). Compter la dernière division de chaque
   * morceau mêlait titres et chapitres : « 69 articles · 15 parties » pour
   * la Constitution (vérification r1 du 29/10/2026).
   */
  $: resumeDuTexte = resumer(decoupe, libelleNombre, $tr);
  function resumer(texte: TexteDecoupe, nombre: string, traduire: (cle: string) => string): string {
    const principales = divisionsPrincipales(texte);
    if (!principales) return nombre;
    return `${nombre} · ${traduire(`loi.compte.${principales.mot}`).replace("{n}", String(principales.nombre))}`;
  }

  $: classeTitre = tailleDuTitre(law?.title ?? "");
  $: classeDeLArticle = tailleDeLArticle(law?.title ?? "");

  /**
   * POURQUOI UNE TAILLE CALCULÉE.
   * « Article N » : 32 px dans la maquette, mais JAMAIS plus grand que le
   * titre du texte (restes R3 : le h2 dominait le h1) : un palier sous celui
   * du titre, selon la même longueur. Un titre de décret de 200 caractères
   * (20 et 24 px) garde son « Article N » à 20 et 24 px.
   */
  function tailleDeLArticle(titre: string): string {
    if (titre.length <= 40) return "text-2xl/[1.2] sm:text-[2rem]/[1.2]";
    if (titre.length <= 100) return "text-xl/[1.2] sm:text-[1.75rem]/[1.2]";
    return "text-xl/[1.2] sm:text-2xl/[1.2]";
  }

  /**
   * Taille du titre officiel, selon sa longueur. Un intitulé de décret
   * dépasse souvent 200 caractères : à 36 px, il prenait 8 lignes à 1 024 px.
   * Plus il est long, plus il descend, jusqu'à 20 px sur téléphone et 24 px
   * au-delà ; sur écran court (`court:`), la taille du téléphone en portrait.
   * L'intitulé « Article N » de la lecture article par article est à 20 et
   * 24 px : jamais plus grand que ce titre (restes R3 : le h2 dominait le h1).
   *
   * L'interligne de 1,2 (Q5) est donné AVEC chaque taille (`text-2xl/[1.2]`).
   * Posé à part (`leading-[1.2]`), il ne valait que sous 640 px : la règle
   * `sm:text-2xl`, écrite plus loin dans la feuille de style, remettait
   * l'interligne de Tailwind (32 px pour un corps de 24, 1,33). Le titre du
   * décret 2021/745 prenait ainsi 16 px de trop à 1 440 px (captures r2 du
   * 29/10/2026 : 32 px d'une ligne à l'autre).
   */
  function tailleDuTitre(titre: string): string {
    // Refonte A : un titre court monte jusqu'à 40 px à partir de `lg`, comme
    // le `clamp(1.75rem, …, 2.5rem)` de la maquette, sans quitter l'échelle.
    if (titre.length <= 40) return "text-3xl/[1.2] sm:text-4xl/[1.2] lg:text-[2.5rem]/[1.2] court:text-3xl/[1.2]";
    if (titre.length <= 100) return "text-2xl/[1.2] sm:text-3xl/[1.2] court:text-2xl/[1.2]";
    return "text-xl/[1.2] sm:text-2xl/[1.2] court:text-xl/[1.2]";
  }

  /**
   * Adresses ABSOLUES, pour copier, partager et signaler : l'origine du site
   * (la même pour tous les visiteurs, la page en cache n'en dépend donc pas).
   */
  $: origine = $page.url.origin;
  $: adresseDuTexte = law ? `${origine}/laws/${law.id}` : "";
  function adressePartageable(article: ArticleDuTexte | undefined): string {
    if (!law || !article) return adresseDuTexte;
    // `?article=` comme les liens du chat et de la recherche ; l'ancre en plus
    // pour un homonyme (Code civil), que le seul numéro ne distingue pas.
    const ancre = article.occurrence > 0 ? `#${ancreDeLArticle(article)}` : "";
    return `${origine}/laws/${law.id}?article=${encodeURIComponent(article.numero)}${ancre}`;
  }

  $: numeroEcrit = articleCourant ? numeroDArticleEcrit(articleCourant.numero, langue) : "";
  /**
   * « Poser une question sur cet article » (décision L7) : l'assistant avec la
   * question PRÉ-REMPLIE, jamais envoyée (`/chat?q=`, sans `envoyer=1`) : un
   * appel au modèle ne part pas pour une phrase que le lecteur n'a pas
   * écrite. Le chat ne reçoit que ce texte : il retrouve l'article par la
   * recherche (PASSATION § 9, B6). Écrit APRÈS `numeroEcrit` et `nomCourt` :
   * en Svelte 5 « legacy », les `$:` passent dans l'ordre du source. Rendu au
   * serveur sur le premier article, comme le reste de la page en cache.
   */
  $: lienQuestion =
    law && articleCourant
      ? `/chat?q=${encodeURIComponent(remplir($tr("loi.ia.question_modele"), { n: numeroEcrit, nom: nomCourt }))}`
      : "/chat";
  /** Les voisins, nommés sous « Précédent » et « Suivant » (« Article 36 »). */
  $: articlePrecedent = articles[rangCourant - 1] as ArticleDuTexte | undefined;
  $: articleSuivant = articles[rangCourant + 1] as ArticleDuTexte | undefined;
  $: urlArticle = adressePartageable(articleCourant);
  $: referenceArticle =
    law && articleCourant
      ? referenceDeLArticle({ numero: articleCourant.numero, titreDuTexte: law.title, langue }, $tr)
      : "";
  $: partageDuTexte = { title: law?.title ?? "", text: nomCourt, url: adresseDuTexte };
  $: partageDeLArticle = {
    title: law?.title ?? "",
    text: $tr("loi.partage.texte_article").replace("{n}", numeroEcrit).replace("{nom}", nomCourt),
    url: urlArticle,
  };
  $: referenceACopierIci = referenceACopier(referenceArticle, urlArticle);
  // L'intitulé compris (« Imputabilité ») : il est affiché au-dessus du texte.
  $: texteACopierIci =
    articleCourant && referenceArticle
      ? texteACopier({ paragraphes: paragraphesACopier(articleCourant), reference: referenceArticle, url: urlArticle }, $tr)
      : "";

  /**
   * « Signaler » : un courriel prêt à l'adresse de contact, qui nomme le
   * texte et l'article lu, avec son adresse. La page en cache le rend sur le
   * premier article ; le navigateur le met à jour à chaque article.
   */
  $: lienSignaler = law
    ? lienDeSignalement(
        {
          reference: articleAffiche
            ? referenceDeLArticle({ numero: articleAffiche.numero, titreDuTexte: law.title, langue }, $tr)
            : referenceDuTexte(law.title, langue),
          url: adressePartageable(articleAffiche),
        },
        $tr,
      )
    : "";

  /**
   * Page du PDF de l'article lu, pour la visionneuse. Les morceaux d'un même
   * article (« 55.1 », « 55.2 ») se suivent dans `law.articles` : un seul
   * compte par article, pour retrouver le bon homonyme. L'article CHOISI
   * (lecture article par article), pas celui qui passe à l'écran en texte
   * entier : la visionneuse ouverte chargerait une image de page à chaque
   * article défilé.
   */
  $: pageDuDocument = pageDeLArticle(articleCourant, law?.articles);
  function pageDeLArticle(
    article: ArticleDuTexte | undefined,
    sommaire: { number: string; page_number: number | null }[] | undefined,
  ): number {
    if (!article || !sommaire) return 1;
    const occurrences: { page_number: number | null }[] = [];
    let precedent = "";
    for (const entree of sommaire) {
      const cle = normaliserNumeroArticle(entree.number).replace(/\.\d+$/, "");
      if (cle === article.cle && cle !== precedent) occurrences.push(entree);
      precedent = cle;
    }
    const trouve = occurrences[article.occurrence] ?? occurrences[0];
    return trouve?.page_number && trouve.page_number > 1 ? trouve.page_number : 1;
  }

  // ---------------------------------------------------------------------------
  // Adresse de lecture (P2) : `?article=N`, `#art-N`, et l'état de l'historique
  // ---------------------------------------------------------------------------

  /** Ce qu'une entrée de l'historique du navigateur retient de la lecture. */
  interface EtatDeLecture {
    vue?: Mode;
    /** Rang de l'article dans le texte découpé (distingue les homonymes). */
    rang?: number;
    /** Son numéro, pour vérifier que le rang désigne toujours le même article. */
    article?: string;
    /**
     * Nombre d'entrées que la lecture a ajoutées (sauts du sommaire, liens
     * directs) entre l'arrivée sur le texte et celle-ci : « Retour » remonte
     * d'autant, plus une, pour revenir à la page d'avant (`revenir`).
     * Absent : l'entrée d'arrivée.
     */
    profondeur?: number;
  }

  function lireEtat(etat: unknown): EtatDeLecture {
    if (!etat || typeof etat !== "object") return {};
    const { vue, rang, article, profondeur } = etat as Record<string, unknown>;
    const entierPositif = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : undefined);
    return {
      vue: vue === "texte" || vue === "article" ? vue : undefined,
      rang: entierPositif(rang),
      article: typeof article === "string" ? article.slice(0, LONGUEUR_MAX_NUMERO) : undefined,
      profondeur: entierPositif(profondeur),
    };
  }

  /**
   * Le rang retenu par une entrée de l'historique, s'il désigne toujours le
   * même article : entre deux visites, le texte a pu être réingéré et ses
   * articles renumérotés. Sinon `null`, et l'adresse décide.
   */
  function rangDeLEtat(etat: EtatDeLecture): number | null {
    if (etat.rang === undefined) return null;
    const article = articles[etat.rang];
    if (!article) return null;
    return etat.article === undefined || etat.article === article.numero ? etat.rang : null;
  }

  /**
   * L'article que demande l'adresse : `#art-12` (ou `#art-53-2`, le deuxième
   * article 53 d'une compilation), sinon `?article=12`, posé par les citations
   * du chat et les articles trouvés par la recherche. Comparaison normalisée :
   * « 1er », « 1ER » et « 1 » désignent le même article. Bornée : la valeur
   * vient de l'URL ($lib/article).
   */
  function rangDeLAdresse(url: URL): number | null {
    const numero = numeroDeLAdresse(url);
    if (!numero) return null;
    const voulu = normaliserNumeroArticle(numero);
    let homonymes = articles.filter((article) => article.cle === voulu);
    // « 55.2 » (un morceau, dans une citation du chat) ou « 12 bis » : le
    // découpage de la page ne garde que le nombre de l'article.
    const nombre = /^\d+/.exec(voulu)?.[0];
    if (homonymes.length === 0 && nombre) homonymes = articles.filter((article) => article.cle === nombre);
    return (homonymes[lireAncre(url.hash)?.occurrence ?? 0] ?? homonymes[0])?.rang ?? null;
  }

  /** Le numéro d'article que demande l'adresse (`#art-12`, sinon `?article=12`), borné, ou `null`. */
  function numeroDeLAdresse(url: URL): string | null {
    return lireAncre(url.hash)?.numero ?? url.searchParams.get("article")?.slice(0, LONGUEUR_MAX_NUMERO) ?? null;
  }

  /**
   * L'article demandé par l'adresse que le découpage ne trouve pas, ou `null`.
   * La page ouvrait alors le premier article sous l'adresse `?article=36` : venu
   * d'une citation du chat, le lecteur lisait l'article 2 du Code du travail en
   * le croyant le 36 (vérification r3 du 29/10/2026). Elle ouvre désormais le
   * texte entier, avec un avis ; un texte d'un seul article aussi, dont la
   * lecture article par article cachait l'ouverture, où l'OCR range souvent
   * les articles qu'il n'a pas su lire (décret 2017/398).
   *
   * `numero` : le numéro tel que l'avis l'écrit, ou `null` quand la valeur de
   * l'adresse n'a pas la forme d'un numéro d'article (`numeroAAfficher`). Un
   * lien partagé faisait sinon écrire ce qu'il voulait à l'avis (« L'article
   * abrogé, voir wa.me/… n'a pas été retrouvé dans ce texte »).
   */
  let articleIntrouvable: { numero: string | null } | null = null;

  /**
   * L'avis, rempli par une FONCTION (`remplir`) : passé à `String.replace`, un
   * « $& » ou un « $' » de la valeur y était lu comme un motif.
   */
  $: avisArticleIntrouvable = articleIntrouvable
    ? articleIntrouvable.numero
      ? remplir($tr("loi.articleIntrouvable"), { n: numeroDArticleEcrit(articleIntrouvable.numero, langue) })
      : $tr("loi.passageIntrouvable")
    : "";

  /**
   * Applique une navigation : l'état d'une entrée de l'historique (Précédent,
   * Suivant, saut du sommaire, bascule de lecture), sinon l'adresse. Rend
   * vrai quand un article précis est demandé (pour y faire défiler).
   */
  function appliquerLaNavigation(url: URL, etat: EtatDeLecture): boolean {
    articleIntrouvable = null;
    const retenu = rangDeLEtat(etat);
    // Un texte d'un seul article, sans bascule s'il n'a pas d'ouverture
    // (`avecBascule`), passe en texte entier quand l'article demandé n'y est
    // pas (plus bas) : ses entrées d'historique en gardent la vue.
    if (etat.vue === "texte" && articles.length > 0) {
      mode = "texte";
      if (retenu !== null) rangVisible = retenu;
      return false;
    }
    if (retenu !== null) {
      mode = "article";
      rangCourant = retenu;
      return false;
    }
    const rang = rangDeLAdresse(url);
    const demande = numeroDeLAdresse(url);
    if (rang === null && demande && articles.length > 0) {
      articleIntrouvable = { numero: numeroAAfficher(demande) };
      mode = "texte";
      rangVisible = 0;
      return false;
    }
    mode = "article";
    rangCourant = rang ?? 0;
    return rang !== null;
  }

  /** Monté : le routeur accepte `pushState` et `replaceState`. */
  let monte = false;

  /**
   * L'adresse suit l'article lu (P2), SANS navigation : routage superficiel
   * de SvelteKit, qui ne relance pas le chargement, ne fait pas défiler et ne
   * déplace pas le focus. `replaceState` pour Précédent et Suivant (24
   * « Suivant » ne font pas 24 retours arrière), `pushState` pour un saut du
   * sommaire (le retour arrière ramène à l'article d'avant). En texte entier,
   * l'adresse est celle du texte, plus `#art-N` après un saut. Chaque entrée
   * ajoutée compte une profondeur de plus que celle d'où elle part.
   *
   * Un saut vers l'adresse déjà affichée REMPLACE l'entrée, comme le fait le
   * navigateur pour un lien vers la page même : le lien direct de l'article
   * 5, cliqué trois fois pour mettre son adresse dans la barre, ajoutait
   * trois entrées `#art-5`, et les deux premiers retours arrière ne
   * faisaient rien. L'entrée remplacée garde sa profondeur.
   */
  function ecrireLAdresse(action: "remplacer" | "ajouter", ancreDuTexteEntier = "") {
    if (!monte || !law) return;
    const url = new URL(window.location.href);
    url.hash = "";
    const etat: EtatDeLecture = { vue: mode };
    // `articles[rangCourant]` et non `articleCourant` : appelée juste après
    // le changement de rang, avant que les blocs `$:` ne repassent, elle
    // aurait écrit le numéro de l'article d'avant.
    const courant = articles[rangCourant];
    if (mode === "article" && courant) {
      url.searchParams.set("article", courant.numero);
      if (courant.occurrence > 0) url.hash = ancreDeLArticle(courant);
      etat.rang = rangCourant;
      etat.article = courant.numero;
    } else {
      url.searchParams.delete("article");
      if (ancreDuTexteEntier) url.hash = ancreDuTexteEntier;
      // Avant le premier article (-1), l'entrée ne retient que la vue.
      if (articles[rangVisible]) {
        etat.rang = rangVisible;
        etat.article = articles[rangVisible].numero;
      }
    }
    const adresse = `${url.pathname}${url.search}${url.hash}`;
    const ajouter = action === "ajouter" && url.href !== window.location.href;
    const profondeur = (lireEtat($page.state).profondeur ?? 0) + (ajouter ? 1 : 0);
    if (profondeur > 0) etat.profondeur = profondeur;
    try {
      if (ajouter) pushState(adresse, etat);
      else replaceState(adresse, etat);
    } catch {
      // Routeur pas prêt (rendu en cours) : l'adresse reste celle d'avant, la
      // lecture continue.
    }
  }

  /**
   * Retour et avance du navigateur entre deux entrées de la même page : le
   * routage superficiel ne change que `page.state` (pas `page.url`). Une clé
   * en chaîne : le bloc ne repart que si l'état change vraiment. Sans la
   * profondeur, qui ne dit rien de la lecture : deux entrées qui ne diffèrent
   * que par elle montrent la même chose, et l'entrée que la page adopte
   * (`surHashchange`) ne doit pas réappliquer l'état écrit avant elle, quand
   * le lecteur a pu défiler depuis jusqu'à un autre article du texte entier.
   */
  $: cleDeLEtat = JSON.stringify({ ...lireEtat($page.state), profondeur: undefined });
  $: suivreLHistorique(cleDeLEtat);
  function suivreLHistorique(_cle: string) {
    if (!monte) return;
    const avant = mode;
    const rangAvant = rangCourant;
    appliquerLaNavigation(new URL(window.location.href), lireEtat($page.state));
    // Retour ou avance du navigateur vers un autre article ou une autre vue :
    // pas de feuilletage (voir `feuilleter`). L'adresse que la page vient
    // d'écrire elle-même repasse ici sans rien changer : son geste garde son
    // glissement.
    if (mode !== avant || rangCourant !== rangAvant) feuillete = "";
    // Retour vers le texte entier depuis la lecture article par article : le
    // texte vient d'être rendu, par lots, et la position que rend le
    // navigateur peut tomber avant l'article lu alors.
    if (avant === "article" && mode === "texte" && rangVisible > 0) {
      retenirLeBouton();
      void tick().then(() => texteEntier?.allerA(rangVisible, { immediat: true }));
    }
  }

  /**
   * Une entrée que le navigateur ajoute SEUL, en suivant un lien `#…` que la
   * page n'intercepte pas : le lien d'évitement de l'en-tête (`#contenu`,
   * SiteHeader). Sans état de lecture, elle faisait s'arrêter « Retour » une
   * entrée trop tôt, sur le texte, et un retour arrière ou avant vers elle
   * rouvrait la lecture article par article. La page l'adopte : elle y écrit
   * l'état de l'entrée d'où l'on vient, avec une profondeur de plus.
   *
   * Seul ce suivi déclenche `popstate` avec un état nul (spécification HTML,
   * « navigate to a fragment »), puis `hashchange`. Un retour arrière ou
   * avant porte l'état de son entrée : SvelteKit en pose un sur chacune,
   * l'arrivée comprise.
   *
   * SEULEMENT une entrée que SvelteKit a numérotée (`INDEX_DE_SVELTEKIT`), ce
   * qu'il ne fait qu'après un clic de lien. Une ancre tapée dans la barre
   * d'adresse reste sans index : `replaceState` y écrivait celui de l'entrée
   * d'avant, et au retour arrière, SvelteKit, qui se croyait déjà sur cette
   * entrée, ne rendait pas son état. La page gardait l'état adopté, une
   * profondeur de trop, et « Retour » remontait au-delà de la page d'avant :
   * hors du site quand c'était la première de l'onglet (revue du 29/10/2026).
   * Une telle entrée garde le comportement d'avant l'adoption : « Retour »
   * s'y arrête une entrée trop tôt, sur le texte, sans quitter le site.
   */
  let entreeDuNavigateur = false;

  /**
   * L'index que SvelteKit pose sur chaque entrée qu'il connaît (sa constante
   * interne `HISTORY_INDEX`). Renommé un jour, la page n'adopterait plus
   * rien : le comportement d'avant, jamais un index faux.
   */
  const INDEX_DE_SVELTEKIT = "sveltekit:history";

  let minuterieDeLAdoption: ReturnType<typeof setTimeout> | undefined;

  function surPopstate(event: PopStateEvent) {
    entreeDuNavigateur = event.state === null || event.state === undefined;
  }

  /**
   * L'adoption attend le tour suivant : au chargement direct, l'écouteur de
   * la page, posé à l'hydratation, passe AVANT celui de SvelteKit, qui
   * démarre son routeur ensuite et ne numérote l'entrée qu'après. Elle ne
   * vaut que pour l'entrée de ce `hashchange` : après un retour arrière
   * entre-temps, l'entrée d'avant, numérotée elle aussi, aurait reçu une
   * profondeur de trop.
   */
  function surHashchange() {
    if (!entreeDuNavigateur) return;
    entreeDuNavigateur = false;
    clearTimeout(minuterieDeLAdoption);
    const adresse = window.location.href;
    minuterieDeLAdoption = setTimeout(() => adopterLEntree(adresse), 0);
  }

  function adopterLEntree(adresse: string) {
    if (!monte || window.location.href !== adresse || !history.state?.[INDEX_DE_SVELTEKIT]) return;
    const lu = lireEtat($page.state);
    const etat: EtatDeLecture = {};
    if (lu.vue) etat.vue = lu.vue;
    if (lu.rang !== undefined) etat.rang = lu.rang;
    if (lu.article !== undefined) etat.article = lu.article;
    etat.profondeur = (lu.profondeur ?? 0) + 1;
    try {
      replaceState(`${window.location.pathname}${window.location.search}${window.location.hash}`, etat);
    } catch {
      // Routeur pas prêt : l'entrée reste sans état, comme avant.
    }
  }

  // ---------------------------------------------------------------------------
  // Fil d'Ariane : retour
  // ---------------------------------------------------------------------------

  /**
   * Retour du fil d'Ariane : la page d'où l'on vient quand c'en est une du
   * site (recherche, liste, catégorie, avec ses filtres et sa position),
   * sinon la liste des documents, cible du lien. `pagePrecedenteDuSite` est
   * posé par `afterNavigate`, nul au premier chargement.
   *
   * Pas un simple `history.back()` : les sauts du sommaire et les liens
   * directs ajoutent des entrées à l'historique (P2), et « Retour » ne
   * faisait que revenir au saut d'avant, sur le même texte. Venu de
   * /search, deux sauts demandaient trois « Retour ». La page remonte donc
   * toutes les entrées de la lecture (`profondeur`), plus une.
   */
  let pagePrecedenteDuSite = false;

  function revenir(event: MouseEvent) {
    // Ouverture dans un nouvel onglet (clic du milieu, Ctrl, Cmd, Maj) : le
    // lien garde son comportement.
    if (!pagePrecedenteDuSite || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const pas = (lireEtat($page.state).profondeur ?? 0) + 1;
    // Un compte que l'historique de l'onglet ne peut pas contenir : le lien
    // vers la liste, plutôt qu'un retour qui ne ferait rien.
    if (pas >= history.length) return;
    event.preventDefault();
    history.go(-pas);
  }

  // ---------------------------------------------------------------------------
  // Lecture article par article
  // ---------------------------------------------------------------------------

  /**
   * FEUILLETER (A2 § 3.6) : l'article glisse dans le sens de la lecture,
   * vers la gauche pour le suivant, vers la droite pour le précédent.
   *
   * POURQUOI DEUX NOMS QUI ALTERNENT, ET PAS `{#key}`. CSS ne rejoue pas une
   * animation dont l'élément garde le même nom ; `{#key rangCourant}`
   * recréerait l'article, détruirait `h2#titre-article` (qui reçoit le focus
   * après un choix au clavier dans le sommaire) et l'état des actions de
   * copie, et ferait clignoter le texte. La colonne garde donc son élément,
   * et sa classe passe de `…-a` à `…-b` à chaque geste (mouvement.css :
   * deux @keyframes identiques).
   *
   * POURQUOI SEULEMENT AUX GESTES DU LECTEUR. Précédent, Suivant et un
   * article choisi dans le sommaire, rien d'autre : ni l'arrivée par
   * l'adresse (`?article=`, `#art-N`), ni le retour arrière du navigateur
   * (`afterNavigate`, `popstate`). L'article vient alors d'être posé par
   * l'adresse ; il glisserait au réveil de la page, après le premier
   * affichage. Le HTML du serveur n'a aucune classe de feuilletage.
   */
  function feuilleter(ancien: number, nouveau: number) {
    if (nouveau === ancien) return;
    basculeDuFeuilletage = !basculeDuFeuilletage;
    const sens = nouveau > ancien ? "suivant" : "precedent";
    feuillete = `mv-feuilleter-${sens}-${basculeDuFeuilletage ? "a" : "b"}`;
  }

  function navigateToPrevious() {
    if (rangCourant > 0) {
      feuilleter(rangCourant, rangCourant - 1);
      rangCourant -= 1;
      ecrireLAdresse("remplacer");
      allerAuDebutDeLArticle();
    }
  }

  function navigateToNext() {
    if (rangCourant < articles.length - 1) {
      feuilleter(rangCourant, rangCourant + 1);
      rangCourant += 1;
      ecrireLAdresse("remplacer");
      allerAuDebutDeLArticle();
    }
  }

  /**
   * Début de l'article (son surtitre et « Article N »), cible du défilement à
   * chaque changement d'article. La barre Précédent / Suivant du haut, qui
   * l'était, n'existe plus (maquette : une seule navigation, en bas).
   */
  let debutArticle: HTMLElement | undefined;
  /** Titre « Article N » : reçoit le focus après un choix au clavier dans le sommaire. */
  let titreDeLArticle: HTMLElement | undefined;
  let texteEntier: TexteEntier | undefined;

  /**
   * Amène le début de l'article juste sous le fil d'Ariane collant (marge
   * `scroll-mt-*` de la barre), au lieu de remonter tout en haut de la page.
   * Après `tick()` : le panneau du sommaire a pu se fermer. Animation douce,
   * sauf pour qui a demandé moins de mouvement, et pour un lien profond.
   */
  async function allerAuDebutDeLArticle(immediat = false) {
    if (typeof window === "undefined") return;
    await tick();
    const moinsDeMouvement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    retenirLeBouton();
    debutArticle?.scrollIntoView({
      block: "start",
      behavior: immediat || moinsDeMouvement ? "auto" : "smooth",
    });
  }

  // ---------------------------------------------------------------------------
  // Bouton de l'assistant pendant un défilement fait par la page
  // ---------------------------------------------------------------------------

  /**
   * ChatFab se retire quand le texte passe sous lui, sauf quand le lecteur
   * REMONTE la page, le geste de qui cherche autre chose (`remonte`). Il ne
   * distingue pas un défilement fait par la page : « Suivant » sous un
   * article remonte au début du suivant, et un saut ensuite corrigé par le
   * navigateur (ancrage du défilement) remonte de quelques pixels. Le bouton
   * revenait alors sur l'article : à l'arrivée par `?article=6`, il cachait
   * « avant » et « de la » à 390 px, et la rangée d'actions à 740 × 360
   * (vérification r1 du 29/10/2026).
   *
   * La page le retient donc (`masque`) dès qu'elle fait défiler, jusqu'à ce
   * que le lecteur fasse lui-même défiler d'au moins 16 px (molette, doigt,
   * touche) ; ChatFab, qui a alors mesuré le sens de ce geste, reprend la
   * main.
   */
  let boutonRetenu = false;
  /** Position au premier geste du lecteur depuis le défilement fait par la page, ou `null`. */
  let positionDuGeste: number | null = null;

  function retenirLeBouton() {
    // Seulement quand le bouton est au-dessus d'une zone qu'il ne doit pas
    // couvrir (`data-hors-du-bouton` : l'en-tête du texte, la colonne de
    // lecture, la note). Sur un écran large, elles s'arrêtent avant lui : il
    // reste affiché, et ne doit pas disparaître à chaque « Suivant ». Plus de
    // carte blanche (refonte A) : `#contenu`, désormais de toute la largeur,
    // l'aurait retenu à chaque fois. Le bouton n'expose pas d'élément : on le
    // trouve par son repère de test.
    const bouton = document.querySelector('[data-testid="chat-fab"]')?.getBoundingClientRect();
    const zones = [...document.querySelectorAll("[data-hors-du-bouton]")]
      .map((zone) => zone.getBoundingClientRect())
      .filter((zone) => zone.width > 0);
    if (bouton && zones.every((zone) => zone.right < bouton.left - 8 || zone.left > bouton.right + 8)) return;
    boutonRetenu = true;
    positionDuGeste = null;
  }

  const TOUCHES_DE_DEFILEMENT = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

  function surGesteDuLecteur(event: Event) {
    if (!boutonRetenu || positionDuGeste !== null) return;
    if (event instanceof KeyboardEvent && !TOUCHES_DE_DEFILEMENT.has(event.key)) return;
    positionDuGeste = window.scrollY;
  }

  function surDefilementDuLecteur() {
    if (!boutonRetenu || positionDuGeste === null || Math.abs(window.scrollY - positionDuGeste) < 16) return;
    // Une image plus tard : ChatFab mesure le défilement à l'image suivante
    // (écouteur posé avant celui-ci), et connaît déjà le sens du geste.
    requestAnimationFrame(() => (boutonRetenu = false));
  }

  /**
   * Un article choisi dans le sommaire, ou par son lien direct dans le texte
   * entier. Le lien (`#art-N`) garde son comportement pour un clic du milieu
   * ou avec Ctrl (nouvel onglet) ; un clic simple change d'article sans
   * recharger. Au clavier (`detail` nul), le focus va au titre de l'article :
   * le lecteur d'écran l'annonce.
   */
  async function choisirDansLeSommaire(event: CustomEvent<{ rang: number; evenement: MouseEvent }>) {
    const { rang, evenement } = event.detail;
    if (evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) {
      return;
    }
    evenement.preventDefault();
    const auClavier = evenement.detail === 0;
    tocOuvert = false;
    onglet = "texte";
    if (mode === "texte") {
      await tick();
      retenirLeBouton();
      await texteEntier?.allerA(rang, { focus: auClavier });
      rangVisible = rang;
      const article = articles[rang];
      if (article) ecrireLAdresse("ajouter", ancreDeLArticle(article));
      return;
    }
    // L'article déjà lu : l'entrée est remplacée, comme pour l'adresse déjà
    // affichée (`ecrireLAdresse`). Arrivé par `#art-2`, un clic sur
    // l'article 2 du sommaire écrivait `?article=2` dans une nouvelle entrée,
    // et le retour arrière ne changeait rien à l'écran.
    const dejaLu = rang === rangCourant;
    feuilleter(rangCourant, rang);
    rangCourant = rang;
    ecrireLAdresse(dejaLu ? "remplacer" : "ajouter");
    await allerAuDebutDeLArticle();
    if (auClavier) titreDeLArticle?.focus({ preventScroll: true });
  }

  /** « Article par article | Texte entier » : on garde l'article lu d'un mode à l'autre. */
  async function changerDeMode(event: CustomEvent<Mode>) {
    // L'article est recréé d'une vue à l'autre : il ne doit pas glisser.
    feuillete = "";
    if (event.detail === "texte") {
      rangVisible = rangCourant;
      mode = "texte";
      ecrireLAdresse("remplacer");
      await tick();
      // Le premier article : rien à faire défiler, le texte commence ici.
      if (rangVisible > 0) {
        retenirLeBouton();
        await texteEntier?.allerA(rangVisible, { immediat: true });
      }
      return;
    }
    // Avant le premier article (-1, visas en cours de lecture) : l'article 1er.
    rangCourant = Math.max(0, rangVisible);
    mode = "article";
    ecrireLAdresse("remplacer");
    if (rangCourant > 0) await allerAuDebutDeLArticle(true);
  }

  // ---------------------------------------------------------------------------
  // Onglets « Texte » et « Historique (N) » (P1, étape 2)
  // ---------------------------------------------------------------------------

  async function ouvrirHistorique() {
    choisirOnglet("historique");
    await tick();
    document.getElementById("onglet-historique")?.focus();
  }

  const ONGLETS = ["texte", "historique"] as const;

  /**
   * L'onglet « Historique » a une adresse : `#historique`. La pastille des
   * listes (« Abrogé en partie par 11 textes · voir l'historique ») promet
   * l'historique, mais menait à l'onglet « Texte » : l'onglet n'était qu'un
   * état de la page (vérification r1 du 29/10/2026). Une ancre et non
   * `?onglet=` : jamais envoyée au serveur, elle ne touche pas la page en
   * cache (ISR) ; elle s'applique après l'hydratation, comme `?article=`.
   */
  const ANCRE_DE_L_HISTORIQUE = "#historique";

  function choisirOnglet(nom: (typeof ONGLETS)[number]) {
    onglet = nom;
    if (!monte) return;
    const url = new URL(window.location.href);
    // Retour au texte : seule l'ancre de l'historique s'efface, jamais celle
    // d'un article (`#art-53-2`).
    const voulue = nom === "historique" ? ANCRE_DE_L_HISTORIQUE : url.hash === ANCRE_DE_L_HISTORIQUE ? "" : url.hash;
    if (url.hash === voulue) return;
    url.hash = voulue;
    try {
      replaceState(`${url.pathname}${url.search}${url.hash}`, $page.state);
    } catch {
      // Routeur pas prêt : l'onglet change, l'adresse suivra au prochain choix.
    }
  }

  /** Onglets au clavier (motif ARIA) : flèches, Début, Fin ; un seul arrêt de tabulation. */
  function clavierDesOnglets(event: KeyboardEvent) {
    const index = ONGLETS.indexOf(onglet);
    let suivant: (typeof ONGLETS)[number] | null = null;
    if (event.key === "ArrowRight") suivant = ONGLETS[(index + 1) % ONGLETS.length];
    else if (event.key === "ArrowLeft") suivant = ONGLETS[(index + ONGLETS.length - 1) % ONGLETS.length];
    else if (event.key === "Home") suivant = ONGLETS[0];
    else if (event.key === "End") suivant = ONGLETS[ONGLETS.length - 1];
    if (!suivant) return;
    event.preventDefault();
    choisirOnglet(suivant);
    void tick().then(() => document.getElementById(`onglet-${suivant}`)?.focus());
  }

  // ---------------------------------------------------------------------------
  // Sommaire en panneau, sous `lg`
  // ---------------------------------------------------------------------------

  /**
   * Le MÊME élément sert de colonne sur grand écran et de panneau qui monte
   * du bas sur petit écran : une seule liste dans le DOM, donc un seul lien
   * par article pour les lecteurs d'écran et pour les tests.
   */
  let tocOuvert = false;

  /**
   * La liste d'un très long texte n'est pas dans le HTML du serveur. Le Code
   * civil a 2 041 articles reconnus : environ 700 Ko de balisage de plus dans
   * une page qui porte déjà son texte entier (1 Mo). Elle se construit dans le
   * navigateur, quand la colonne est visible ou le panneau ouvert. Un texte
   * ordinaire la garde au rendu serveur.
   */
  const SEUIL_DU_SOMMAIRE_AU_SERVEUR = 400;
  /**
   * Refonte A : fermé, le sommaire ne montre plus que la division de
   * l'article lu (colonne, ou puces sous `lg`) ; c'est elle qui compte pour
   * le seuil. Ouvert (« Tout le sommaire »), il se construit dans le
   * navigateur, comme avant. Les puces existent sous `lg` : la liste se
   * construit après le montage à toutes les largeurs.
   */
  $: articlesDeLaDivisionLue = decoupe.divisions[articles[Math.max(0, rangAffiche)]?.division ?? 0]?.articles.length ?? 0;
  $: sommaireRendu = monte || articlesDeLaDivisionLue <= SEUIL_DU_SOMMAIRE_AU_SERVEUR;

  /**
   * Le bouton qui a ouvert le sommaire, pour lui rendre le focus à la
   * fermeture. POURQUOI : `piegerFocus` le fait déjà, sauf quand ce bouton était masqué
   * pendant l'ouverture : « Tout le sommaire », dans la colonne, que la
   * feuille remplace.
   */
  let declencheurDuSommaire: HTMLElement | null = null;

  function ouvrirSommaire(event?: MouseEvent) {
    declencheurDuSommaire = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    tocOuvert = true;
  }

  function fermerSommaire() {
    tocOuvert = false;
    const declencheur = declencheurDuSommaire;
    declencheurDuSommaire = null;
    void tick().then(() => {
      const actif = document.activeElement as HTMLElement | null;
      const perdu = !actif || actif === document.body || actif.offsetParent === null;
      if (declencheur?.isConnected && declencheur.offsetParent !== null && perdu) declencheur.focus();
    });
  }

  // Un double appui sur « Sommaire » tombait, au second appui, sur le fond tout
  // juste affiché : le panneau s'ouvrait et se refermait aussitôt.
  function surLeFond(event: MouseEvent) {
    if (event.detail <= 1) fermerSommaire();
  }

  function surTouche(event: KeyboardEvent) {
    if (tocOuvert && event.key === "Escape") fermerSommaire();
  }

  /**
   * `piegerFocus`, armé seulement pendant que le sommaire est ouvert en
   * panneau : posé tel quel sur la colonne du grand écran, il volerait le
   * focus dès le chargement. Il s'arme sur l'article lu
   * (`aria-current="location"`) et rend, en se désarmant, le focus au bouton
   * « Sommaire ».
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
        if (voulu && !piege) piege = piegerFocus(noeud, { initial: '[aria-current="location"]' });
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
  // la boîte du profil (src/routes/+layout.svelte).
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

  $: verrouillerDefilement(tocOuvert);

  /**
   * La colonne du sommaire suit la lecture : l'article lu y reste visible
   * (Suivant, défilement du texte entier), sans faire défiler la page.
   * Rien quand la colonne est masquée (sous `lg`) : ses mesures sont nulles.
   */
  let listeDuSommaire: HTMLElement | undefined;
  $: garderLArticleLuVisible(rangAffiche);
  function garderLArticleLuVisible(_rang: number) {
    if (!monte || tocOuvert) return;
    void tick().then(() => {
      const zone = listeDuSommaire;
      const lien = zone?.querySelector<HTMLElement>('[aria-current="location"]');
      // Rien quand la liste ne défile pas en hauteur : les puces, sous `lg`,
      // défilent à l'horizontale (ListeDuSommaire s'en charge).
      if (!zone || !lien || zone.clientHeight === 0 || zone.scrollHeight <= zone.clientHeight) return;
      const cadre = zone.getBoundingClientRect();
      const boite = lien.getBoundingClientRect();
      // 48 px sous l'en-tête collé de la division, 32 px au-dessus du fondu.
      if (boite.top < cadre.top + 48 || boite.bottom > cadre.bottom - 32) {
        zone.scrollTop += boite.top - cadre.top - cadre.height / 3;
      }
    });
  }

  /**
   * Filtre du sommaire, appliqué 150 ms après la dernière frappe : le premier
   * passage sur le Code civil (2 041 articles) plie 1 Mo de texte.
   */
  let minuterieDuFiltre: ReturnType<typeof setTimeout> | undefined;
  $: programmerLeFiltre(saisieDuFiltre);
  function programmerLeFiltre(valeur: string) {
    clearTimeout(minuterieDuFiltre);
    if (!valeur.trim()) {
      filtre = "";
      return;
    }
    minuterieDuFiltre = setTimeout(() => (filtre = valeur), 150);
  }

  onDestroy(() => {
    verrouillerDefilement(false);
    clearTimeout(minuterieDuFiltre);
    clearTimeout(minuterieDeLAdoption);
  });

  onMount(() => {
    monte = true;
    // Passé à `lg` (tablette tournée, fenêtre agrandie), le panneau redevient
    // la colonne : le fermer retire le fond et rend le défilement.
    const requete = window.matchMedia("(min-width: 1024px)");
    // Refonte A : ouvert sur un ordinateur (« Tout le sommaire »), il passe
    // aussi de la feuille latérale au panneau du bas en sens inverse ; se
    // fermer, dans les deux sens, évite qu'une présentation hérite de l'autre.
    // POURQUOI LA VALEUR RETENUE : Chrome signale aussi un changement qui ne
    // change rien (une capture pleine page redimensionne un instant la vue),
    // et le sommaire se refermait sous le lecteur.
    let large = requete.matches;
    const surChangement = (event: MediaQueryListEvent) => {
      if (event.matches === large) return;
      large = event.matches;
      tocOuvert = false;
    };
    requete.addEventListener("change", surChangement);
    // Gestes du lecteur qui rendent la main au bouton de l'assistant.
    const gestes = ["wheel", "touchmove", "keydown"] as const;
    for (const geste of gestes) window.addEventListener(geste, surGesteDuLecteur, { passive: true, capture: true });
    window.addEventListener("scroll", surDefilementDuLecteur, { passive: true });
    return () => {
      requete.removeEventListener("change", surChangement);
      for (const geste of gestes) window.removeEventListener(geste, surGesteDuLecteur, { capture: true });
      window.removeEventListener("scroll", surDefilementDuLecteur);
    };
  });

  /**
   * L'adresse est appliquée ICI, après le montage et à chaque navigation :
   * `?article=94` (citation du chat, résultat de recherche) ou `#art-94`
   * ouvrent cet article, et la page y défile. Rien ne défile quand la page a
   * déjà une position (retour arrière, rechargement qui la restaure) : la
   * remplacer ferait perdre au lecteur l'endroit où il en était.
   */
  afterNavigate(({ from, to, type }) => {
    // Voir `revenir` : une page du site précède celle-ci.
    pagePrecedenteDuSite = from !== null;
    tocOuvert = false;
    feuillete = "";
    const url = to?.url ?? new URL(window.location.href);
    const demande = appliquerLaNavigation(url, lireEtat($page.state));
    // `#historique` (pastille des listes) : l'onglet, s'il existe. Ancienne
    // API, sans historique : le texte, sans erreur.
    if (url.hash === ANCRE_DE_L_HISTORIQUE && nombreHistorique > 0) onglet = "historique";
    if (type === "popstate" || window.scrollY > 0 || !demande) return;
    allerAuDebutDeLArticle(true);
  });

  // ---------------------------------------------------------------------------
  // Explication de l'article par le modèle
  //
  // La réponse s'affiche ICI, dans le bloc, et ne part pas vers /chat : le
  // lecteur garde l'article sous les yeux pendant qu'il lit l'explication.
  // ---------------------------------------------------------------------------

  let explication = "";
  let explicationEnCours = false;
  let explicationErreur = "";
  /**
   * Les passages de l'article à surligner (surlignage.ts), lus dans la
   * réponse de l'explication si l'API en donne un jour (PASSATION § 9, B3).
   * Aujourd'hui toujours vides (décision L2) : aucun surlignage, la note n'est
   * pas ancrée, la page s'affiche comme sans eux.
   */
  let passages: Passage[] = [];
  /** Jeton anti-course. Voir `reinitialiserExplication`. */
  let explicationJeton = 0;

  /**
   * Remet le bloc IA à zéro quand on change d'article ou de document : le
   * bloc ne se démonte pas d'un article à l'autre, et l'explication de
   * l'article 12 resterait sous le texte du 13. Le jeton couvre la réponse
   * qui arrive après un changement d'article : elle est jetée.
   */
  function reinitialiserExplication(_rang: number, _lawId: number | undefined) {
    explication = "";
    passages = [];
    explicationErreur = "";
    explicationEnCours = false;
    explicationJeton += 1;
  }

  $: reinitialiserExplication(rangCourant, law?.id);

  async function expliquerArticle() {
    if (!law || !articleCourant) return;

    const jeton = ++explicationJeton;
    explicationEnCours = true;
    explicationErreur = "";
    explication = "";
    passages = [];

    try {
      const reponse = await fetch(`${API_URL}/laws/${law.id}/explain-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: articleCourant.numero,
          language: langue,
          // Le texte de l'article, MOT POUR MOT (`extraitDeLArticle`), et non
          // les paragraphes affichés : il permet au serveur de répondre même
          // quand la base n'a pas de ligne pour ce numéro, s'il retrouve son
          // début dans le document. Sans les puces que l'affichage retire,
          // il ne l'y retrouvait plus.
          excerpt: extraitDeLArticle(articleCourant).slice(0, 12000),
        }),
      });

      // L'utilisateur a changé d'article pendant la génération : cette réponse
      // ne concerne plus ce qui est à l'écran.
      if (jeton !== explicationJeton) return;

      if (reponse.ok) {
        const donnees = await reponse.json();
        explication = donnees.explanation ?? "";
        if (!explication.trim()) explicationErreur = $tr("chat.errorServer");
        else passages = lirePassages(donnees.passages);
      } else if (reponse.status === 404) {
        explicationErreur = $tr("loi.ia.introuvable");
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

  // Lu par la navigation du bas et par le bouton du sommaire (sous `lg`).
  $: compteur = articles.length > 0 ? `${rangCourant + 1} / ${articles.length}` : "0 / 0";

  /** Le bouton « Sommaire » du fil d'Ariane : texte entier, sous `lg` (masqué au-delà). */
  $: sommaireDansLeFil = mode === "texte" && articles.length > 1 && onglet === "texte";

  /**
   * La bascule « Article par article | Texte entier » : plusieurs articles,
   * ou un seul avec une ouverture. La lecture article par article ne montre
   * jamais l'ouverture, où l'OCR laisse ce que le découpage n'a pas rangé
   * dans un article : sans bascule, l'arrêté d'avancement de 193 inspecteurs
   * (/laws/1797) ne montrait que son article 2, jamais le tableau des promus
   * (revue du 29/10/2026, 8 textes de la base de test). Seule la première
   * division a une ouverture (`decouperLeTexte`).
   */
  $: avecBascule = articles.length > 1 || (decoupe.divisions[0]?.introduction.length ?? 0) > 0;

  /**
   * « Décret n° 2021/745 · Article 1 » du fil d'Ariane sur téléphone. Le nom
   * reste seul dans son élément : tiré de l'intitulé quand l'acte n'a pas de
   * numéro (« Code civil applicable au Cameroun »), il est le texte du
   * document, que monochrome.spec.ts ne doit pas prendre pour du français
   * resté dans l'interface anglaise. Une expression : Svelte retirerait
   * l'espace écrite en bord d'élément.
   */
  const SEPARATEUR_DU_FIL = " · ";

  /**
   * Élément d'une ligne de méta (« 24 articles · Ajouté à JuriX le … »). Le
   * « · » est dessiné AVANT chaque élément, centré dans l'écart de 16 px qui
   * le sépare du précédent, et la ligne est décalée de cet écart (`-ml-4`)
   * dans un cadre qui coupe ce qui dépasse : en début de ligne, le point tombe
   * hors du cadre au lieu de rester seul en bout de ligne.
   */
  const ELEMENT_SEPARE =
    "relative ml-4 before:absolute before:-left-4 before:w-4 before:text-center before:text-zinc-400 before:content-['·'] dark:before:text-zinc-600";

  /**
   * « Précédent » et « Suivant » (maquette RefonteLecture, `.pnb`) : un
   * libellé et, en petit dessous, l'article voisin ; sans bordure, un fond au
   * survol, la flèche qui glisse de 4 px. 44 px de haut au doigt (52 avec le
   * voisin). Aux bornes, désactivé et non masqué : la place ne saute pas.
   */
  const BOUTON_VOISIN =
    "group inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-zinc-700 transition-colors enabled:hover:bg-zinc-100 enabled:hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-white sm:gap-3 sm:px-4";

  /** La flèche d'un voisin glisse au survol (A2 § 4), rien en mouvement réduit. */
  const FLECHE_DU_VOISIN = "shrink-0 text-lg ease-jx motion-safe:transition-transform motion-safe:duration-[350ms]";

  // ---------------------------------------------------------------------------
  // La note de l'IA calée sur son passage (refonte A, étape 7)
  // ---------------------------------------------------------------------------

  /**
   * Décalage du haut de la marge pour que le trait de la note tombe sur la
   * ligne du passage clé (`ancrerLaNote`), ou `null` : note non ancrée, en
   * haut de la marge, sans trait ni point. Toujours `null` au rendu serveur
   * et sans passage (la v1 : décision L2).
   */
  let decalageDeLaNote: number | null = null;
  /**
   * POURQUOI CE DRAPEAU.
   * La note n'arrive qu'une fois, au chargement (étape 10). Elle est recréée
   * au retour du texte entier, sans rien à annoncer : son entrée, en 0,9 s de
   * délai, l'y cacherait pour rien. Un article suivant ne la recrée pas.
   */
  let noteDejaEntree = false;
  $: if (mode === "texte") noteDejaEntree = true;

  /** Ce qui change la ligne du passage : l'article, ses passages. */
  $: cleDeLAncrage = `${law?.id}:${rangCourant}:${passages.map((passage) => passage.texte).join("|")}`;
  let rangeeDeLecture: HTMLElement | undefined;
  const passageCle = () => rangeeDeLecture?.querySelector<HTMLElement>("mark.passage-cle") ?? null;
</script>

<!--
  Le titre du document et un extrait de son texte sont présents dans le HTML
  rendu par le serveur, sans JavaScript. `type="article"` et non `website` :
  c'est un document daté et signé, pas une page de portail.
-->
<MetaSeo
  titre={law?.title || $tr("laws.title")}
  description={descriptionDepuis(law?.content)}
  canonique={urlCanonique($page.url)}
  type="article"
/>

<SiteHeader />

<svelte:window on:keydown={surTouche} on:popstate={surPopstate} on:hashchange={surHashchange} />

<!-- `min-h-app` (app.css) et non `min-h-screen min-h-dvh` : Tailwind écrit
     `.min-h-dvh` AVANT `.min-h-screen`, et la paire valait toujours 100vh. -->
<div class="page text-zinc-950 dark:text-zinc-100 bg-background-light dark:bg-background-dark min-h-app font-sans">
  <!--
    Fil d'Ariane, collé en haut pendant toute la lecture, jusqu'à l'article
    lu (P10) : Documents › domaine › Décret n° 2021/745 › Chapitre I ›
    Article 1. Sous `sm`, le retour et « Décret n° 2021/745 · Article 1 »
    seulement : sur deux ou trois lignes, il prenait 12 % d'un téléphone.

    z-40 et non z-50 : le panneau du menu mobile de l'en-tête (z-50) doit
    passer devant lui. `sm:court:` (téléphone en paysage) et non `court:`
    seul : Tailwind écrit les règles `court:` AVANT celles de `sm:`.

    Refonte A (décision L3) : le fil du dépôt est gardé (il porte
    « Article N », que les tests lisent), restylé : plus d'ombre, et la
    largeur du texte (1 320 px au plus) pour que le fil commence à l'aplomb
    du titre. Sa hauteur ne change pas : le sommaire reste collé à
    `lg:top-24`, et les marges de défilement (`scroll-mt-*`) la suivent.
  -->
  <div
    class="breadcrumb bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 py-1 sm:py-4 sm:court:py-1.5 px-0 sticky top-0 z-40"
  >
    <div class="mx-auto w-full max-w-[82.5rem] px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3">
      <nav
        aria-label={$tr("loi.fil_ariane")}
        class="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <!-- 44 px sous `sm`, où il n'est plus qu'une flèche : son nom passe
             par aria-label. Un lien vers la liste des documents, que
             `revenir` change en retour arrière quand on vient du site. -->
        <a
          href="/laws"
          class="-ml-3.5 inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors sm:ml-0 sm:mr-2 sm:h-auto sm:w-auto"
          on:click={revenir}
          aria-label={$tr("loi.retour")}
        >
          <Icone nom="arrow-left" class="w-4 h-4 shrink-0" />
          <span class="hidden sm:inline whitespace-nowrap">{$tr("loi.retour")}</span>
        </a>
        <span class="hidden sm:inline text-zinc-300 dark:text-zinc-700" aria-hidden="true">|</span>
        <a href="/laws" class="hidden sm:inline shrink-0 whitespace-nowrap hover:text-zinc-950 dark:hover:text-white transition-colors"
          >{$tr("nav.documents")}</a
        >
        <Icone nom="chevron-right" class="hidden sm:block w-4 h-4 shrink-0" />
        {#if law?.category_id}
          <!-- Largeur bornée, le nom entier en infobulle. Quand le bouton
               « Sommaire » occupe la droite du fil (texte entier, sous `lg`),
               le domaine cède sa place au nom du texte : il réduisait
               « Décret n° 2021/745 » à « Décret n… » à 768 px (vérification
               r1 du 29/10/2026). -->
          <a
            href="/categories/{law.category_id}"
            title={nomDeLaCategorie}
            class="hidden {sommaireDansLeFil
              ? 'lg:block'
              : 'sm:block'} min-w-0 max-w-[9rem] lg:max-w-[16rem] truncate hover:text-zinc-950 dark:hover:text-white transition-colors"
            >{nomDeLaCategorie}</a
          >
          <Icone nom="chevron-right" class="hidden {sommaireDansLeFil ? 'lg:block' : 'sm:block'} w-4 h-4 shrink-0" />
        {/if}
        {#if law && articleAffiche && onglet === "texte"}
          <!--
            QUI CÈDE LA PLACE. Un élément qui rétrécit se tronque, même d'un
            pixel : « Décret n° 2021/745 » devenait « Décret n… » à 768 px
            (vérification r1 du 29/10/2026). Le nom du texte et la chaîne des
            divisions ne rétrécissent donc pas : chacun a une largeur maximale,
            choisie pour que le fil tienne au pire (nom et chaîne à leur
            maximum, « Article 2041 ») et que le domaine, seul à rétrécir, y
            garde au moins son « … ». Seule exception, le texte entier sous
            `lg` : le domaine y laisse sa place au bouton « Sommaire », et la
            chaîne rétrécit à son tour.
          -->
          <a
            href="/laws/{law.id}"
            title={law.title}
            class="hidden sm:block sm:shrink-0 max-w-[9rem] md:max-w-[10rem] lg:max-w-[16rem] truncate hover:text-zinc-950 dark:hover:text-white transition-colors"
            >{nomCourt}</a
          >
          <Icone nom="chevron-right" class="hidden sm:block w-4 h-4 shrink-0" />
          {#if chaineDuFil}
            <!-- TOUTE la chaîne (« Titre II · Chapitre 1 »), comme le sommaire
                 et le surtitre de l'article, en un seul élément : un texte va
                 jusqu'à cinq niveaux (« Titre II · Chapitre II · Section III ·
                 Sous-section I · Paragraphe III »), qu'un fil de 768 px ne
                 peut pas montrer en entier. Tronquée, elle reste entière en
                 infobulle, et le surtitre de l'article la donne. -->
            <span
              class="hidden md:block {sommaireDansLeFil
                ? 'min-w-0 lg:shrink-0'
                : 'shrink-0'} max-w-[10rem] lg:max-w-[16rem] xl:max-w-[24rem] truncate"
              title={chaineDuFil}
              data-testid="law-breadcrumb-divisions">{chaineDuFil}</span
            >
            <Icone nom="chevron-right" class="hidden md:block w-4 h-4 shrink-0" />
          {/if}
          <span class="min-w-0 truncate font-medium text-zinc-950 dark:text-white sm:shrink-0" aria-current="location"
            ><span class="sm:hidden"><span>{nomCourt}</span>{SEPARATEUR_DU_FIL}</span>{$tr("loi.article")}
            {articleAffiche.numero}{#if langue === "fr" && articleAffiche.numero === "1"}<sup>er</sup>{/if}</span
          >
        {:else}
          <span class="min-w-0 truncate font-medium text-zinc-950 dark:text-white sm:max-w-[400px]" aria-current="page"
            >{nomCourt}</span
          >
        {/if}
      </nav>
      {#if sommaireDansLeFil}
        <!-- En texte entier, plus de barre Précédent / Suivant : le sommaire
             s'ouvre d'ici, toujours à portée pendant la lecture.
             44 px au doigt, mais SANS grandir le bandeau : à partir de `sm`,
             la ligne du fil n'a que la hauteur du texte (20 px), et le bouton
             l'aurait portée à 44, soit 76 px de bandeau au lieu de 52 au
             passage en texte entier, 24 px de lecture perdus tout du long
             (vérification r2 du 29/10/2026). Les marges négatives (`-my-3`)
             le font déborder dans la marge du bandeau : 16 px, assez pour
             lui ; 6 px en paysage sur téléphone, où il dépasse un peu, sans
             fond hors survol. Sous `sm`, le lien « Retour » fait déjà 44 px :
             rien à reprendre. -->
        <button
          type="button"
          class="-mr-2 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors sm:-my-3 lg:hidden"
          on:click={ouvrirSommaire}
          aria-haspopup="dialog"
          aria-expanded={tocOuvert}
          aria-controls="sommaire"
          data-testid="law-toc-toggle-texte"
        >
          <Icone nom="table-of-contents" class="text-xl" />
          <span class="max-[359px]:sr-only">{$tr("loi.sommaire.ouvrir")}</span>
        </button>
      {/if}
    </div>
  </div>

  {#if error}
    <!-- data-testid conservé : la panne (backend éteint ou 5xx). Un
         identifiant inexistant répond 404 et n'arrive jamais ici. -->
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
        <a
          href="/"
          class="font-medium text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white"
          >{$tr("loi.erreur.accueil")}</a
        >
      </div>
    </div>
  {:else if law}
    <!-- Marges de l'en-tête (16, 24 puis 48 px), comme le fil d'Ariane, et
         1 320 px au plus (maquette RefonteLecture). -->
    <div class="main-content pb-12 pt-5 sm:pb-16 sm:pt-8">
      <div class="mx-auto w-full max-w-[82.5rem] px-4 sm:px-6 lg:px-12">
        <!--
          POURQUOI PLUS DE CARTE BLANCHE (refonte A, maquette RefonteLecture).
          Le texte est posé sur le fond de la page : l'en-tête du document, un filet,
          puis la grille « sommaire | lecture ». `main#contenu` porte le tout et
          garde son `id` (lien d'évitement de l'en-tête).

          POURQUOI `data-hors-du-bouton` A CHANGÉ DE PLACE. Le bouton de
          l'assistant se retire quand une zone marquée
          `data-hors-du-bouton` passe sous lui (ChatFab). Ce n'est plus `main`,
          désormais de toute la largeur : entre 1 280 et 1 440 px, le bouton
          aurait disparu sur toute la page. Ce sont l'en-tête du texte, le
          sommaire, la colonne de lecture et la note (et, en texte entier ou
          dans l'historique, toute la colonne) : il reste affiché à droite
          d'un écran large, et se retire quand le texte ou la note passent
          dessous.
        -->
        <main id="contenu" class="content relative min-w-0">
          <div class="document-header" data-hors-du-bouton>
            <!-- Le type du texte, traduit et avec son icône ($lib/type-de-texte),
                 puis sa date : « Signé le 28 décembre 2021 ». La cote interne
                 (« PRC-9153 ») n'est plus affichée (P2) : elle ne dit rien au
                 lecteur. Au second plan, au-dessus du titre (décision L1). -->
            <div class="document-meta mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span class={classesBadgeDeType(typeDuTexte)}>
                <Icone nom={typeDuTexte.icone} class="text-sm" />
                {$tr(typeDuTexte.cle)}
              </span>
              {#if libelleDate}
                <span class="text-sm tabular-nums text-zinc-500 dark:text-zinc-400" data-testid="law-date">{libelleDate}</span>
              {/if}
            </div>
            <!-- Literata 600 (Q5), lignes équilibrées, 900 px au plus
                 (maquette) ; taille et interligne de 1,2 selon la longueur
                 (`tailleDuTitre`). Le titre du corpus TEL QUEL (décision L6).
                 Jamais d'interlettrage serré sur cette serif. -->
            <h1
              class="{classeTitre} {POLICE_DES_TITRES} max-w-[56.25rem] text-balance text-zinc-950 dark:text-white coupe-mots"
              lang={langueDuTexte}
            >
              {law.title}
            </h1>
            <!-- La ligne de statut (pastille tamponnée). POURQUOI `overflow-x:
                 clip`, avec 8 px de marge (`-mx-2 px-2`) pour les contours de focus :
                 l'onde du tampon grandit de moitié en s'effaçant, et ne doit
                 jamais faire défiler la page à l'horizontale sur un
                 téléphone. `clip` et non `hidden` : rien ne défile ici. -->
            <div class="-mx-2 mt-5 overflow-x-clip px-2">
              <StatutDuTexte {statut} {lienSignaler} />
            </div>
            <!--
              Au second plan (décision L1) : le nombre d'articles et le jour
              d'ajout, puis Partager, Télécharger et Document original, en
              boutons bordés discrets : le seul bouton plein de la page est
              « Expliquer l'article » (maquette). Trois actions sur UNE rangée
              dès 320 px (P10), libellés courts sur téléphone.
            -->
            <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
              <div class="document-info overflow-hidden text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                <div class="-ml-4 flex flex-wrap items-center gap-y-1">
                  <span class={ELEMENT_SEPARE}>{libelleNombre}</span>
                  {#if ajout}
                    <span class={ELEMENT_SEPARE} data-testid="law-added"
                      >{$tr("loi.ajoute_le").replace("{date}", formatDate(ajout, langue))}</span
                    >
                  {/if}
                </div>
              </div>
              <div
                class="document-actions grid {law.file_id ? 'grid-cols-3' : 'grid-cols-2'} gap-2 sm:flex sm:flex-wrap"
              >
                <LienDePartage partage={partageDuTexte} etiquette={$tr("loi.partage.texte")} testid="law-share">
                  {$tr("loi.partager")}
                </LienDePartage>
                {#if law.file_id}
                  <!-- Téléchargement du document D'ORIGINE, servi par l'API.
                       `download` nu : le nom proposé est celui que l'API
                       annonce, construit sur le titre du document. -->
                  <a class={BOUTON_SECONDAIRE} href={`${API_URL}/laws/${law.id}/download`} download>
                    <Icone nom="download" class="h-5 w-5 shrink-0" />
                    <span class="sm:hidden">{$tr("loi.telecharger_court")}</span>
                    <span class="hidden sm:inline">{$tr("loi.telecharger")}</span>
                  </a>
                {:else}
                  <!-- Texte créé sans téléversement : l'adresse répondrait 404.
                       Bouton désactivé et expliqué, plutôt que masqué. -->
                  <button
                    type="button"
                    class="{BOUTON_SECONDAIRE} disabled:cursor-not-allowed disabled:opacity-50"
                    disabled
                    title={$tr("loi.fichier_absent")}
                  >
                    <Icone nom="download" class="h-5 w-5 shrink-0" />
                    <span class="sm:hidden">{$tr("loi.telecharger_court")}</span>
                    <span class="hidden sm:inline">{$tr("loi.telecharger")}</span>
                  </button>
                {/if}
                {#if law.file_id}
                  <!-- `file-image` : la visionneuse montre les pages d'origine
                       en images ; `file-down` aurait dit « télécharger ». -->
                  <button
                    type="button"
                    on:click={() => (afficherDocument = !afficherDocument)}
                    data-testid="law-toggle-document"
                    class="{BOUTON_SECONDAIRE} {afficherDocument
                      ? '!border-zinc-950 !bg-zinc-950 !text-white dark:!border-white dark:!bg-white dark:!text-zinc-950'
                      : ''}"
                  >
                    <Icone nom="file-image" class="shrink-0 text-lg" />
                    <span class="sm:hidden"
                      >{afficherDocument ? $tr("loi.document.texte_court") : $tr("loi.document.original_court")}</span
                    >
                    <span class="hidden sm:inline"
                      >{afficherDocument ? $tr("loi.document.revenir") : $tr("loi.document.original")}</span
                    >
                  </button>
                {/if}
              </div>
            </div>
          </div>

          {#if afficherDocument && law.file_id}
            <!-- Bord à bord sur téléphone (`-mx-4` annule la marge de la
                 page) : 32 px de plus pour la page du PDF. -->
            <div
              class="-mx-4 mt-6 overflow-hidden border-y border-zinc-200 dark:border-zinc-800 sm:mx-0 sm:rounded-xl sm:border"
              data-testid="law-document-viewer"
              data-hors-du-bouton
            >
              <!-- Recréée pour chaque document : la visionneuse ne lit son
                   adresse qu'au montage. Elle suit ensuite l'article lu. -->
              {#key law.id}
                <ImagePdfViewer url={`${API_URL}/laws/${law.id}/download`} initialPage={pageDuDocument} />
              {/key}
            </div>
          {/if}

          <!--
            LA GRILLE (maquette) : sous un filet, le sommaire de 200 px et la
            colonne de lecture, à partir de `lg`. `minmax(0, 1fr)` et non `1fr` :
            un mot insécable élargissait la colonne de lecture au-delà de
            l'écran. La colonne de lecture est placée en deuxième colonne
            (`lg:col-start-2`) : ouvert en feuille, le sommaire sort de la
            grille, et elle ne doit pas glisser à sa place derrière le voile.
          -->
          <div
            class="layout mt-8 grid grid-cols-1 gap-5 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:mt-12 sm:pt-9 {articles.length >
            0
              ? 'lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12'
              : ''}"
          >
            {#if articles.length > 0}
              {#if tocOuvert}
                <!-- Fond du sommaire ouvert. Au-dessus du fil d'Ariane (z-40),
                     sous la boîte du profil (z-[60]). -->
                <div
                  class="fond-sommaire fixed inset-0 z-[55] bg-zinc-950/40 backdrop-blur-sm"
                  role="presentation"
                  on:click={surLeFond}
                ></div>
              {/if}
              <!--
                POURQUOI UN SEUL #sommaire, POUR TROIS PRÉSENTATIONS (décision L4). Fermé : la
                division de l'article lu, en colonne collante de 200 px à partir
                de `lg` (titre, « Tout le sommaire », lignes de 40 px et repère
                qui glisse), en rangée de puces de 44 px en dessous. Ouvert
                (« Tout le sommaire », ou le bouton « Sommaire » sous
                `lg`) : le sommaire COMPLET, filtre compris, dans une fenêtre
                modale (panneau qui monte du bas sous `lg`, feuille à gauche au-
                delà), focus piégé, Échap, défilement verrouillé. Un seul
                élément : un lien par article pour les lecteurs d'écran et pour
                les tests.

                POURQUOI UNE ENVELOPPE. Sous `lg`, une rangée : les puces, et à leur droite
                le bouton « Sommaire » et son compteur (`law-toc-toggle`), hors
                du panneau qu'il ouvre : il garde la place de la rangée pendant
                l'ouverture, et `piegerFocus` lui rend le focus. Il était dans
                la barre Précédent / Suivant du haut, retirée (maquette). Pas
                dans le fil d'Ariane : il y aurait pris la place du domaine
                entre `sm` et `lg`. À partir de `lg` (`contents`), l'enveloppe
                n'existe plus : le sommaire est l'élément de la grille, seul à
                pouvoir rester collé. Elle garde sa hauteur quand le sommaire
                passe en panneau, pour que le texte ne remonte pas derrière le
                voile. Un texte d'un seul article n'a ni puce ni rangée : son
                sommaire s'ouvre depuis la navigation du bas, comme avant.
              -->
              <div class="flex min-w-0 items-center gap-2 lg:contents {articles.length > 1 ? 'min-h-11' : ''}">
                <div
                  id="sommaire"
                  data-testid="law-toc"
                  class="sidebar sommaire min-w-0 flex-1 {tocOuvert
                    ? 'fixed inset-x-0 bottom-0 z-[56] flex flex-col rounded-t-2xl border-t border-zinc-200 bg-white pb-zone-sure px-zone-sure shadow-xl dark:border-zinc-800 dark:bg-zinc-900 lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-[26rem] lg:rounded-none lg:rounded-r-2xl lg:border-r lg:border-t-0'
                    : `${articles.length > 1 ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:flex lg:h-fit lg:flex-col lg:self-start`}"
                  class:ouvert={tocOuvert}
                  role={tocOuvert ? "dialog" : undefined}
                  aria-modal={tocOuvert ? "true" : undefined}
                  aria-labelledby={tocOuvert ? "sommaire-titre" : undefined}
                  data-hors-du-bouton
                  use:piegerSiOuvert={tocOuvert}
                >
                  <div
                    class="sidebar-header shrink-0 items-center justify-between gap-3 {tocOuvert
                      ? 'flex px-4 pt-2 lg:mb-4 lg:px-6 lg:pt-6'
                      : 'mb-1 hidden lg:flex'}"
                  >
                    <h2
                      id="sommaire-titre"
                      class="font-bold text-zinc-950 dark:text-white {tocOuvert ? 'text-lg' : 'text-[13px] leading-[18px]'}"
                    >
                      {$tr("loi.sommaire.titre")}
                    </h2>
                    {#if tocOuvert}
                      <button
                        type="button"
                        class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        on:click={fermerSommaire}
                        aria-label={$tr("common.close")}
                        data-testid="law-toc-close"
                      >
                        <Icone nom="x" class="text-2xl" />
                      </button>
                    {/if}
                  </div>

                  {#if articles.length > 1}
                    <!-- Le sommaire complet, depuis la colonne (la maquette n'y a
                         que la division lue). Masqué, et non retiré, pendant
                         l'ouverture : le focus lui revient à la fermeture
                         (`fermerSommaire`). -->
                    <button
                      type="button"
                      class="mb-2 min-h-11 items-center gap-2 self-start rounded-lg text-sm text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white lg:[@media(pointer:fine)]:min-h-9 {tocOuvert
                        ? 'hidden'
                        : 'hidden lg:inline-flex'}"
                      on:click={ouvrirSommaire}
                      aria-haspopup="dialog"
                      aria-expanded={tocOuvert}
                      aria-controls="sommaire"
                      data-testid="law-toc-tout"
                    >
                      <Icone nom="table-of-contents" class="shrink-0 text-base" />
                      {$tr("loi.sommaire.tout")}
                    </button>
                  {/if}

                  {#if tocOuvert}
                    <!-- Le cadre dessine le champ et son focus (recette des
                         champs du site) ; le champ lui-même reste transparent.
                         16 px sous `lg`, là où il vit dans le panneau tactile :
                         en dessous, iOS zoome sur la page au focus. -->
                    <div
                      class="search-box mx-4 mb-3 mt-1 flex min-h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 pl-4 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:focus-within:border-zinc-200 dark:focus-within:ring-zinc-200 lg:mx-6 lg:mb-6 lg:mt-0"
                    >
                      <Icone nom="search" class="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                      <input
                        type="text"
                        class="w-full min-w-0 self-stretch border-none bg-transparent py-2.5 pl-3 pr-4 text-base text-zinc-950 placeholder-zinc-400 outline-none focus:ring-0 dark:text-zinc-100 dark:placeholder-zinc-500 lg:text-sm"
                        placeholder={$tr("loi.sommaire.filtre")}
                        bind:value={saisieDuFiltre}
                        aria-label={$tr("loi.sommaire.filtre")}
                      />
                    </div>
                  {/if}

                  <nav
                    bind:this={listeDuSommaire}
                    class="toc min-h-0 {tocOuvert
                      ? 'space-y-5 overflow-y-auto overscroll-contain px-4 pb-12 lg:px-6'
                      : 'lg:overflow-y-auto lg:overscroll-contain lg:pb-12'}"
                    aria-labelledby="sommaire-titre"
                  >
                    {#if sommaireRendu}
                      <ListeDuSommaire
                        {decoupe}
                        rangCourant={rangAffiche}
                        {marques}
                        filtre={tocOuvert ? filtre : ""}
                        {langueDuTexte}
                        variante={tocOuvert ? "feuille" : "colonne"}
                        on:choisir={choisirDansLeSommaire}
                      />
                    {/if}
                  </nav>
                </div>
                {#if mode === "article" && articles.length > 1}
                  <button
                    type="button"
                    class="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white lg:hidden"
                    on:click={ouvrirSommaire}
                    aria-haspopup="dialog"
                    aria-expanded={tocOuvert}
                    aria-controls="sommaire"
                    data-testid="law-toc-toggle"
                  >
                    <Icone nom="table-of-contents" class="text-xl" />
                    <span class="flex flex-col items-start leading-tight">
                      <span class="text-sm font-semibold max-[359px]:sr-only">{$tr("loi.sommaire.ouvrir")}</span>
                      <span class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{compteur}</span>
                    </span>
                  </button>
                {/if}
              </div>
            {/if}

            <!-- `min-w-0` : élément de grille, il ne doit pas s'élargir sur
                 son contenu le plus large. -->
            <div
              class="min-w-0 {articles.length > 0 ? 'lg:col-start-2' : ''}"
              data-hors-du-bouton={mode === "texte" || articles.length === 0 || onglet === "historique"
                ? ""
                : undefined}
            >
              {#if nombreHistorique > 0}
                <!-- « Texte | Historique (N) » (P1, étape 2), l'onglet actif
                     marqué par une barre. Motif d'onglets ARIA : un seul arrêt
                     de tabulation, flèches pour passer de l'un à l'autre. Au
                     second plan (L1), au-dessus du texte. -->
                <div
                  class="mb-6 flex gap-6 border-b border-zinc-200 text-sm dark:border-zinc-800"
                  role="tablist"
                  aria-label={$tr("loi.onglets")}
                  data-hors-du-bouton
                >
                  {#each ONGLETS as nom (nom)}
                    {@const actif = onglet === nom}
                    <button
                      type="button"
                      role="tab"
                      id="onglet-{nom}"
                      aria-selected={actif}
                      aria-controls="panneau-{nom}"
                      tabindex={actif ? 0 : -1}
                      data-testid="law-tab-{nom}"
                      class="-mb-px inline-flex min-h-11 items-center border-b-2 transition-colors {actif
                        ? 'border-zinc-950 font-semibold text-zinc-950 dark:border-white dark:text-white'
                        : 'border-transparent text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}"
                      on:click={() => choisirOnglet(nom)}
                      on:keydown={clavierDesOnglets}
                    >
                      {nom === "texte"
                        ? $tr("loi.onglet.texte")
                        : $tr("loi.onglet.historique").replace("{n}", String(nombreHistorique))}
                    </button>
                  {/each}
                </div>
              {/if}

              <div
                id="panneau-texte"
                role={nombreHistorique > 0 ? "tabpanel" : undefined}
                aria-labelledby={nombreHistorique > 0 ? "onglet-texte" : undefined}
                hidden={onglet !== "texte"}
              >
                {#if articles.length === 0}
                  <!-- Aucun article reconnu : le texte tel qu'il est, divisions
                       et paragraphes, sans rien en perdre. Sans division non
                       plus, tout le texte est dans l'ouverture : dépliée, ou la
                       page n'en montrait que le résumé (14 textes de la base de
                       test le 29/10/2026, des circulaires budgétaires surtout,
                       et l'arrêté 8448/CAB/PR, /laws/193). -->
                  {#if decoupe.divisions.length > 0}
                    {#key law.id}
                      <TexteEntier
                        {decoupe}
                        {changements}
                        {consolide}
                        {langueDuTexte}
                        deplierLOuverture={!decoupe.structure}
                      />
                    {/key}
                  {:else}
                    <p class="py-12 text-center text-zinc-500 dark:text-zinc-400">{$tr("loi.texte_indisponible")}</p>
                  {/if}
                {:else}
                  {#if avecBascule}
                    <!--
                      « Article par article | Texte entier » (P10), au second
                      plan (L1) : une ligne au-dessus du texte, que la maquette
                      ne dessine pas ; en texte entier, « 24 articles · 7
                      chapitres » à droite. Plus de barre Précédent / Suivant
                      ici : la navigation est en bas de l'article (maquette).
                    -->
                    <div
                      class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                      data-hors-du-bouton
                    >
                      <BasculeDeLecture {mode} on:change={changerDeMode} />
                      {#if mode === "texte"}
                        <p class="hidden text-sm tabular-nums text-zinc-500 dark:text-zinc-400 sm:block">{resumeDuTexte}</p>
                      {/if}
                    </div>
                  {/if}

                  {#if articleIntrouvable}
                    <!-- Même aplat que l'ancien encadré du statut (P1) : une
                         information sur le texte, pas une erreur. -->
                    <p
                      role="status"
                      data-testid="article-introuvable"
                      class="mb-4 flex items-start gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 sm:mb-6"
                    >
                      <Icone nom="circle-alert" class="mt-0.5 shrink-0" />
                      <span class="min-w-0">{avisArticleIntrouvable}</span>
                    </p>
                  {/if}

                  {#if mode === "texte"}
                    {#key law.id}
                      <!-- Le lien direct d'un article (`choisir`) saute comme le
                           sommaire : une entrée d'historique que la page connaît.
                           L'article demandé introuvable, l'ouverture se déplie :
                           il y est souvent, faute d'avoir été lu par l'OCR. Pour
                           un texte d'un seul article aussi : elle est tout ce que
                           la lecture article par article ne montre pas. -->
                      <TexteEntier
                        bind:this={texteEntier}
                        {decoupe}
                        {changements}
                        historique={nombreHistorique > 0}
                        {consolide}
                        {langueDuTexte}
                        deplierLOuverture={articleIntrouvable !== null || articles.length === 1}
                        on:courant={(event) => (rangVisible = event.detail)}
                        on:historique={ouvrirHistorique}
                        on:choisir={choisirDansLeSommaire}
                      />
                    {/key}
                  {:else if articleCourant}
                    {@const intitule = intituleDeLArticle(articleCourant)}
                    {@const chaine = divisionCourante ? nommerLaChaine(divisionCourante.ancetres, $tr) : ""}
                    {@const intituleDeDivision = divisionCourante ? (enTetePrincipal(divisionCourante)?.intitule ?? "") : ""}
                    <!--
                      LA RANGÉE « TEXTE | NOTE » : la note de l'IA dans une marge
                      de 280 px à partir de 1 280 px, sous le texte en dessous.
                      Le texte ne bouge jamais à cause de la note : colonne de
                      280 px fixe, alignée en haut, la lecture en `minmax(0,1fr)`.
                      `ancrerLaNote` cale le haut de la marge sur le passage clé,
                      quand il y en a un (aucun en v1 : décision L2).
                    -->
                    <div
                      bind:this={rangeeDeLecture}
                      class="rangee grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start xl:gap-x-14"
                      use:ancrerLaNote={{
                        cible: passageCle,
                        surMesure: (decalage) => (decalageDeLaNote = decalage),
                        cle: cleDeLAncrage,
                      }}
                    >
                      <!--
                        POURQUOI `overflow-x: clip` SUR LA COLONNE DE LECTURE. Le
                        feuilletage fait glisser l'article de 36 px, et la page
                        ne doit jamais défiler à l'horizontale (320 px compris).
                        `clip` et non `hidden`, qui ferait de la colonne un
                        conteneur de défilement ; et sur la colonne, jamais sur
                        un ancêtre du sommaire collant (PASSATION § 8, piège 8).
                        8 px de marge (`-mx-2 px-2`) : les contours de focus
                        des boutons, au bord, ne sont pas rognés.
                      -->
                      <div class="lecture -mx-2 min-w-0 overflow-x-clip px-2" data-hors-du-bouton>
                        <article class="article" id={ancreDeLArticle(articleCourant)} aria-labelledby="titre-article">
                          <!-- Ce qui glisse d'un article à l'autre (`feuillete`) :
                               le surtitre, « Article N » et le texte ; ni les
                               actions, ni la navigation, ni la note. Cible du
                               défilement à chaque changement d'article :
                               `scroll-mt-*` suit la hauteur du fil d'Ariane
                               collant (53 px, 33 en paysage sur téléphone). -->
                          <div
                            bind:this={debutArticle}
                            class="feuille scroll-mt-16 sm:scroll-mt-[4.5rem] sm:court:scroll-mt-14 {feuillete}"
                          >
                            <div class="article-header mb-5">
                              {#if chaine}
                                <!-- La division de l'article, toute sa chaîne
                                     (« Titre II · Chapitre 1 », `nommerLaChaine`)
                                     en surtitre Inter (Q5 : deux voix au plus),
                                     puis son intitulé, mot pour mot. -->
                                <p class="mb-1 text-[13px] leading-[18px] text-zinc-500 dark:text-zinc-400">{chaine}</p>
                                {#if intituleDeDivision}
                                  <p
                                    class="mb-2 line-clamp-2 text-[13px] leading-[18px] text-zinc-500 coupe-mots dark:text-zinc-400"
                                    title={intituleDeDivision}
                                    lang={langueDuTexte}
                                  >
                                    {intituleDeDivision}
                                  </p>
                                {/if}
                              {/if}
                              <!-- Literata 600 (Q5), 32 px au plus et jamais plus
                                   grand que le titre (`tailleDeLArticle`).
                                   Focusable par le script seulement : choix d'un
                                   article au clavier. -->
                              <h2
                                id="titre-article"
                                bind:this={titreDeLArticle}
                                tabindex="-1"
                                class="{classeDeLArticle} {POLICE_DES_TITRES} text-zinc-950 dark:text-white"
                              >
                                {$tr("loi.article")}
                                {articleCourant.numero}{#if langue === "fr" && articleCourant.numero === "1"}<sup>er</sup>{/if}
                              </h2>
                            </div>

                            <!-- Un vrai intitulé (« Imputabilité ») ; une première
                                 ligne qui porte le texte passe dans le corps. -->
                            {#if intitule}
                              <h3
                                class="mb-6 text-lg font-semibold text-zinc-800 coupe-mots dark:text-zinc-200 sm:text-xl"
                                lang={langueDuTexte}
                              >
                                {intitule}
                              </h3>
                            {/if}

                            <StatutDeLArticle
                              changements={changements.get(rangCourant)}
                              historique={nombreHistorique > 0}
                              {consolide}
                              on:historique={ouvrirHistorique}
                            />

                            <!--
                              Texte officiel en Literata texte (Q5), 17 px sur
                              téléphone, 19 au-dessus, interligne de 1,8, couleur
                              pleine, 34 em au plus (maquette : 646 px en 19 px).
                              Les passages surlignés sont des NŒUDS (`segmenter`,
                              surlignage.ts : <mark> ou texte), jamais du HTML ;
                              sans passage, le paragraphe tel quel (L2).
                            -->
                            <div
                              class="article-content max-w-[34em] space-y-4 text-[17px] leading-[1.8] text-zinc-950 coupe-mots dark:text-zinc-100 sm:space-y-5 sm:text-[19px] {POLICE_DU_TEXTE_OFFICIEL}"
                              lang={langueDuTexte}
                            >
                              {#each paragraphesDeLArticle(articleCourant) as paragraphe, i (i)}
                                <p>{#each segmenter(paragraphe, passages) as segment, rang (rang)}{#if segment.passage}<mark class="passage mv-surligne mv-surligner" class:passage-cle={segment.passage.role === "cle"} style="--d: {segment.passage.role === 'cle' ? 0 : 150}ms">{segment.texte}</mark>{:else}{segment.texte}{/if}{/each}</p>
                              {/each}
                            </div>
                          </div>

                          <!-- « Copier la référence », « Copier le lien », puis
                               « Copier le texte » au second plan, et la mention
                               « Seul le texte publié au Journal officiel fait
                               foi » (ActionsDeLArticle). -->
                          <div class="mt-7">
                            <ActionsDeLArticle
                              reference={referenceACopierIci}
                              texte={texteACopierIci}
                              lien={urlArticle}
                              partage={partageDeLArticle}
                            />
                          </div>
                        </article>

                        <!--
                          « Précédent » et « Suivant », avec le voisin en petit
                          (maquette), sous un filet. Une seule navigation, en
                          bas : la barre du haut est retirée. Au milieu (L1), le
                          compteur « 3 / 24 » ; sous `lg`, où la colonne du
                          sommaire n'existe pas, c'est le bouton qui l'ouvre
                          (`law-toc-toggle-bas`) : au bas d'un long article, les
                          puces sont loin. Sous `sm`, son icône seule : trois
                          cibles tiennent ainsi sur une rangée dès 320 px.
                          Classe `article-navigation` gardée, et « Suivant »
                          DERNIER bouton : les tests le prennent par
                          `.article-navigation button` puis `.last()`.
                        -->
                        <nav
                          class="article-navigation mt-9 flex items-center justify-between gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800"
                          aria-label={$tr("loi.navigation.voisins")}
                        >
                          <button
                            type="button"
                            class="{BOUTON_VOISIN} text-left"
                            on:click={navigateToPrevious}
                            disabled={rangCourant === 0}
                          >
                            <Icone
                              nom="arrow-left"
                              class="{FLECHE_DU_VOISIN} motion-safe:group-enabled:group-hover:-translate-x-1"
                            />
                            <span class="flex min-w-0 flex-col items-start">
                              <span>{$tr("loi.precedent")}</span>
                              {#if articlePrecedent}
                                <span class="max-w-full truncate text-xs font-normal text-zinc-500 dark:text-zinc-400"
                                  >{$tr("loi.article")} {numeroDArticleEcrit(articlePrecedent.numero, langue)}</span
                                >
                              {/if}
                            </span>
                          </button>
                          <button
                            type="button"
                            class="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white sm:px-3 lg:hidden"
                            on:click={ouvrirSommaire}
                            aria-haspopup="dialog"
                            aria-expanded={tocOuvert}
                            aria-controls="sommaire"
                            data-testid="law-toc-toggle-bas"
                          >
                            <Icone nom="table-of-contents" class="text-xl" />
                            <span class="sr-only">{$tr("loi.sommaire.ouvrir")}</span>
                            <span class="hidden text-xs tabular-nums text-zinc-500 dark:text-zinc-400 sm:inline">{compteur}</span>
                          </button>
                          <p class="hidden text-sm tabular-nums text-zinc-500 dark:text-zinc-400 lg:block">{compteur}</p>
                          <button
                            type="button"
                            class="{BOUTON_VOISIN} text-right"
                            on:click={navigateToNext}
                            disabled={rangCourant >= articles.length - 1}
                          >
                            <span class="flex min-w-0 flex-col items-end">
                              <span>{$tr("loi.suivant")}</span>
                              {#if articleSuivant}
                                <span class="max-w-full truncate text-xs font-normal text-zinc-500 dark:text-zinc-400"
                                  >{$tr("loi.article")} {numeroDArticleEcrit(articleSuivant.numero, langue)}</span
                                >
                              {/if}
                            </span>
                            <Icone
                              nom="arrow-right"
                              class="{FLECHE_DU_VOISIN} motion-safe:group-enabled:group-hover:translate-x-1"
                            />
                          </button>
                        </nav>
                      </div>

                      <!-- La marge de la note. En haut de la marge sans passage
                           (rendu serveur compris) ; calée sur le passage clé
                           sinon (`decalageDeLaNote`, à partir de 1 280 px). -->
                      <aside
                        class="rail pt-8 xl:pt-0"
                        aria-label={$tr("loi.ia.titre")}
                        style={decalageDeLaNote !== null ? `padding-top: ${decalageDeLaNote}px` : undefined}
                      >
                        <div class="max-w-[34em] xl:max-w-none">
                          <NoteDeLIA
                            {explication}
                            enCours={explicationEnCours}
                            erreur={explicationErreur}
                            {lienQuestion}
                            ancree={decalageDeLaNote !== null}
                            entree={!noteDejaEntree}
                            data-hors-du-bouton
                            on:expliquer={expliquerArticle}
                          />
                        </div>
                      </aside>
                    </div>
                  {/if}
                {/if}
              </div>

              {#if nombreHistorique > 0 && statut}
                <div
                  id="panneau-historique"
                  role="tabpanel"
                  aria-labelledby="onglet-historique"
                  hidden={onglet !== "historique"}
                >
                  {#if onglet === "historique"}
                    <HistoriqueDuTexte {statut} />
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </main>
      </div>
    </div>
  {/if}
</div>

<!-- Le bouton de l'assistant, comme sur la recherche et l'accueil. Il se
     retire quand le texte passe dessous (`eviter`), et le pied de page lui
     réserve sa place en fin de défilement ; la page le retient pendant ses
     propres défilements (`boutonRetenu`). -->
<ChatFab eviter="[data-hors-du-bouton]" masque={boutonRetenu} />
<SiteFooter reserverBouton />

<style>
  /*
   * Hauteurs maximales du sommaire. Ici plutôt qu'en classes Tailwind : une
   * classe `max-h-[80dvh]` n'écrit que la valeur en dvh, et un navigateur qui
   * ne la connaît pas laisserait le panneau sans limite. La valeur en vh,
   * écrite d'abord, sert de repli. Sous `lg`, fermé, le sommaire n'est
   * qu'une rangée de puces : pas de limite. Ouvert à partir de `lg`, c'est
   * une feuille de toute la hauteur (`inset-y-0`).
   */
  @media not all and (min-width: 1024px) {
    .sommaire.ouvert {
      max-height: 80vh;
      max-height: 80dvh;
    }
  }

  @media (min-width: 1024px) {
    .sommaire:not(.ouvert) {
      max-height: calc(100vh - 7rem);
      max-height: calc(100dvh - 7rem);
    }
  }

  /*
   * Fondu au bas de la liste qui défile (restes R3) : la liste s'arrêtait
   * net contre le bord arrondi du panneau, « Article 12 » tranché par la
   * bordure, sans rien qui dise qu'il en restait. L'ancien fondu, un
   * pseudo-élément collant, n'apparaissait pas. Un masque, lui, suit le bas
   * de la zone visible quelle que soit la position, en clair comme en
   * sombre ; les 3rem de marge basse de la liste font qu'en fin de liste il
   * ne couvre que du vide. 3rem et non 2 : plus haut que l'écart entre deux
   * divisions, il estompe toujours le début de la suivante. À 2rem, il
   * tombait parfois tout entier dans cet écart, et le sommaire du décret
   * 2021/745 semblait finir à l'article 8, seize articles avant sa fin
   * (vérification r3 du 29/10/2026). Refonte A : seulement là où la liste
   * défile en hauteur (panneau ouvert, colonne) ; il effacerait les puces.
   */
  .sommaire.ouvert .toc {
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent);
  }

  @media (min-width: 1024px) {
    .toc {
      -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent);
      mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent);
    }
  }

  /*
   * Le panneau monte du bas (la feuille vient de la gauche à partir de
   * `lg`) et le fond apparaît en fondu. La marge de la note glisse vers son
   * passage quand elle s'y cale (`ancrerLaNote`) : `padding-top`, seule
   * propriété de mise en page animée de la page, voulue (cartes/lecture.md,
   * étape 7) et hors du texte, qui ne bouge pas. Rien de tout cela pour qui
   * a demandé moins d'animations.
   */
  @media (prefers-reduced-motion: no-preference) {
    .sommaire.ouvert {
      animation: monter 0.2s ease-out;
    }

    .fond-sommaire {
      animation: fondu 0.2s ease-out;
    }

    .rail {
      transition: padding-top 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  @media (prefers-reduced-motion: no-preference) and (min-width: 1024px) {
    .sommaire.ouvert {
      animation-name: glisser;
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

  @keyframes glisser {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
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
