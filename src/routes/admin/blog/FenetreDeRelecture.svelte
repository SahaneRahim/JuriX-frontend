<script lang="ts">
  /**
   * La fenêtre de relecture d'un article. Trois vues :
   * - RELECTURE : chaque partie, phrase par phrase avec le verdict du contrôle
   *   IA, et sa case « J'ai relu cette partie contre les sources » ; en tête,
   *   le contrôle (quand, quel modèle, ce qu'il a trouvé) et « Relancer le
   *   contrôle IA » ;
   * - APERÇU : l'article tel que le lira le public, modifications non
   *   enregistrées comprises ;
   * - ÉDITION : tous les champs, citations comprises.
   * À côté du texte, les sources (PanneauDesSources) ; en pied, enregistrer,
   * publier ou retirer du site.
   *
   * CONTRAT DU 30/10 (« Relecture + contrôle IA », décision du propriétaire).
   * L'essai réel du 30/10 a publié, citations vérifiées et sans un seul
   * avertissement, l'expulsion sans juge, la charge de la preuve inversée et
   * une explication contraire à l'article 1752 du Code civil. On ne publie
   * plus qu'un article « publiable » : toutes ses citations vérifiées, un
   * contrôle IA à jour sans phrase contredite, chaque partie relue par une
   * personne. « Publier » reste désactivé, la raison écrite à côté, tant que
   * ce n'est pas le cas (`blocagesDePublication`) ; s'il part quand même et
   * que le serveur refuse (422), la raison du serveur s'affiche. Il envoie UN
   * SEUL PUT : le formulaire entier, les cases cochées et `is_published:
   * true`, que le serveur valide tout entier avant de rien changer.
   * « Retirer du site » envoie exactement `{"is_published": false}`, toujours
   * accepté : les modifications en cours restent dans le formulaire.
   *
   * AVENANT DU TOUR 4 (revue du tour 3, trois défauts) :
   * - le TITRE est une partie relue et contrôlée : il s'affiche en tête de la
   *   vue Relecture avec ses verdicts et sa case, et le changer sur un
   *   article en ligne demande de le retirer, de relancer le contrôle et de
   *   le relire ;
   * - les SOURCES sont gardées avec l'article (`article.sources`) : le panneau
   *   les montre à chaque ouverture, et les numéros des verdicts y mènent ;
   * - un article SANS SOURCES (publié avant la vérification, ou écrit à la
   *   main) a son parcours de reprise (ParcoursDeReprise) : « Reconstruire les
   *   sources » (`POST /blog/{id}/sources`), citer au moins un article des
   *   sources, « Relancer le contrôle IA », relire, publier ; chaque étape dit
   *   ce qui bloque ;
   * - une case de relecture atteste les verdicts de sa partie (API du tour
   *   4) : après un contrôle ou une reconstruction des sources, les cases
   *   sont celles que le serveur compte encore, jamais celles d'avant.
   *
   * AVENANT DU TOUR 5 (revue du tour 4 : un contrôle relancé dans un autre
   * onglet, ou dont la réponse s'était perdue, passait pour relu) :
   * - une case cochée part avec `relecture.controle`, le `fait_le` du contrôle
   *   affiché ; l'API refuse (422 `relecture_perimee`, rien d'appliqué) si
   *   elle en a enregistré un autre. La fenêtre relit alors l'article et dit
   *   quelles parties relire ;
   * - CHAQUE lecture de l'article qui apporte un autre contrôle (relecture
   *   après un refus ou un échec, contrôle relancé, retrait, enregistrement)
   *   refait les cases depuis le serveur (`casesApresUnAutreControle`), saisie
   *   en cours ou non, et la fenêtre nomme les parties à relire de nouveau ;
   * - relancer le contrôle d'un article PUBLIÉ se confirme d'abord (le
   *   serveur répond 409 `article_en_ligne` sans `{"confirmer": true}`) : un
   *   verdict qui change retire l'article du public jusqu'à la relecture de
   *   sa partie, et la fenêtre le dit une fois le contrôle fini.
   * Revue du front du tour 5 : un article caché par un contrôle revenait en
   * ligne au contrôle suivant, la case de la partie revivant avec les
   * verdicts d'avant. L'API efface désormais cette case ; la fenêtre, elle,
   * garde la partie à relire tant que personne ne l'a recochée contre le
   * contrôle enregistré (`casesSansRetourDesPartiesARelire`), et dit après
   * chaque contrôle si l'article a quitté le public, s'il reste caché ou s'il
   * y revient.
   * AVENANT DU TOUR 7 (décision du propriétaire du 04/11, « Confirmer phrase
   * par phrase ») : une phrase de règle « À vérifier » ou « Hors des
   * sources » se réécrit (un nouveau contrôle la juge) ou se confirme une à
   * une (VueDuControle). Les confirmations partent avec le formulaire
   * (`relecture.phrases_confirmees`, toujours avec `relecture.controle`) ;
   * « Publier » dit combien il en manque ; un autre contrôle les refait
   * depuis le serveur, sans jamais passer une confirmation d'une phrase à une
   * autre (`confirmationsApresUnAutreControle`). Le contrôle seul attend
   * 175 s au plus (`DELAI_DU_CONTROLE_MS`) : 40 à 105 s mesurées.
   * Un article publié dans la base mais CACHÉ du public (non publiable) se
   * reprend comme un brouillon : « Enregistrer le brouillon » le garde hors
   * ligne, « Publier » le remet en ligne. « Retirer du site » et « Publier
   * les modifications » ne valent que pour un article que le public lit.
   *
   * Hérité des revues du 29/10 : les erreurs s'affichent dans le pied, au
   * premier plan ; le voile ne ferme que si l'appui ET le relâchement ont eu
   * lieu sur lui ; une fermeture avec des modifications non enregistrées
   * demande confirmation (voile, Échap, croix) ; une citation se retire ou
   * voit son explication réécrite, son texte, son article et son extrait
   * venant de la base.
   */
  import { onDestroy, tick } from "svelte";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import { apiFetch } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import { citationBruteVerifiee, nomRubrique, texteAffiche } from "$lib/data/blog";
  import { formatDate } from "$lib/format";
  import { language, tr } from "$lib/stores/language";
  import CorpsDeLArticle from "../../blog/CorpsDeLArticle.svelte";
  import BadgeDePublication from "./BadgeDePublication.svelte";
  import {
    PARTIES_DE_RELECTURE,
    compteDesVerdicts,
    confirmationsValables,
    identiteDuControle,
    phrasesAConfirmer,
    type PartieDeRelecture,
  } from "./controle";
  import {
    ATTENTE_LONGUE_DU_CONTROLE_S,
    DELAI_DES_SOURCES_MS,
    DELAI_DU_CONTROLE_MS,
    erreurDeReponse,
    erreurDExecution,
    messageDErreur,
    type Action,
    type ErreurDuBlog,
  } from "./erreurs";
  import PanneauDesSources from "./PanneauDesSources.svelte";
  import ParcoursDeReprise from "./ParcoursDeReprise.svelte";
  import {
    articleAdminDepuis,
    articleDuFormulaire,
    autreControle,
    avertissementsDeGenerationValables,
    avertissementsDeRepriseValables,
    blocagesDePublication,
    casesApresUnAutreControle,
    casesSansRetourDesPartiesARelire,
    champsManquants,
    confirmationsApresUnAutreControle,
    citationDepuisSource,
    controleAJour,
    corpsDeLaModification,
    empreinte,
    estAncien,
    etapesDeReprise,
    formulaireDepuis,
    nomDeCitation,
    partieRelue,
    partiesModifiees,
    partiesRelues,
    pointsAVerifier,
    resultatDeReconstruction,
    sansSources,
    visibleDuPublic,
    type ArticleAdmin,
    type Blocage,
    type ChampDuFormulaire,
    type Formulaire,
    type SourceDeGeneration,
  } from "./relecture";
  import VueDuControle from "./VueDuControle.svelte";

  export let article: ArticleAdmin;
  /**
   * Les extraits rendus par la génération pendant cette visite : un repli,
   * pour une réponse qui ne les porterait pas dans l'article. Les sources de
   * l'article (`article.sources`, gardées avec lui) passent avant.
   */
  export let sources: SourceDeGeneration[] = [];
  /**
   * Ce que seule la génération a relevé (passage qui porte d'autres articles,
   * citation écartée, contrôle IA qui n'a pas abouti) : l'API ne le garde
   * pas, la page le garde pour la visite.
   */
  export let avertissementsDeGeneration: string[] = [];
  /**
   * La vue à l'ouverture : la relecture après une génération, l'aperçu pour
   * « Voir » un brouillon, l'édition pour « Modifier ».
   */
  export let vue: "relecture" | "apercu" | "edition" = "edition";
  export let onFermer: () => void;
  /** Après chaque enregistrement réussi : la page met sa liste à jour. */
  export let onMisAJour: (article: ArticleAdmin, evenement: "enregistre" | "publie" | "retire") => void;
  /** L'article n'existe plus côté API (supprimé ailleurs) : la page relit sa liste. */
  export let onDisparu: () => void = () => {};

  const CHAMP =
    "min-h-11 w-full rounded-xl border border-zinc-500 bg-white px-3 py-2 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 dark:aria-[invalid=true]:border-red-400 dark:aria-[invalid=true]:ring-red-400 sm:[@media(pointer:fine)]:text-sm";
  const LIBELLE = "mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200";
  const AIDE = "mt-1 text-xs text-zinc-500 dark:text-zinc-400";
  const BOUTON_SECONDAIRE =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:flex-none";
  const BOUTON_PRINCIPAL =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-black aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:flex-none";
  const BOUTON_DISCRET =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";
  const ONGLET = "inline-flex min-h-11 items-center gap-1.5 rounded-[0.6rem] px-2.5 text-sm font-semibold transition-colors sm:px-3";
  const ONGLET_ACTIF = "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-white";
  const ONGLET_INACTIF = "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";

  /** Les champs du formulaire : identifiant et nom (clé du champ de l'API). */
  const CHAMPS: Record<ChampDuFormulaire, { id: string; cle: string }> = {
    titre: { id: "ed-title", cle: "admin.blog.field.title" },
    slug: { id: "ed-slug", cle: "admin.blog.field.slug" },
    rubrique: { id: "ed-cat", cle: "admin.blog.field.category" },
    duree: { id: "ed-time", cle: "admin.blog.field.reading_time" },
    contexte: { id: "ed-ctx", cle: "admin.blog.field.context" },
    resume: { id: "ed-sum", cle: "admin.blog.field.summary" },
    pointsCles: { id: "ed-kp", cle: "admin.blog.field.keyPoints" },
    impact: { id: "ed-ci", cle: "admin.blog.field.citizenImpact" },
    question: { id: "ed-sq", cle: "admin.blog.field.suggested_question" },
    motsCles: { id: "ed-tags", cle: "admin.blog.field.tags" },
  };

  /** Le champ du formulaire nommé par une erreur de l'API (« title », « bot_analysis.summary »). */
  const DEPUIS_L_API: Record<string, ChampDuFormulaire> = {
    title: "titre",
    slug: "slug",
    category: "rubrique",
    reading_time: "duree",
    context: "contexte",
    summary: "resume",
    keyPoints: "pointsCles",
    key_points: "pointsCles",
    citizenImpact: "impact",
    citizen_impact: "impact",
    suggested_question: "question",
    tags: "motsCles",
  };

  let form = formulaireDepuis(article);
  let empreinteEnregistree = empreinte(form);
  let occupe: "" | "enregistrement" | "publication" | "retrait" | "controle" | "sources" = "";
  let erreur = "";
  let statut = "";
  let invalides: ChampDuFormulaire[] = [];
  let appuiSurLeVoile = false;
  let titreDesCitations: HTMLLegendElement | undefined;
  let blocDesRaisons: HTMLDivElement | undefined;
  /** Au téléphone : le volet des sources est ouvert. */
  let sourcesOuvertes = false;
  /** Les extraits dépliés en entier dans le panneau des sources. */
  let sourcesDepliees: number[] = [];
  /**
   * L'attente en cours (contrôle IA ou reconstruction des sources, jamais les
   * deux à la fois) : temps écoulé, requête, délai du client.
   */
  let ecoule = 0;
  let minuterie: ReturnType<typeof setInterval> | undefined;
  let delaiDuClient: ReturnType<typeof setTimeout> | undefined;
  let controleur: AbortController | null = null;
  let raisonDArret: "admin" | "delai" | null = null;
  /** Ce que la reconstruction des sources a relevé (une citation retirée), pour la durée de la fenêtre. */
  let avertissementsDeReprise: string[] = [];
  /**
   * Les parties dont la case est tombée parce qu'une lecture de l'article a
   * apporté un AUTRE contrôle (avenant du tour 5) : à relire de nouveau,
   * contre ses verdicts. Une partie quitte la liste dès qu'elle compte de
   * nouveau comme relue : recochée ici, ou ailleurs contre le contrôle
   * enregistré (`casesSansRetourDesPartiesARelire`), jamais parce que le
   * serveur ferait revivre sa case.
   */
  let aRelire: PartieDeRelecture[] = [];
  /** Le refus du dernier PUT : après lui, la fenêtre sait s'il faut refaire les cases. */
  let derniereErreur: ErreurDuBlog | null = null;

  /**
   * Le parcours de reprise, montré pour un article qui s'ouvre SANS SOURCES
   * ou publié avant la vérification, et jusqu'à la fermeture de la fenêtre :
   * les étapes faites restent dites faites (les sources reconstruites, le
   * brouillon enregistré) jusqu'à la publication.
   */
  const enReprise = sansSources(article, article.sources.length > 0 ? article.sources : sources) || estAncien(article);
  const ancien = estAncien(article);

  $: modifie = empreinte(form) !== empreinteEnregistree;
  $: modifiees = partiesModifiees(form, article);
  // Les sources de l'article, gardées avec lui ; à défaut, celles que la
  // génération a rendues pendant la visite.
  $: sourcesAffichees = article.sources.length > 0 ? article.sources : sources;
  $: sansLesSources = sansSources(article, sourcesAffichees);
  $: blocages = blocagesDePublication(form, article, sourcesAffichees);
  $: etapes = etapesDeReprise(blocages);
  $: enLigne = visibleDuPublic(article);
  $: raisons = blocages.map((b) => phraseDuBlocage(b, $tr, enLigne));
  $: aJour = controleAJour(article);
  $: compte = compteDesVerdicts(article.controleIa);
  $: relues = PARTIES_DE_RELECTURE.filter((p: PartieDeRelecture) => partieRelue(form, p, modifiees)).length;
  // Les phrases de règle à confirmer du contrôle à jour (avenant du tour 7) :
  // combien, et combien sont confirmées dans la fenêtre.
  $: aConfirmerEnTout = aJour ? phrasesAConfirmer(article.controleIa).length : 0;
  $: confirmeesEnTout = aJour ? confirmationsValables(form.confirmees, article.controleIa).length : 0;
  $: points = pointsAVerifier(
    article.avertissements,
    form.citations.map((c) => c.origine),
    $tr,
    avertissementsDeGenerationValables(avertissementsDeGeneration, article),
    avertissementsDeRepriseValables(avertissementsDeReprise, article),
  );
  $: apercu = articleDuFormulaire(form, article);
  $: titreFenetre =
    vue === "relecture"
      ? $tr("admin.blog.reviewDialogTitle")
      : vue === "apercu"
        ? $tr("admin.blog.previewDialogTitle")
        : $tr("admin.blog.editTitle");
  $: adressePublique = `/blog/${encodeURIComponent(article.slug)}`;
  // Le panneau des sources accompagne la relecture et l'édition ; l'aperçu
  // montre l'article comme le public, sans lui.
  $: avecPanneau = vue !== "apercu";
  $: sourcesConnues = sourcesAffichees.map((s) => s.n);
  // Pourquoi « Relancer le contrôle IA » ne part pas :
  // - « sources » : sans sources, le contrôle n'a rien contre quoi juger
  //   (reconstruire d'abord ; la reconstruction peut aussi retirer des
  //   citations, ce qui périmerait le contrôle) ;
  // - « en_ligne » : un article que le public lit et dont la saisie change le
  //   texte relu : le contrôle porterait sur l'ancien texte, et l'enregistrer
  //   le retirerait du site.
  $: controleBloque = sansLesSources ? "sources" : enLigne && modifiees.length > 0 ? "en_ligne" : null;
  $: chrono = `${Math.floor(ecoule / 60)}:${String(ecoule % 60).padStart(2, "0")}`;
  // Les parties à relire de nouveau, tant qu'elles ne comptent pas comme relues.
  $: partiesARelire = aRelire.filter((p: PartieDeRelecture) => !partieRelue(form, p, modifiees));

  const libelle = (champ: ChampDuFormulaire) => $tr(CHAMPS[champ].cle);
  const invalide = (champ: ChampDuFormulaire, liste: ChampDuFormulaire[]) => (liste.includes(champ) ? "true" : undefined);

  /**
   * Ce qui empêche de publier, en une phrase qui dit quoi faire.
   * `lisibleDuPublic` : un article en ligne ne s'enregistre pas sans quitter
   * le site, il faut d'abord l'en retirer.
   */
  function phraseDuBlocage(blocage: Blocage, t: (cle: string) => string, lisibleDuPublic: boolean): string {
    switch (blocage.code) {
      case "sources_absentes":
        return t("admin.blog.blocked.sources");
      case "aucune_citation":
        return t("admin.blog.blocked.noCitation");
      case "citations_non_verifiees":
        return t("admin.blog.blocked.citations").replace("{n}", String(blocage.n));
      case "controle_a_relancer":
        if (blocage.cause === "absent") return t("admin.blog.blocked.checkMissing");
        if (blocage.cause === "perime") return t("admin.blog.blocked.checkStale");
        return t(lisibleDuPublic ? "admin.blog.blocked.checkEditedPublished" : "admin.blog.blocked.checkEdited");
      case "phrases_contredites":
        return t("admin.blog.blocked.contradicted").replace("{n}", String(blocage.n));
      case "phrases_a_confirmer":
        return t("admin.blog.blocked.toConfirm").replace("{n}", String(blocage.n));
      case "relecture_incomplete":
        return t("admin.blog.blocked.review").replace("{n}", String(blocage.n)).replace("{total}", String(blocage.total));
      case "serveur":
        return t("admin.blog.blocked.server").replace("{etat}", () => t(`admin.blog.etat.${blocage.etat}`));
      default:
        return t("admin.blog.blocked.unknown");
    }
  }

  /** « 30 octobre 2026 à 10:42 » ; la valeur telle quelle si elle ne se lit pas. */
  function dateEtHeure(valeur: string | null, lang: string): string {
    const instant = Date.parse(valeur ?? "");
    if (!Number.isFinite(instant)) return valeur ?? "";
    return new Date(instant).toLocaleString(lang === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Ouverte, la fenêtre fige la page derrière elle, comme les autres fenêtres
  // de l'administration : sur téléphone, où elle devient un panneau collé en
  // bas, un glisser sur son en-tête ou sur le voile ferait défiler la liste.
  function bloquerDefilement(_noeud: HTMLElement) {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return {
      destroy() {
        document.body.style.overflow = avant;
      },
    };
  }

  /** Fermer, après confirmation si des modifications ne sont pas enregistrées. */
  function demanderFermeture() {
    if (occupe) return;
    if (modifie && !confirm($tr("admin.blog.confirmClose"))) return;
    onFermer();
  }

  // Le voile ne ferme que si l'APPUI a aussi eu lieu sur lui. Une sélection
  // commencée dans un champ et relâchée sur le voile envoie son `click` à
  // leur ancêtre commun, le voile : la fenêtre se fermait, modifications
  // perdues (vérifié dans Chromium, revue du 29/10).
  function surAppui(event: PointerEvent) {
    appuiSurLeVoile = event.target === event.currentTarget;
  }

  function surClicDuVoile(event: MouseEvent) {
    const surLeVoile = appuiSurLeVoile && event.target === event.currentTarget;
    appuiSurLeVoile = false;
    if (surLeVoile) demanderFermeture();
  }

  function surTouche(event: KeyboardEvent) {
    if (event.key === "Escape") demanderFermeture();
  }

  async function signalerChamps(champs: ChampDuFormulaire[], message: string) {
    invalides = champs;
    erreur = message;
    if (champs.length === 0) return;
    // Le champ n'existe que dans la vue d'édition.
    vue = "edition";
    await tick();
    document.getElementById(CHAMPS[champs[0]].id)?.focus();
  }

  /** Les champs obligatoires vides, signalés (le premier reçoit le focus) ; vrai s'il en manque. */
  function champsVides(): boolean {
    const manquants = champsManquants(form);
    if (manquants.length === 0) return false;
    void signalerChamps(manquants, $tr("admin.blog.required").replace("{fields}", manquants.map(libelle).join(", ")));
    return true;
  }

  /** Affiche une erreur de l'API, et désigne le champ en cause quand elle le nomme. */
  async function montrerErreur(cause: ErreurDuBlog, action: Action = "generation") {
    // Une adresse prise ne vient que d'un enregistrement : un 409 de la
    // reconstruction des sources n'a rien à voir avec le champ Adresse.
    if (cause.code === "slug_pris" && action !== "sources") return signalerChamps(["slug"], messageDErreur(cause, $tr, action));
    if (cause.code === "introuvable") onDisparu();
    const champs = cause.champs
      .map((c) => c.champ.split(".").reverse().map((m) => DEPUIS_L_API[m]).find(Boolean))
      .filter((c): c is ChampDuFormulaire => Boolean(c));
    return signalerChamps([...new Set(champs)], messageDErreur(cause, $tr, action));
  }

  /**
   * Prend l'article tel que le serveur l'a enregistré : adresse normalisée,
   * citations reconstruites depuis la base, état, contrôle et relecture. Le
   * formulaire repart de lui, sauf avec `garderLaSaisie` quand une saisie est
   * en cours : elle reste, non enregistrée (retrait du site, contrôle relancé,
   * relecture après un refus).
   *
   * UN AUTRE CONTRÔLE (avenant du tour 5) : si l'article relu porte un autre
   * contrôle que celui affiché (ou `refaireLesCases`, après une relecture
   * périmée), les cases sont refaites depuis le serveur même quand la saisie
   * reste : une case cochée contre l'ancien contrôle ne compte plus pour le
   * nouveau, et « Publier » l'aurait renvoyée. Les parties qui comptaient
   * comme relues et ne le sont plus rejoignent celles à relire de nouveau.
   *
   * UNE PARTIE À RELIRE LE RESTE jusqu'à ce qu'on la recoche (revue du front
   * du tour 5) : ici, ou ailleurs contre le contrôle que le serveur garde
   * (`relecture.controle`). Un serveur qui la compterait de nouveau sans cela
   * (sa case, cochée contre un contrôle plus ancien, revit quand un contrôle
   * suivant redonne les verdicts d'avant : l'API d'avant ce correctif) ne la
   * recoche pas dans la fenêtre : l'article caché revenait en ligne sans que
   * personne ait lu ce que le contrôle intermédiaire avait trouvé.
   */
  function appliquer(relu: ArticleAdmin, garderLaSaisie: boolean, refaireLesCases = false) {
    const saisieEnCours = garderLaSaisie && empreinte(form) !== empreinteEnregistree;
    const changement = refaireLesCases || autreControle(article, relu);
    const reluesAvant = partiesRelues(form, article);
    const cocheesAvant = { ...form.relecture };
    const confirmeesAvant = [...form.confirmees];
    const avant = article;
    const formulaireEnregistre = formulaireDepuis(relu);
    formulaireEnregistre.relecture = casesSansRetourDesPartiesARelire(formulaireEnregistre.relecture, aRelire, relu);
    // Une confirmation ne passe jamais d'une phrase à une autre (avenant du
    // tour 7) : après un autre contrôle, seules restent celles que les deux
    // contrôles jugent de même sous le même identifiant.
    if (changement) formulaireEnregistre.confirmees = confirmationsApresUnAutreControle(formulaireEnregistre.confirmees, avant, relu);
    article = relu;
    if (!saisieEnCours) form = formulaireEnregistre;
    else if (changement) {
      form.relecture = casesApresUnAutreControle(cocheesAvant, relu);
      form.confirmees = confirmationsApresUnAutreControle(confirmeesAvant, avant, relu);
    }
    empreinteEnregistree = empreinte(formulaireEnregistre);
    invalides = [];
    if (changement) {
      const reluesApres = partiesRelues(form, relu);
      const tombees = reluesAvant.filter((p) => !reluesApres.includes(p));
      aRelire = PARTIES_DE_RELECTURE.filter(
        (p) => tombees.includes(p) || (aRelire.includes(p) && !reluesApres.includes(p)),
      );
    }
  }

  /** Les parties à relire de nouveau, nommées (« Titre, Contexte »). */
  function nomsDesParties(parties: readonly PartieDeRelecture[], t: (cle: string) => string): string {
    return parties.map((p) => t(`admin.blog.part.${p}`)).join(", ");
  }

  /** Les parties à relire de nouveau, d'après l'état de la fenêtre à cet instant. */
  function partiesARelireMaintenant(f: Formulaire, lu: ArticleAdmin): PartieDeRelecture[] {
    const relues = partiesRelues(f, lu);
    return aRelire.filter((p) => !relues.includes(p));
  }

  /**
   * `PUT /blog/{id}` avec `corps`. Rend l'article enregistré, ou `null` après
   * avoir affiché l'erreur DANS la fenêtre (et l'avoir gardée dans
   * `derniereErreur`).
   */
  async function envoyer(corps: Record<string, unknown>, garderLaSaisie = false): Promise<ArticleAdmin | null> {
    derniereErreur = null;
    try {
      const reponse = await apiFetch(`/blog/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) {
        derniereErreur = await erreurDeReponse(reponse);
        await montrerErreur(derniereErreur);
        return null;
      }
      const enregistre = articleAdminDepuis(await reponse.json());
      if (!enregistre) {
        erreur = $tr("admin.blog.err.unexpected");
        return null;
      }
      appliquer(enregistre, garderLaSaisie);
      return enregistre;
    } catch (e) {
      erreur = messageDErreur(erreurDExecution(e), $tr);
      return null;
    }
  }

  /**
   * Relit l'article après un refus ou un échec (`GET /blog/admin/{id}`) : le
   * serveur fait foi, la saisie reste. POURQUOI (revue du tour 2) : une API
   * qui retirait l'article avant de refuser la modification le laissait
   * affiché « Publié » dans la fenêtre et dans la liste. Le contrat du 30/10
   * valide tout avant de rien changer ; la relecture le vérifie au lieu de le
   * supposer. En échec, elle ne dit rien : l'erreur affichée suffit.
   * `refaireLesCases` : après une relecture périmée, les cases sont refaites
   * depuis le serveur même s'il dit le même contrôle (`appliquer`). Vrai si
   * l'article a été relu.
   */
  async function relire(refaireLesCases = false): Promise<boolean> {
    try {
      const reponse = await apiFetch(`/blog/admin/${article.id}`);
      if (!reponse.ok) return false;
      const relu = articleAdminDepuis(await reponse.json());
      if (!relu || relu.id !== article.id) return false;
      const etaitPublie = article.isPublished;
      appliquer(relu, true, refaireLesCases);
      if (etaitPublie && !relu.isPublished) {
        statut = $tr("admin.blog.unpublishedKeepEdits");
        onMisAJour(relu, "retire");
      } else {
        onMisAJour(relu, "enregistre");
      }
      return true;
    } catch {
      // Rien de plus à dire que l'erreur déjà affichée.
      return false;
    }
  }

  /**
   * Après un PUT refusé : l'article relu, le serveur faisant foi. Pour une
   * relecture périmée (422 `relecture_perimee`, avenant du tour 5), les cases
   * sont refaites depuis le serveur et l'erreur nomme les parties à relire :
   * sans cela, le PUT suivant renverrait les mêmes cases, contre le même
   * ancien contrôle, et serait refusé de nouveau.
   */
  async function apresUnRefus() {
    const perimee = derniereErreur?.code === "relecture_perimee";
    const relu = await relire(perimee);
    // Relecture impossible (réseau) : l'erreur du refus reste seule, sans
    // prétendre les cases refaites.
    if (!perimee || !relu) return;
    // Le pied de la fenêtre est court au téléphone : « toutes les parties »
    // plutôt que les sept noms, que la liste en tête de la fenêtre détaille.
    const parties = partiesARelireMaintenant(form, article);
    erreur = [
      $tr("admin.blog.err.reviewStale"),
      parties.length === PARTIES_DE_RELECTURE.length
        ? $tr("admin.blog.reread.all")
        : parties.length > 0
          ? $tr("admin.blog.reread.list").replace("{parties}", () => nomsDesParties(parties, $tr))
          : $tr("admin.blog.reread.none"),
    ].join(" ");
  }

  function heure(): string {
    return new Date().toLocaleTimeString($language.current === "en" ? "en-GB" : "fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /** « Enregistrer le brouillon » : tout le formulaire, cases de relecture comprises. */
  async function enregistrer() {
    if (occupe) return;
    erreur = "";
    statut = "";
    if (champsVides()) return;
    occupe = "enregistrement";
    let perimee = false;
    try {
      const enregistre = await envoyer(corpsDeLaModification(form, article, false));
      if (enregistre) {
        statut = $tr("admin.blog.saved").replace("{heure}", heure());
        onMisAJour(enregistre, "enregistre");
      }
      perimee = derniereErreur?.code === "relecture_perimee";
    } finally {
      occupe = "";
    }
    if (perimee) await apresUnRefus();
  }

  /**
   * « Publier » (brouillon) et « Publier les modifications » (article en
   * ligne) : UN SEUL `PUT`, le formulaire entier, les cases de relecture et
   * `is_published: true`. Le serveur valide tout avant de rien changer : un
   * refus laisse l'article tel quel (en ligne dans sa version précédente, ou
   * brouillon), et sa raison s'affiche. Tant que `blocages` n'est pas vide,
   * le bouton est désactivé (`aria-disabled`, pour garder le focus) : un appui
   * n'envoie rien et montre la raison.
   */
  async function publier() {
    if (occupe) return;
    erreur = "";
    statut = "";
    if (blocages.length > 0) {
      await tick();
      blocDesRaisons?.focus();
      return;
    }
    // Rien à publier pour un article que le public lit déjà, tel quel. Un
    // article caché du public, lui, se publie (il redevient lisible).
    if (enLigne && !modifie) {
      statut = $tr("admin.blog.nothingToPublish");
      return;
    }
    if (champsVides()) return;
    occupe = "publication";
    let refuse = false;
    try {
      const publie = await envoyer(corpsDeLaModification(form, article, true));
      if (publie?.isPublished) {
        onMisAJour(publie, "publie");
        return;
      }
      if (publie) {
        // Enregistré sans être publié : jamais annoncé comme publié.
        onMisAJour(publie, "enregistre");
        erreur = $tr("admin.blog.err.unexpected");
        return;
      }
      refuse = true;
    } finally {
      occupe = "";
    }
    if (refuse) await apresUnRefus();
  }

  /**
   * Retirer du site : l'article redevient un brouillon, invisible du public.
   *
   * EXACTEMENT `{"is_published": false}`, que l'API accepte toujours. Avec
   * des modifications en cours, le front envoyait tout le formulaire : l'API
   * revérifie toute citation envoyée et exige les champs de texte, et le
   * retrait était refusé ; l'article, faux, restait en ligne (revue croisée
   * du 29/10). Aucun champ n'est donc exigé, et les modifications restent
   * dans le formulaire, non enregistrées : « Enregistrer le brouillon » les
   * garde ensuite, l'article étant déjà hors ligne.
   */
  async function retirer() {
    if (occupe) return;
    erreur = "";
    statut = "";
    invalides = [];
    occupe = "retrait";
    try {
      const avecSaisie = modifie;
      const retire = await envoyer({ is_published: false }, true);
      if (retire) {
        statut = avecSaisie ? $tr("admin.blog.unpublishedKeepEdits") : $tr("admin.blog.unpublishedStatus");
        onMisAJour(retire, "retire");
      }
    } finally {
      occupe = "";
    }
  }

  function arreterLAttente() {
    clearInterval(minuterie);
    clearTimeout(delaiDuClient);
    minuterie = undefined;
    delaiDuClient = undefined;
    controleur = null;
  }

  /** Lance la minuterie visible et le délai du client ; rend le signal de la requête. */
  function attendre(delaiMs: number): AbortSignal {
    ecoule = 0;
    const debut = Date.now();
    minuterie = setInterval(() => {
      ecoule = Math.floor((Date.now() - debut) / 1000);
    }, 1000);
    const actuel = new AbortController();
    controleur = actuel;
    raisonDArret = null;
    delaiDuClient = setTimeout(() => {
      raisonDArret = "delai";
      actuel.abort();
    }, delaiMs);
    return actuel.signal;
  }

  /**
   * Enregistre la saisie en brouillon avant une action qui porte sur le texte
   * ENREGISTRÉ (contrôle IA, reconstruction des sources) ; vrai si rien
   * n'était à enregistrer ou si l'enregistrement a réussi.
   */
  async function enregistrerAvant(): Promise<boolean> {
    if (!modifie) return true;
    if (champsVides()) return false;
    occupe = "enregistrement";
    let enregistre: ArticleAdmin | null = null;
    try {
      enregistre = await envoyer(corpsDeLaModification(form, article, false));
    } finally {
      occupe = "";
    }
    if (!enregistre) {
      if (derniereErreur?.code === "relecture_perimee") await apresUnRefus();
      return false;
    }
    onMisAJour(enregistre, "enregistre");
    return true;
  }

  /**
   * « Relancer le contrôle IA » : `POST /blog/{id}/controle`, qui juge le
   * texte ENREGISTRÉ et rend l'article. Un brouillon modifié (ou un article
   * caché du public) est donc enregistré d'abord (« Enregistrer et
   * relancer ») ; un article en ligne modifié ne l'est pas, puisque
   * l'enregistrer le retirerait du site : le bouton dit d'abord de le
   * retirer. Sans sources, le bouton dit de les reconstruire d'abord. Pendant
   * l'attente, le formulaire est figé et le temps écoulé s'affiche ; le
   * client abandonne au bout de 175 s (`DELAI_DU_CONTROLE_MS`, 10 s après le
   * serveur). Un échec ne perd rien (contrat) :
   * l'erreur s'affiche et l'article est relu, le serveur faisant foi sur ce
   * qu'il garde du contrôle.
   *
   * UN ARTICLE PUBLIÉ (avenant du tour 5). Un verdict qui change décoche sa
   * partie, et l'article quitte le public jusqu'à ce qu'elle soit relue :
   * l'essai réel du 04/11 a vu des verdicts s'inverser d'un contrôle à l'autre,
   * à température 0. La fenêtre demande donc confirmation, en le disant, puis
   * envoie `{"confirmer": true}` ; sans lui, le serveur répond 409
   * `article_en_ligne` sans appeler le modèle (un article publié entre-temps
   * ailleurs : la fenêtre le relit, et la confirmation sera demandée au
   * prochain appui). Fini, le contrôle dit si l'article a quitté le public,
   * s'il reste caché, ou s'il y revient : jamais en silence.
   *
   * LES CASES APRÈS LE CONTRÔLE : un contrôle neuf est un autre contrôle, ses
   * cases sont refaites depuis le serveur (`appliquer`) ; et si la réponse
   * s'est perdue alors que le serveur l'a enregistré (proxy, réseau), la
   * relecture qui suit l'échec le trouve, refait les cases et le dit, au lieu
   * de « rien n'est perdu ».
   */
  async function lancerLeControle() {
    if (occupe || controleBloque) return;
    erreur = "";
    statut = "";
    if (!enLigne && !(await enregistrerAvant())) return;
    // Après l'enregistrement : un article caché du public y est redevenu un
    // brouillon, sans rien à confirmer.
    const confirme = article.isPublished;
    if (confirme && !confirm($tr(enLigne ? "admin.blog.check.confirmOnline" : "admin.blog.check.confirmHidden"))) {
      statut = $tr("admin.blog.check.notRun");
      return;
    }

    const etaitEnLigne = enLigne;
    const controleAvant = identiteDuControle(article.controleIa);
    occupe = "controle";
    statut = $tr("admin.blog.check.announceStart");
    const signal = attendre(DELAI_DU_CONTROLE_MS);

    let echec = false;
    try {
      const reponse = await apiFetch(`/blog/${article.id}/controle`, {
        method: "POST",
        signal,
        ...(confirme
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmer: true }) }
          : {}),
      });
      if (!reponse.ok) {
        statut = "";
        await montrerErreur(await erreurDeReponse(reponse), "controle");
        echec = true;
      } else {
        const corps: unknown = await reponse.json();
        const relu =
          articleAdminDepuis(corps) ??
          articleAdminDepuis(typeof corps === "object" && corps !== null ? (corps as { post?: unknown }).post : null);
        if (!relu || relu.id !== article.id) {
          statut = "";
          erreur = $tr("admin.blog.err.unexpected");
          echec = true;
        } else {
          // Un contrôle neuf : les cases sont refaites depuis le serveur,
          // même si son `fait_le` (à la seconde) égalait le précédent.
          appliquer(relu, true, true);
          onMisAJour(relu, "enregistre");
          const fini = $tr("admin.blog.check.announceDone").replace("{heure}", heure());
          // Ce que le contrôle a fait de la publication, dit dans tous les cas
          // (revue du front du tour 5 : un article caché revenait en ligne au
          // contrôle suivant, et la fenêtre ne disait que « terminé »).
          const lisible = visibleDuPublic(relu);
          const suite =
            etaitEnLigne && !lisible
              ? "admin.blog.check.leftThePublic"
              : !etaitEnLigne && lisible
                ? "admin.blog.check.backOnline"
                : !etaitEnLigne && relu.isPublished
                  ? "admin.blog.check.stillHidden"
                  : null;
          statut = suite ? `${fini} ${$tr(suite)}` : fini;
        }
      }
    } catch (e) {
      statut = "";
      erreur = messageDErreur(erreurDExecution(e, raisonDArret), $tr, "controle");
      echec = true;
    } finally {
      arreterLAttente();
      occupe = "";
    }
    if (!echec) return;
    await relire();
    // Le serveur a pourtant enregistré un contrôle (réponse perdue en route) :
    // ses verdicts sont là, l'erreur n'est plus vraie.
    if (identiteDuControle(article.controleIa) !== controleAvant && article.controleIa !== null) {
      erreur = "";
      statut = $tr("admin.blog.check.savedDespiteError");
    }
  }

  /**
   * « Reconstruire les sources » (avenant du tour 4) : `POST
   * /blog/{id}/sources` refait la recherche de la génération à partir du titre
   * et du contexte ENREGISTRÉS, garde les citations qu'une source
   * reconstruite porte et retire les autres, avec un avertissement. Une
   * saisie en cours est donc enregistrée d'abord (« Enregistrer et
   * reconstruire ») ; puis le formulaire repart de l'article reconstruit, ses
   * citations ayant pu changer. C'est la première étape du parcours de
   * reprise d'un article d'avant la vérification. Un échec ne perd rien :
   * l'erreur s'affiche et l'article est relu.
   *
   * L'API du tour 4 rend l'article TOUJOURS en brouillon, ses citations que
   * les sources ne portent pas retirées et, si les sources changent, son
   * contrôle effacé : le formulaire repart de lui, cases comprises (aucune
   * ne compte plus contre des sources nouvelles).
   *
   * Réussie, l'étape « sources » est faite et son bouton disparaît : le focus
   * passe à l'étape suivante du parcours, celle qui est désormais en cours
   * (il tombait sur <body>).
   */
  async function reconstruireLesSources() {
    if (occupe) return;
    erreur = "";
    statut = "";
    if (!(await enregistrerAvant())) return;

    const citeesAvant = article.citations.length;
    occupe = "sources";
    statut = $tr("admin.blog.sources.announceStart");
    const signal = attendre(DELAI_DES_SOURCES_MS);
    let echec = false;
    let reussie = false;
    try {
      const reponse = await apiFetch(`/blog/${article.id}/sources`, { method: "POST", signal });
      if (!reponse.ok) {
        statut = "";
        await montrerErreur(await erreurDeReponse(reponse), "sources");
        echec = true;
      } else {
        const resultat = resultatDeReconstruction(await reponse.json());
        if (!resultat || resultat.article.id !== article.id) {
          statut = "";
          erreur = $tr("admin.blog.err.unexpected");
          echec = true;
        } else {
          appliquer(resultat.article, false);
          avertissementsDeReprise = resultat.avertissements;
          onMisAJour(resultat.article, "enregistre");
          const retirees = Math.max(0, citeesAvant - resultat.article.citations.length);
          statut = [
            $tr("admin.blog.sources.done")
              .replace("{heure}", heure())
              .replace("{n}", String(resultat.article.sources.length)),
            retirees > 0 ? $tr("admin.blog.sources.dropped").replace("{n}", String(retirees)) : "",
          ]
            .filter(Boolean)
            .join(" ");
          reussie = true;
        }
      }
    } catch (e) {
      statut = "";
      erreur = messageDErreur(erreurDExecution(e, raisonDArret), $tr, "sources");
      echec = true;
    } finally {
      arreterLAttente();
      occupe = "";
    }
    if (echec) await relire();
    if (reussie) await focaliserLEtapeEnCours();
  }

  /**
   * Le focus sur l'étape en cours du parcours de reprise (ParcoursDeReprise :
   * `etape-<nom>`, `tabindex="-1"`), une fois la fenêtre redessinée.
   */
  async function focaliserLEtapeEnCours() {
    await tick();
    const enCours = etapes.find((e) => e.statut === "en_cours");
    if (enCours) document.getElementById(`etape-${enCours.etape}`)?.focus();
  }

  onDestroy(() => {
    if (controleur) {
      raisonDArret = "admin";
      controleur.abort();
    }
    arreterLAttente();
  });

  // Pendant un envoi, rien ne change dans le formulaire (champs désactivés,
  // citations et cases figées) : la réponse le remplace, et une saisie faite
  // entre-temps était effacée sans un mot (revue du 29/10).
  async function retirerCitation(cle: string) {
    if (occupe) return;
    form.citations = form.citations.filter((c) => c.cle !== cle);
    await tick();
    titreDesCitations?.focus();
  }

  function citer(source: SourceDeGeneration) {
    if (occupe) return;
    form.citations = [...form.citations, citationDepuisSource(source)];
  }

  function cocher(partie: PartieDeRelecture, valeur: boolean) {
    if (occupe) return;
    form.relecture = { ...form.relecture, [partie]: valeur };
    // Relue contre les nouveaux verdicts : elle n'est plus « à relire de nouveau ».
    if (valeur) aRelire = aRelire.filter((p) => p !== partie);
  }

  /**
   * « J'ai vérifié cette phrase dans le texte » (avenant du tour 7) : la
   * phrase de règle confirmée, ou plus, dans l'ordre de l'article
   * (`confirmationsValables`), pour qu'aller et revenir ne compte pas comme
   * une modification. Enregistrée avec le formulaire.
   */
  function confirmer(id: string, valeur: boolean) {
    if (occupe) return;
    const ids = valeur ? [...form.confirmees, id] : form.confirmees.filter((c) => c !== id);
    form.confirmees = confirmationsValables(ids, article.controleIa);
  }

  /** Le numéro d'un extrait, dans un verdict : l'extrait s'ouvre en entier dans le panneau et prend le focus. */
  async function montrerSource(n: number) {
    sourcesOuvertes = true;
    if (!sourcesDepliees.includes(n)) sourcesDepliees = [...sourcesDepliees, n];
    await tick();
    document.getElementById(`source-${n}`)?.focus();
  }

  function deplierSource(n: number, deplie: boolean) {
    sourcesDepliees = deplie ? [...sourcesDepliees, n] : sourcesDepliees.filter((m) => m !== n);
  }

  function changerDeVue(nouvelle: "relecture" | "apercu" | "edition") {
    vue = nouvelle;
  }

  /**
   * Le bouton d'une étape du parcours de reprise : la vue où elle se fait.
   * Pour citer, le volet des sources s'ouvre aussi au téléphone (fermé, ses
   * boutons « Citer » ne se voyaient pas).
   */
  async function allerA(nouvelle: "relecture" | "edition") {
    vue = nouvelle;
    if (nouvelle === "edition") sourcesOuvertes = true;
    await tick();
    document.getElementById("titre-relecture")?.focus();
  }
</script>

<svelte:window on:keydown={surTouche} />

<!--
  Panneau collé en bas sur téléphone, boîte centrée à partir de sm, comme les
  autres fenêtres de l'administration ; plus large au bureau (lg), où les
  sources forment une colonne à droite du texte. Seul le corps défile :
  en-tête et pied restent visibles.
-->
<div
  class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 backdrop-blur-sm sm:items-center sm:p-4"
  role="presentation"
  data-testid="blog-voile"
  on:pointerdown={surAppui}
  on:click={surClicDuVoile}
  use:bloquerDefilement
>
  <div
    class="flex max-h-[calc(100%-1rem)] w-full max-w-3xl flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:max-h-[90%] sm:rounded-2xl lg:max-w-6xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="titre-relecture"
    use:piegerFocus={{ initial: "#titre-relecture" }}
  >
    <!-- En-tête : titre, croix, bascule Relecture / Aperçu / Édition, statut. -->
    <div class="shrink-0 space-y-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800 sm:px-6 sm:py-4">
      <div class="flex items-center justify-between gap-3">
        <h2
          id="titre-relecture"
          tabindex="-1"
          class="min-w-0 text-xl font-bold tracking-tight text-zinc-950 focus:outline-none dark:text-white sm:text-2xl"
        >
          {titreFenetre}
        </h2>
        <button
          type="button"
          on:click={demanderFermeture}
          aria-label={$tr("common.close")}
          class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Icone nom="x" class="h-6 w-6" />
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Trois boutons à bascule (`aria-pressed`), comme les filtres de
             /blog ; leurs icônes à partir de sm, pour tenir à 320 px. -->
        <div
          class="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
          role="group"
          aria-label={$tr("admin.blog.viewSwitch")}
        >
          <button
            type="button"
            aria-pressed={vue === "relecture"}
            on:click={() => changerDeVue("relecture")}
            class="{ONGLET} {vue === 'relecture' ? ONGLET_ACTIF : ONGLET_INACTIF}"
          >
            <Icone nom="circle-check" class="hidden text-base sm:inline-block" />
            {$tr("admin.blog.tabReview")}
          </button>
          <button
            type="button"
            aria-pressed={vue === "apercu"}
            on:click={() => changerDeVue("apercu")}
            class="{ONGLET} {vue === 'apercu' ? ONGLET_ACTIF : ONGLET_INACTIF}"
          >
            <Icone nom="eye" class="hidden text-base sm:inline-block" />
            {$tr("admin.blog.tabPreview")}
          </button>
          <button
            type="button"
            aria-pressed={vue === "edition"}
            on:click={() => changerDeVue("edition")}
            class="{ONGLET} {vue === 'edition' ? ONGLET_ACTIF : ONGLET_INACTIF}"
          >
            <Icone nom="pen-line" class="hidden text-base sm:inline-block" />
            {$tr("admin.blog.tabEdit")}
          </button>
        </div>
        <BadgeDePublication {article} />
        <!-- Le lien public seulement pour un article que le public peut lire :
             celui d'un article publié avant la vérification répond 404. -->
        {#if enLigne}
          <a href={adressePublique} target="_blank" rel="noopener" class={BOUTON_DISCRET}>
            {$tr("admin.blog.view")}
            <Icone nom="external-link" class="text-sm" />
          </a>
        {/if}
      </div>
    </div>

    <!-- Corps. Au téléphone, une seule colonne qui défile : le volet des
         sources, puis le texte. Au bureau (lg), deux colonnes qui défilent
         chacune : le texte, et les sources à droite. -->
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:flex lg:overflow-hidden">
      {#if avecPanneau}
        <aside
          class="border-b border-zinc-200 dark:border-zinc-800 lg:order-last lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-l"
          aria-labelledby="titre-des-sources"
        >
          <PanneauDesSources
            sources={sourcesAffichees}
            citations={article.citations}
            ouvert={sourcesOuvertes}
            deplies={sourcesDepliees}
            edition={vue === "edition"}
            {form}
            occupe={occupe !== ""}
            onOuvrir={(ouvert) => (sourcesOuvertes = ouvert)}
            onDeplier={deplierSource}
            onCiter={citer}
          />
        </aside>
      {/if}

      <div class="min-w-0 space-y-5 p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        <!-- Ce que le serveur et la génération ont relevé, en tête et dans
             les trois vues. Noir et blanc (le rouge est réservé aux erreurs) :
             un cadre épais et l'icône d'alerte le distinguent du reste. -->
        {#if points.length > 0}
          <section
            class="space-y-2 rounded-xl border-2 border-zinc-950 bg-white p-4 dark:border-white dark:bg-zinc-950"
            aria-labelledby="points-a-verifier"
            data-testid="blog-points-a-verifier"
          >
            <h3 id="points-a-verifier" class="flex items-start gap-2 text-sm font-bold text-zinc-950 dark:text-white">
              <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base" />
              {$tr("admin.blog.warningsTitle").replace("{n}", String(points.length))}
            </h3>
            <ul class="list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
              {#each points as point, i (i)}
                <li class="coupe-mots">{point}</li>
              {/each}
            </ul>
            <p class="text-xs text-zinc-600 dark:text-zinc-400">
              {$tr("admin.blog.warningsHelp")}
              {#if modifie}{$tr("admin.blog.warningsStale")}{/if}
            </p>
          </section>
        {/if}

        <!-- Un autre contrôle est arrivé (relancé ici ou ailleurs, ou effacé
             avec les sources) : les parties dont la case est tombée, à relire
             de nouveau contre ses verdicts (avenant du tour 5). Dans les trois
             vues, comme les points à vérifier ; noir et blanc, cadre épais. -->
        {#if partiesARelire.length > 0}
          <section
            class="space-y-1 rounded-xl border-2 border-zinc-950 bg-white p-4 dark:border-white dark:bg-zinc-950"
            aria-labelledby="titre-a-relire"
            data-testid="blog-a-relire"
          >
            <h3 id="titre-a-relire" class="flex items-start gap-2 text-sm font-bold text-zinc-950 dark:text-white">
              <Icone nom="eye" class="mt-0.5 shrink-0 text-base" />
              {$tr("admin.blog.reread.title").replace("{n}", String(partiesARelire.length))}
            </h3>
            <p class="coupe-mots text-sm text-zinc-800 dark:text-zinc-200">
              {$tr("admin.blog.reread.list").replace("{parties}", () => nomsDesParties(partiesARelire, $tr))}
            </p>
            <p class="text-xs text-zinc-600 dark:text-zinc-400">
              {#if article.controleIa}
                {$tr("admin.blog.reread.help").replace("{date}", () => dateEtHeure(article.controleIa?.faitLe ?? "", $language.current))}
              {:else}
                {$tr("admin.blog.reread.helpErased")}
              {/if}
            </p>
          </section>
        {/if}

        <!-- Un article sans sources (publié avant la vérification, ou écrit à
             la main) : le parcours qui le remet en ligne, étape par étape,
             en relecture comme en édition. -->
        {#if enReprise && vue !== "apercu"}
          <ParcoursDeReprise
            {etapes}
            {ancien}
            {vue}
            occupe={occupe !== ""}
            reconstructionEnCours={occupe === "sources"}
            {chrono}
            {modifie}
            phrase={(b) => phraseDuBlocage(b, $tr, enLigne)}
            onReconstruire={reconstruireLesSources}
            onVue={allerA}
          />
        {/if}

        {#if vue === "relecture"}
          <!-- Le contrôle IA : quand, par quel modèle, ce qu'il a trouvé, et
               le bouton pour le relancer, avec son attente. -->
          <section
            class="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
            aria-labelledby="titre-du-controle"
            data-testid="blog-controle"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 space-y-1">
                <h3 id="titre-du-controle" class="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                  <Icone nom="sparkles" class="text-base" />
                  {$tr("admin.blog.check.title")}
                </h3>
                <p class="text-xs text-zinc-600 dark:text-zinc-300" data-testid="blog-controle-date">
                  {#if article.controleIa}
                    {$tr("admin.blog.check.done")
                      .replace("{date}", () => dateEtHeure(article.controleIa?.faitLe ?? "", $language.current))
                      .replace("{modele}", () => article.controleIa?.modele || "?")}
                  {:else}
                    {$tr("admin.blog.check.none")}
                  {/if}
                </p>
                {#if aJour}
                  <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200" data-testid="blog-compte-des-verdicts">
                    {$tr("admin.blog.check.counts")
                      .replace("{a}", String(compte.soutenue))
                      .replace("{b}", String(compte.non_soutenue))
                      .replace("{c}", String(compte.contredite))
                      .replace("{d}", String(compte.hors_sources))}
                  </p>
                  {#if aConfirmerEnTout > 0}
                    <!-- Les phrases de règle à confirmer une à une (avenant du
                         tour 7) : ce qu'il en reste, avant « Publier ». -->
                    <p
                      class="flex items-center gap-1.5 text-xs font-semibold text-zinc-950 dark:text-white"
                      data-testid="blog-a-confirmer"
                    >
                      <Icone nom={confirmeesEnTout < aConfirmerEnTout ? "triangle-alert" : "circle-check"} class="shrink-0 text-sm" />
                      {$tr("admin.blog.check.toConfirm")
                        .replace("{c}", String(confirmeesEnTout))
                        .replace("{n}", String(aConfirmerEnTout))}
                    </p>
                  {/if}
                {:else if article.controleIa}
                  <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200" data-testid="blog-controle-perime">
                    {article.etatPublication === "controle_a_relancer" ? $tr("admin.blog.check.stale") : $tr("admin.blog.check.unsure")}
                  </p>
                {/if}
              </div>
              <button
                type="button"
                class="{BOUTON_SECONDAIRE} sm:shrink-0"
                aria-disabled={occupe || controleBloque ? "true" : undefined}
                aria-describedby={controleBloque
                  ? "controle-bloque"
                  : article.isPublished && occupe !== "controle"
                    ? "controle-publie"
                    : undefined}
                data-testid="blog-relancer-controle"
                on:click={lancerLeControle}
              >
                {#if occupe === "controle"}
                  <Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />
                  {$tr("admin.blog.check.running")}
                  <span class="font-normal tabular-nums" data-testid="blog-controle-chrono">{chrono}</span>
                {:else}
                  <Icone nom="sparkles" class="text-base" />
                  {!enLigne && modifie && controleBloque === null ? $tr("admin.blog.check.saveAndRun") : $tr("admin.blog.check.run")}
                {/if}
              </button>
            </div>
            {#if occupe === "controle"}
              <p class={AIDE}>{$tr("admin.blog.check.waitHint")}</p>
              {#if ecoule >= ATTENTE_LONGUE_DU_CONTROLE_S}
                <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200" data-testid="blog-controle-long">{$tr("admin.blog.waitLong")}</p>
              {/if}
            {/if}
            {#if controleBloque}
              <p id="controle-bloque" class={AIDE}>
                {controleBloque === "sources" ? $tr("admin.blog.check.blockedSources") : $tr("admin.blog.check.blockedPublished")}
              </p>
            {:else if article.isPublished && occupe !== "controle"}
              <!-- Dit AVANT l'appui (avenant du tour 5) : relancer le contrôle
                   d'un article publié peut le retirer du public. -->
              <p id="controle-publie" class={AIDE} data-testid="blog-controle-publie">
                {enLigne ? $tr("admin.blog.check.onlineHint") : $tr("admin.blog.check.hiddenHint")}
              </p>
            {/if}
          </section>

          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200" data-testid="blog-progression">
            {$tr("admin.blog.reviewProgress").replace("{n}", String(relues)).replace("{total}", String(PARTIES_DE_RELECTURE.length))}
            {#if article.relecture.le}
              <span class="block text-xs font-normal text-zinc-600 dark:text-zinc-400">
                {$tr("admin.blog.reviewBy")
                  .replace("{par}", () => article.relecture.par ?? "?")
                  .replace("{le}", () => dateEtHeure(article.relecture.le, $language.current))}
              </span>
            {/if}
          </p>

          <VueDuControle
            {article}
            {form}
            {modifiees}
            {aJour}
            {sourcesConnues}
            sources={sourcesAffichees}
            aRelire={partiesARelire}
            desactive={occupe !== ""}
            onCocher={cocher}
            onConfirmer={confirmer}
            onMontrerSource={montrerSource}
          />
        {:else if vue === "apercu"}
          <!-- L'article tel que le lira le public : le rendu de la page
               publique (CorpsDeLArticle), avec les modifications en cours. -->
          <div class="mx-auto max-w-3xl space-y-5">
            {#if modifie}
              <p class="text-xs font-medium text-zinc-600 dark:text-zinc-300">{$tr("admin.blog.previewUnsaved")}</p>
            {/if}
            <article class="space-y-8" data-testid="blog-apercu">
              <header class="space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {nomRubrique(apercu.category, $language.current)}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Icone nom="bot" class="text-sm" />{$tr("blog.badge.ai")}
                  </span>
                  <span class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {apercu.date ? formatDate(apercu.date, $language.current) : $tr("blog.recently")}&nbsp;· {apercu.readingTime}
                    {$tr("blog.reading")}
                  </span>
                </div>
                <h3 class="text-balance text-2xl/tight font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl/tight">
                  {texteAffiche(apercu.title)}
                </h3>
              </header>
              <CorpsDeLArticle post={apercu} apercu decalage={2} prefixe="apercu-citation" />
            </article>
          </div>
        {:else}
          <!-- Un groupe désactivé pendant un envoi (`occupe`) : la réponse
               remplace le formulaire, et ce qui y serait saisi entre-temps
               serait perdu (voir `retirerCitation`). `min-w-0` : un fieldset
               garde sinon la largeur minimale de son contenu, et déborderait
               au téléphone. -->
          <fieldset class="min-w-0 space-y-4" data-testid="blog-edition" disabled={occupe !== ""}>
            <div>
              <label for="ed-title" class={LIBELLE}>{libelle("titre")} <span aria-hidden="true">*</span></label>
              <input id="ed-title" type="text" bind:value={form.titre} maxlength={500} aria-invalid={invalide("titre", invalides)} class={CHAMP} />
            </div>
            <!-- Une colonne sur téléphone : à deux, chaque champ n'y gardait
                 qu'environ 136 px à 320 px de large. -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="ed-cat" class={LIBELLE}>{libelle("rubrique")} <span aria-hidden="true">*</span></label>
                <input id="ed-cat" type="text" bind:value={form.rubrique} maxlength={100} aria-invalid={invalide("rubrique", invalides)} class={CHAMP} />
              </div>
              <div>
                <label for="ed-time" class={LIBELLE}>{libelle("duree")}</label>
                <input id="ed-time" type="text" bind:value={form.duree} maxlength={50} class={CHAMP} />
              </div>
            </div>
            <div>
              <label for="ed-slug" class={LIBELLE}>{libelle("slug")}</label>
              <input
                id="ed-slug"
                type="text"
                bind:value={form.slug}
                maxlength={255}
                autocomplete="off"
                spellcheck="false"
                aria-invalid={invalide("slug", invalides)}
                aria-describedby="ed-slug-aide"
                class="{CHAMP} font-mono"
              />
              <p id="ed-slug-aide" class={AIDE}>{$tr("admin.blog.slugHint")}</p>
            </div>
            <div>
              <label for="ed-ctx" class={LIBELLE}>{libelle("contexte")} <span aria-hidden="true">*</span></label>
              <textarea id="ed-ctx" bind:value={form.contexte} rows="3" aria-invalid={invalide("contexte", invalides)} class="{CHAMP} resize-y"></textarea>
            </div>
            <div>
              <label for="ed-sum" class={LIBELLE}>{libelle("resume")} <span aria-hidden="true">*</span></label>
              <textarea id="ed-sum" bind:value={form.resume} rows="4" aria-invalid={invalide("resume", invalides)} class="{CHAMP} resize-y"></textarea>
            </div>
            <div>
              <label for="ed-kp" class={LIBELLE}>{libelle("pointsCles")}</label>
              <textarea id="ed-kp" bind:value={form.pointsCles} rows="4" aria-describedby="ed-kp-aide" class="{CHAMP} resize-y"></textarea>
              <p id="ed-kp-aide" class={AIDE}>{$tr("admin.blog.keyPointsHint")}</p>
            </div>

            <!-- Les citations : retirer, ou réécrire l'explication. Le texte,
                 l'article et l'extrait viennent de la base (contrat du 29/10) :
                 rien ne se tape à la main. Une citation NON VÉRIFIÉE
                 (`citationBruteVerifiee`, la règle de la page publique) dit
                 « Citation non vérifiée » et ne montre pas son extrait. La
                 légende reçoit le focus après le retrait d'une citation : le
                 bouton « Retirer » disparaît avec elle. -->
            <fieldset class="space-y-3">
              <legend
                bind:this={titreDesCitations}
                tabindex="-1"
                class="mb-1 text-sm font-medium text-zinc-800 focus:outline-none dark:text-zinc-200"
              >
                {$tr("admin.blog.citationsField").replace("{n}", String(form.citations.length))}
              </legend>
              <p class={AIDE}>{$tr("admin.blog.citationsHelp")}</p>
              {#if form.citations.length === 0}
                <p class="text-sm text-zinc-600 dark:text-zinc-300">{$tr("admin.blog.noCitations")}</p>
              {/if}
              <ul class="space-y-3">
                {#each form.citations as citation (citation.cle)}
                  {@const verifiee = citationBruteVerifiee(citation.origine)}
                  {@const extrait = verifiee && typeof citation.origine.excerpt === "string" ? citation.origine.excerpt : ""}
                  <li
                    class="space-y-2 rounded-xl border p-3 {verifiee
                      ? 'border-zinc-200 dark:border-zinc-700'
                      : 'border-dashed border-zinc-400 dark:border-zinc-500'}"
                    data-testid="blog-citation"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p id="nom-{citation.cle}" class="coupe-mots text-sm font-semibold text-zinc-950 dark:text-white">
                        {nomDeCitation(citation.origine, $tr)}
                      </p>
                      <span
                        data-testid="blog-citation-etat"
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium {verifiee
                          ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                          : 'border-dashed border-zinc-400 text-zinc-700 dark:border-zinc-500 dark:text-zinc-300'}"
                      >
                        <Icone nom={verifiee ? "check" : "triangle-alert"} class="text-sm" />
                        {verifiee ? $tr("admin.blog.citationVerified") : $tr("blog.unverifiedCitation")}
                      </span>
                    </div>
                    {#if extrait}
                      <blockquote class="line-clamp-3 border-l-2 border-zinc-300 pl-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        « {extrait} »
                      </blockquote>
                    {:else if !verifiee}
                      <p class={AIDE}>{$tr("admin.blog.citationUnverifiedHint")}</p>
                    {/if}
                    <!-- 500 caractères, la limite du serveur (génération et
                         CitationIn) : au-delà, une phrase coupée (« … sauf en
                         cas de ») pourrait dire le contraire de ce qu'on a
                         écrit. À 300 (tour 2), une explication générée de 301
                         à 500 caractères ne se complétait plus sans être
                         raccourcie d'abord (revue du tour 3). -->
                    <div>
                      <label for="expl-{citation.cle}" class={LIBELLE}>{$tr("admin.blog.citationExplanation")}</label>
                      <textarea
                        id="expl-{citation.cle}"
                        bind:value={citation.explication}
                        rows="2"
                        maxlength={500}
                        aria-describedby="nom-{citation.cle}"
                        class="{CHAMP} resize-y"
                      ></textarea>
                    </div>
                    <button
                      type="button"
                      on:click={() => retirerCitation(citation.cle)}
                      aria-describedby="nom-{citation.cle}"
                      class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Icone nom="trash" class="text-sm" />
                      {$tr("admin.blog.citationRemove")}
                    </button>
                  </li>
                {/each}
              </ul>
            </fieldset>

            <div>
              <label for="ed-ci" class={LIBELLE}>{libelle("impact")} <span aria-hidden="true">*</span></label>
              <textarea id="ed-ci" bind:value={form.impact} rows="3" aria-invalid={invalide("impact", invalides)} class="{CHAMP} resize-y"></textarea>
            </div>
            <div>
              <label for="ed-sq" class={LIBELLE}>{libelle("question")}</label>
              <input id="ed-sq" type="text" bind:value={form.question} maxlength={500} class={CHAMP} />
            </div>
            <div>
              <label for="ed-tags" class={LIBELLE}>{libelle("motsCles")}</label>
              <input id="ed-tags" type="text" bind:value={form.motsCles} aria-describedby="ed-tags-aide" class={CHAMP} />
              <p id="ed-tags-aide" class={AIDE}>{$tr("admin.blog.tagsHint")}</p>
            </div>
          </fieldset>
        {/if}
      </div>
    </div>

    <!-- Pied toujours visible, au-dessus de la barre d'accueil de l'iPhone
         (zone sûre). L'erreur s'affiche ICI, au-dessus des boutons : posée
         dans la page, elle restait sous le voile, invisible, et hors de la
         boîte aria-modal (revue du 29/10). Les raisons qui empêchent de
         publier sont juste au-dessus du bouton « Publier », qui les nomme
         (`aria-describedby`). -->
    <div class="shrink-0 border-t border-zinc-200 pb-zone-sure dark:border-zinc-800">
      <div class="space-y-2 px-4 py-3 sm:space-y-3 sm:px-6 sm:py-4">
        {#if erreur}
          <div
            role="alert"
            data-testid="blog-fenetre-erreur"
            class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <Icone nom="circle-alert" class="mt-0.5 shrink-0 text-base" />
            <p class="coupe-mots min-w-0">{erreur}</p>
          </div>
        {/if}

        {#if blocages.length > 0}
          <div
            bind:this={blocDesRaisons}
            id="raisons-de-blocage"
            tabindex="-1"
            data-testid="blog-blocages"
            class="rounded-xl border border-dashed border-zinc-400 px-3 py-2 text-xs text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:border-zinc-500 dark:text-zinc-200 dark:focus-visible:ring-white"
          >
            <!-- Le titre à partir de sm : au téléphone, chaque ligne de pied
                 compte, et la liste se lit seule à côté de « Publier ». -->
            <p class="hidden font-semibold sm:block">{$tr("admin.blog.blockedTitle")}</p>
            <ul class="list-disc space-y-0.5 pl-4 sm:mt-0.5">
              {#each raisons as raison, i (i)}
                <li class="coupe-mots">{raison}</li>
              {/each}
            </ul>
          </div>
        {:else if !enLigne || modifie}
          <!-- Plus rien n'empêche de publier : le dire, pour que le bouton
               qui s'active ne surprenne pas. -->
          <p class="flex items-start gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200" data-testid="blog-publiable">
            <Icone nom="circle-check" class="mt-px shrink-0 text-sm" />
            {$tr("admin.blog.publishable")}
          </p>
        {/if}

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p role="status" class="min-w-0 text-xs text-zinc-600 dark:text-zinc-300" data-testid="blog-fenetre-statut">
            {#if statut}
              {statut}
            {:else if modifie}
              {enLigne ? $tr("admin.blog.unsavedPublished") : $tr("admin.blog.unsaved")}
            {:else}
              <!-- Au téléphone, le badge de l'en-tête dit déjà l'état : la
                   phrase y prendrait deux lignes au corps de la fenêtre. -->
              <span class="hidden sm:inline">
                {article.isPublished
                  ? enLigne
                    ? $tr("admin.blog.statusPublished")
                    : $tr("admin.blog.statusHidden")
                  : $tr("admin.blog.statusDraft")}
              </span>
            {/if}
          </p>
          <!-- Un article que le public lit : le retirer, ou publier ses
               modifications en un envoi. Tout autre article, brouillon ou
               caché du public (publié dans la base mais non publiable, comme
               ceux d'avant la vérification) : l'enregistrer en brouillon, ou
               le publier. « Retirer du site » ne voulait rien dire d'un
               article que le site ne montre pas, et y obligeait pourtant
               avant toute correction. -->
          <div class="flex gap-2 sm:shrink-0 sm:gap-3">
            {#if enLigne}
              <button type="button" class={BOUTON_SECONDAIRE} aria-disabled={occupe ? "true" : undefined} on:click={retirer}>
                {#if occupe === "retrait"}<Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />{/if}
                {$tr("admin.blog.unpublish")}
              </button>
              <button
                type="button"
                class={BOUTON_PRINCIPAL}
                aria-disabled={occupe || blocages.length > 0 ? "true" : undefined}
                aria-describedby={blocages.length > 0 ? "raisons-de-blocage" : undefined}
                on:click={publier}
              >
                {#if occupe === "publication"}<Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />{/if}
                {$tr("admin.blog.publishChanges")}
              </button>
            {:else}
              <button type="button" class={BOUTON_SECONDAIRE} aria-disabled={occupe ? "true" : undefined} on:click={enregistrer}>
                {#if occupe === "enregistrement"}<Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />{/if}
                {$tr("admin.blog.saveDraft")}
              </button>
              <button
                type="button"
                class={BOUTON_PRINCIPAL}
                aria-disabled={occupe || blocages.length > 0 ? "true" : undefined}
                aria-describedby={blocages.length > 0 ? "raisons-de-blocage" : undefined}
                on:click={publier}
              >
                {#if occupe === "publication"}<Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />{/if}
                {$tr("admin.blog.publish")}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
