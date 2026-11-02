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
  import { PARTIES_DE_RELECTURE, compteDesVerdicts, type PartieDeRelecture } from "./controle";
  import {
    DELAI_DE_GENERATION_MS,
    erreurDeReponse,
    erreurDExecution,
    messageDErreur,
    type Action,
    type ErreurDuBlog,
  } from "./erreurs";
  import PanneauDesSources from "./PanneauDesSources.svelte";
  import {
    articleAdminDepuis,
    articleDuFormulaire,
    blocagesDePublication,
    champsManquants,
    citationDepuisSource,
    controleAJour,
    corpsDeLaModification,
    empreinte,
    formulaireDepuis,
    nomDeCitation,
    partieRelue,
    partiesModifiees,
    pointsAVerifier,
    visibleDuPublic,
    type ArticleAdmin,
    type Blocage,
    type ChampDuFormulaire,
    type SourceDeGeneration,
  } from "./relecture";
  import VueDuControle from "./VueDuControle.svelte";

  export let article: ArticleAdmin;
  /** Les extraits retrouvés à la génération (vide pour un article plus ancien, ou après un rechargement). */
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
    "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 dark:aria-[invalid=true]:border-red-400 dark:aria-[invalid=true]:ring-red-400 sm:[@media(pointer:fine)]:text-sm";
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
  let occupe: "" | "enregistrement" | "publication" | "retrait" | "controle" = "";
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
  /** Le contrôle IA en cours : temps écoulé, requête, délai du client. */
  let ecouleControle = 0;
  let minuterieControle: ReturnType<typeof setInterval> | undefined;
  let delaiControle: ReturnType<typeof setTimeout> | undefined;
  let controleur: AbortController | null = null;
  let raisonDArret: "admin" | "delai" | null = null;

  $: modifie = empreinte(form) !== empreinteEnregistree;
  $: modifiees = partiesModifiees(form, article);
  $: blocages = blocagesDePublication(form, article);
  $: raisons = blocages.map((b) => phraseDuBlocage(b, $tr, article.isPublished));
  $: aJour = controleAJour(article);
  $: compte = compteDesVerdicts(article.controleIa);
  $: relues = PARTIES_DE_RELECTURE.filter((p: PartieDeRelecture) => partieRelue(form, p, modifiees)).length;
  $: points = pointsAVerifier(
    article.avertissements,
    form.citations.map((c) => c.origine),
    $tr,
    avertissementsDeGeneration,
  );
  $: apercu = articleDuFormulaire(form, article);
  $: titreFenetre =
    vue === "relecture"
      ? $tr("admin.blog.reviewDialogTitle")
      : vue === "apercu"
        ? $tr("admin.blog.previewDialogTitle")
        : $tr("admin.blog.editTitle");
  $: enLigne = visibleDuPublic(article);
  $: adressePublique = `/blog/${encodeURIComponent(article.slug)}`;
  // Le panneau des sources accompagne la relecture et l'édition ; l'aperçu
  // montre l'article comme le public, sans lui.
  $: avecPanneau = vue !== "apercu";
  $: sourcesConnues = sources.map((s) => s.n);
  // Un article en ligne dont la saisie change le texte relu : le contrôle
  // porterait sur l'ancien texte, et l'enregistrer le retirerait du site.
  $: controleBloque = article.isPublished && modifiees.length > 0;
  $: chronoControle = `${Math.floor(ecouleControle / 60)}:${String(ecouleControle % 60).padStart(2, "0")}`;

  const libelle = (champ: ChampDuFormulaire) => $tr(CHAMPS[champ].cle);
  const invalide = (champ: ChampDuFormulaire, liste: ChampDuFormulaire[]) => (liste.includes(champ) ? "true" : undefined);

  /** Ce qui empêche de publier, en une phrase qui dit quoi faire. */
  function phraseDuBlocage(blocage: Blocage, t: (cle: string) => string, publieDansLaBase: boolean): string {
    switch (blocage.code) {
      case "citations_non_verifiees":
        return t("admin.blog.blocked.citations").replace("{n}", String(blocage.n));
      case "controle_a_relancer":
        if (blocage.cause === "absent") return t("admin.blog.blocked.checkMissing");
        if (blocage.cause === "perime") return t("admin.blog.blocked.checkStale");
        return t(publieDansLaBase ? "admin.blog.blocked.checkEditedPublished" : "admin.blog.blocked.checkEdited");
      case "phrases_contredites":
        return t("admin.blog.blocked.contradicted").replace("{n}", String(blocage.n));
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
    if (cause.code === "slug_pris") return signalerChamps(["slug"], messageDErreur(cause, $tr, action));
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
   */
  function appliquer(relu: ArticleAdmin, garderLaSaisie: boolean) {
    const saisieEnCours = garderLaSaisie && empreinte(form) !== empreinteEnregistree;
    const formulaireEnregistre = formulaireDepuis(relu);
    article = relu;
    if (!saisieEnCours) form = formulaireEnregistre;
    empreinteEnregistree = empreinte(formulaireEnregistre);
    invalides = [];
  }

  /**
   * `PUT /blog/{id}` avec `corps`. Rend l'article enregistré, ou `null` après
   * avoir affiché l'erreur DANS la fenêtre.
   */
  async function envoyer(corps: Record<string, unknown>, garderLaSaisie = false): Promise<ArticleAdmin | null> {
    try {
      const reponse = await apiFetch(`/blog/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) {
        await montrerErreur(await erreurDeReponse(reponse));
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
   */
  async function relire() {
    try {
      const reponse = await apiFetch(`/blog/admin/${article.id}`);
      if (!reponse.ok) return;
      const relu = articleAdminDepuis(await reponse.json());
      if (!relu || relu.id !== article.id) return;
      const etaitPublie = article.isPublished;
      appliquer(relu, true);
      if (etaitPublie && !relu.isPublished) {
        statut = $tr("admin.blog.unpublishedKeepEdits");
        onMisAJour(relu, "retire");
      } else {
        onMisAJour(relu, "enregistre");
      }
    } catch {
      // Rien de plus à dire que l'erreur déjà affichée.
    }
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
    try {
      const enregistre = await envoyer(corpsDeLaModification(form, article, false));
      if (enregistre) {
        statut = $tr("admin.blog.saved").replace("{heure}", heure());
        onMisAJour(enregistre, "enregistre");
      }
    } finally {
      occupe = "";
    }
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
    if (article.isPublished && !modifie) {
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
    if (refuse) await relire();
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

  function arreterLeControle() {
    clearInterval(minuterieControle);
    clearTimeout(delaiControle);
    minuterieControle = undefined;
    delaiControle = undefined;
    controleur = null;
  }

  /**
   * « Relancer le contrôle IA » : `POST /blog/{id}/controle`, qui juge le
   * texte ENREGISTRÉ et rend l'article. Un brouillon modifié est donc
   * enregistré d'abord (« Enregistrer et relancer ») ; un article en ligne
   * modifié ne l'est pas, puisque l'enregistrer le retirerait du site : le
   * bouton dit d'abord de le retirer. Pendant l'attente, le formulaire est
   * figé et le temps écoulé s'affiche ; le client abandonne au bout de 160 s.
   * Un échec ne perd rien (contrat) : l'erreur s'affiche et l'article est
   * relu, le serveur faisant foi sur ce qu'il garde du contrôle.
   */
  async function lancerLeControle() {
    if (occupe || controleBloque) return;
    erreur = "";
    statut = "";
    if (!article.isPublished && modifie) {
      if (champsVides()) return;
      occupe = "enregistrement";
      let enregistre: ArticleAdmin | null = null;
      try {
        enregistre = await envoyer(corpsDeLaModification(form, article, false));
      } finally {
        occupe = "";
      }
      if (!enregistre) return;
      onMisAJour(enregistre, "enregistre");
    }

    occupe = "controle";
    statut = $tr("admin.blog.check.announceStart");
    ecouleControle = 0;
    const debut = Date.now();
    minuterieControle = setInterval(() => {
      ecouleControle = Math.floor((Date.now() - debut) / 1000);
    }, 1000);
    const actuel = new AbortController();
    controleur = actuel;
    raisonDArret = null;
    delaiControle = setTimeout(() => {
      raisonDArret = "delai";
      actuel.abort();
    }, DELAI_DE_GENERATION_MS);

    let echec = false;
    try {
      const reponse = await apiFetch(`/blog/${article.id}/controle`, { method: "POST", signal: actuel.signal });
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
          appliquer(relu, true);
          onMisAJour(relu, "enregistre");
          statut = $tr("admin.blog.check.announceDone").replace("{heure}", heure());
        }
      }
    } catch (e) {
      statut = "";
      erreur = messageDErreur(erreurDExecution(e, raisonDArret), $tr, "controle");
      echec = true;
    } finally {
      arreterLeControle();
      occupe = "";
    }
    if (echec) await relire();
  }

  onDestroy(() => {
    if (controleur) {
      raisonDArret = "admin";
      controleur.abort();
    }
    arreterLeControle();
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
            {sources}
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
                aria-describedby={controleBloque ? "controle-bloque" : undefined}
                data-testid="blog-relancer-controle"
                on:click={lancerLeControle}
              >
                {#if occupe === "controle"}
                  <Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />
                  {$tr("admin.blog.check.running")}
                  <span class="font-normal tabular-nums" data-testid="blog-controle-chrono">{chronoControle}</span>
                {:else}
                  <Icone nom="sparkles" class="text-base" />
                  {!article.isPublished && modifie ? $tr("admin.blog.check.saveAndRun") : $tr("admin.blog.check.run")}
                {/if}
              </button>
            </div>
            {#if occupe === "controle"}
              <p class={AIDE}>{$tr("admin.blog.check.waitHint")}</p>
            {/if}
            {#if controleBloque}
              <p id="controle-bloque" class={AIDE}>{$tr("admin.blog.check.blockedPublished")}</p>
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
            desactive={occupe !== ""}
            onCocher={cocher}
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
                    <!-- 300 caractères : au-delà, une phrase coupée par le
                         serveur (« … sauf en cas de ») pourrait dire le
                         contraire de ce qu'on a écrit. -->
                    <div>
                      <label for="expl-{citation.cle}" class={LIBELLE}>{$tr("admin.blog.citationExplanation")}</label>
                      <textarea
                        id="expl-{citation.cle}"
                        bind:value={citation.explication}
                        rows="2"
                        maxlength={300}
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
        {:else if !article.isPublished || modifie}
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
              {article.isPublished ? $tr("admin.blog.unsavedPublished") : $tr("admin.blog.unsaved")}
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
          <div class="flex gap-2 sm:shrink-0 sm:gap-3">
            {#if article.isPublished}
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
