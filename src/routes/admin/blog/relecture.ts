/**
 * La relecture d'un article du blog dans l'administration : l'article tel que
 * le rend l'API, le formulaire qui le modifie, et ce qu'il faut vérifier avant
 * de le publier.
 *
 * POURQUOI CE MODULE. La fenêtre d'édition d'avant ne couvrait ni les
 * citations, ni l'adresse, ni la durée de lecture, et enregistrait un titre
 * vide ; l'article généré, lui, partait en ligne en un clic, sans relecture
 * (revue du 29/10). Le contrat du 29/10 enregistre chaque génération en
 * BROUILLON : l'administrateur le relit, corrige tout, citations comprises,
 * puis publie. Les règles de cette relecture sont ici, sans composant, pour
 * être vérifiées par des tests simples (relecture.test.ts).
 */

import {
  articleDepuisLApi,
  articleNomme,
  citationBruteVerifiee,
  cleDExplication,
  etatDePublication,
  listeDeTextes,
  referenceAffichable,
  type BlogPost,
  type CleDExplication,
  type EtatDePublication,
} from '$lib/data/blog';
import {
  PARTIES_DE_RELECTURE,
  PARTIE_DE_RELECTURE,
  compteDesVerdicts,
  confirmationsValables,
  controleDepuis,
  identiteDuControle,
  phrasesAConfirmer,
  relectureDepuis,
  relectureVide,
  type ControleIA,
  type PartieDeRelecture,
  type PhraseControlee,
  type Relecture,
} from './controle';

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
const chaine = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Un article vu par l'administration (`GET /blog/admin/all`, `PUT`, génération). */
export interface ArticleAdmin {
  id: number;
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  readingTime: string;
  context: string;
  summary: string;
  keyPoints: string[];
  /**
   * Les citations TELLES QUE L'API LES REND, champs inconnus compris : la
   * fenêtre les renvoie telles quelles, seule l'explication modifiée. Le
   * texte, l'article et l'extrait viennent de la base (contrat du 29/10) et
   * ne se tapent jamais à la main.
   */
  citations: Objet[];
  citizenImpact: string;
  suggestedQuestion: string;
  tags: string[];
  isPublished: boolean;
  /**
   * Ce que le serveur a relevé dans le texte : un article ou un texte
   * mentionné qu'aucun extrait ne porte (lecture des citations du chat).
   */
  avertissements: string[];
  /** Le contrôle IA du texte (contrat du 30/10), ou `null` s'il n'a pas été fait ou n'a pas abouti. */
  controleIa: ControleIA | null;
  /** Les parties cochées par l'administrateur, et qui l'a enregistré. */
  relecture: Relecture;
  /**
   * L'état de publication calculé par le serveur ; `null` s'il manque, ce
   * qui n'est jamais un accord pour publier.
   */
  etatPublication: EtatDePublication | null;
  /**
   * Les extraits remis au modèle, GARDÉS AVEC L'ARTICLE (avenant du tour 4) :
   * le serveur les enregistre à la génération et les rend à chaque lecture
   * de l'administration. Ce sont les numéros des verdicts du contrôle
   * (« Soutenue par l'extrait 3 »). Vide pour un article qui n'en a pas
   * (d'avant la vérification, ou écrit à la main) : état « sources_absentes ».
   *
   * POURQUOI (revue du tour 3). Le front ne les connaissait que pendant la
   * visite de la génération : un brouillon rouvert le lendemain, ou par un
   * autre administrateur, affichait « Contredite par l'extrait 5 » sans
   * l'extrait 5 nulle part. La relecture CONTRE LES SOURCES, obligatoire,
   * devenait impossible.
   */
  sources: SourceDeGeneration[];
}

/** Un article de l'administration, lu défensivement ; `null` sans identifiant. */
export function articleAdminDepuis(brut: unknown): ArticleAdmin | null {
  if (!estObjet(brut)) return null;
  const id = Number(brut.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const analyse: Objet = estObjet(brut.botAnalysis) ? brut.botAnalysis : estObjet(brut.bot_analysis) ? brut.bot_analysis : {};
  return {
    id,
    slug: chaine(brut.slug),
    title: chaine(brut.title),
    category: chaine(brut.category),
    publishedAt: chaine(brut.publishedAt ?? brut.published_at),
    readingTime: chaine(brut.readingTime ?? brut.reading_time),
    context: chaine(brut.context),
    summary: chaine(analyse.summary),
    keyPoints: listeDeTextes(analyse.keyPoints ?? analyse.key_points),
    citations: Array.isArray(analyse.citations) ? analyse.citations.filter(estObjet) : [],
    citizenImpact: chaine(analyse.citizenImpact ?? analyse.citizen_impact),
    suggestedQuestion: chaine(brut.suggestedQuestion ?? brut.suggested_question),
    tags: listeDeTextes(brut.tags),
    isPublished: brut.isPublished === true || brut.is_published === true,
    avertissements: listeDeTextes(brut.avertissements),
    controleIa: controleDepuis(brut.controle_ia ?? brut.controleIa),
    relecture: relectureDepuis(brut.relecture),
    etatPublication: etatDePublication(brut.etat_publication ?? brut.etatPublication),
    sources: sourcesDepuis(brut.sources),
  };
}

/** La liste de `GET /blog/admin/all`, ou `null` si ce n'est pas une liste. */
export function articlesAdminDepuis(brut: unknown): ArticleAdmin[] | null {
  if (!Array.isArray(brut)) return null;
  return brut.map(articleAdminDepuis).filter((a): a is ArticleAdmin => a !== null);
}

/**
 * Un extrait retrouvé pour un article : remis au modèle à la génération
 * (`POST /blog/generate`), ou retrouvé par la même recherche quand
 * l'administration reconstruit les sources (`POST /blog/{id}/sources`). Gardé
 * avec l'article (`ArticleAdmin.sources`).
 */
export interface SourceDeGeneration {
  n: number;
  lawId: number;
  lawTitle: string;
  articleNumber: string;
  articleId: number | null;
  /** L'extrait est la suite de l'article, pas son début (« Article 39 (suite) »). */
  suite: boolean;
  extrait: string;
}

export function sourcesDepuis(brut: unknown): SourceDeGeneration[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(estObjet).map((s, i) => {
    const n = Number(s.n);
    const lawId = Number(s.law_id ?? s.lawId);
    const articleId = Number(s.article_id ?? s.articleId);
    return {
      n: Number.isInteger(n) ? n : i + 1,
      lawId: Number.isInteger(lawId) ? lawId : 0,
      lawTitle: chaine(s.law_title ?? s.lawTitle),
      articleNumber: chaine(s.article_number ?? s.articleNumber),
      articleId: Number.isInteger(articleId) && articleId > 0 ? articleId : null,
      suite: s.suite === true,
      extrait: chaine(s.extrait ?? s.excerpt),
    };
  });
}

/** Le résultat d'une génération : le brouillon ENREGISTRÉ, ses sources et ses avertissements. */
export interface ResultatDeGeneration {
  article: ArticleAdmin;
  sources: SourceDeGeneration[];
  /**
   * Ce que SEULE la génération a relevé : une cote interne retirée, une
   * citation écartée, un passage de la base qui porte l'en-tête d'autres
   * articles que celui qu'il cite… L'API ne les stocke pas, et `post.avertissements`
   * est recalculé à chaque lecture sans eux : gardés à part, pour la visite,
   * comme les sources (revue du 29/10 : ils disparaissaient au premier
   * enregistrement, avant la confirmation de publication).
   */
  avertissementsDeGeneration: string[];
}

/**
 * La réponse de `POST /blog/generate` (201 `{post, sources, avertissements}`),
 * ou `null` si elle n'a pas cette forme. Une API d'avant le contrat rendait
 * l'article généré SANS l'enregistrer (le front le publiait ensuite d'un
 * clic) : sans `post` identifié, rien n'est montré comme un brouillon.
 * Les avertissements de la réponse qui ne sont pas déjà ceux de l'article
 * sont ceux de la génération (`avertissementsDeGeneration`).
 */
export function resultatDeGeneration(brut: unknown): ResultatDeGeneration | null {
  if (!estObjet(brut)) return null;
  const lu = articleAdminDepuis(brut.post);
  if (!lu) return null;
  // Les sources de la réponse sont celles que l'article garde (avenant du
  // tour 4) ; si `post` ne les portait pas, l'article les prend d'ici.
  const deLaReponse = sourcesDepuis(brut.sources);
  const article = lu.sources.length > 0 || deLaReponse.length === 0 ? lu : { ...lu, sources: deLaReponse };
  const avertissementsDeGeneration = [...new Set(listeDeTextes(brut.avertissements))].filter(
    (a) => !article.avertissements.includes(a),
  );
  return { article, sources: deLaReponse.length > 0 ? deLaReponse : article.sources, avertissementsDeGeneration };
}

/** La réponse de `POST /blog/{id}/sources` : l'article aux sources reconstruites, et ce que la reconstruction a relevé. */
export interface ResultatDeReconstruction {
  article: ArticleAdmin;
  /**
   * Ce que SEULE la reconstruction a relevé : une citation retirée parce
   * qu'aucune source reconstruite ne la porte. Sans ceux de l'article.
   */
  avertissements: string[];
}

/**
 * La réponse de `POST /blog/{id}/sources` (avenant du tour 4). L'API du tour 4
 * rend 200 `{post, sources, avertissements}`, la forme de la génération :
 * `post` repassé en brouillon, ses citations que les sources ne portent pas
 * retirées, son contrôle effacé si les sources ont changé ; `avertissements`,
 * ce que la reconstruction a relevé (une citation retirée, le contrôle
 * effacé, le retour en brouillon), puis ceux de l'article, déjà dans
 * `post.avertissements` et donc écartés ici. L'article seul, comme `POST
 * /blog/{id}/controle`, se lit aussi. `null` sans article identifié : rien
 * n'est alors montré comme reconstruit.
 */
export function resultatDeReconstruction(brut: unknown): ResultatDeReconstruction | null {
  if (!estObjet(brut)) return null;
  const direct = articleAdminDepuis(brut);
  const lu = direct ?? articleAdminDepuis(brut.post);
  if (!lu) return null;
  const deLaReponse = direct ? [] : sourcesDepuis(brut.sources);
  const article = lu.sources.length > 0 || deLaReponse.length === 0 ? lu : { ...lu, sources: deLaReponse };
  const avertissements = direct
    ? []
    : [...new Set(listeDeTextes(brut.avertissements))].filter((a) => !article.avertissements.includes(a));
  return { article, avertissements };
}

/* -------------------------------------------------------------------------- */
/* Le formulaire de relecture                                                  */
/* -------------------------------------------------------------------------- */

export interface CitationEditable {
  /** Clé stable du bloc `#each` (une citation retirée ne décale pas les autres). */
  cle: string;
  /** La citation telle que l'API l'a rendue, renvoyée telle quelle. */
  origine: Objet;
  /** Le champ où vit son explication (`explication`, `explanation` ou `title`). */
  champ: CleDExplication;
  explication: string;
  /**
   * Citée pendant cette relecture, depuis une source (« Citer »), et pas
   * encore enregistrée : le serveur ne l'a pas encore vérifiée. Ce n'est pas
   * une citation à RETIRER, mais à enregistrer. Jamais envoyé au serveur.
   */
  ajoutee: boolean;
}

export interface Formulaire {
  titre: string;
  slug: string;
  rubrique: string;
  duree: string;
  contexte: string;
  resume: string;
  /** Un point clé par ligne. */
  pointsCles: string;
  impact: string;
  question: string;
  /** Séparés par des virgules. */
  motsCles: string;
  citations: CitationEditable[];
  /**
   * Les cases « J'ai relu cette partie contre les sources », telles que
   * l'administrateur les a cochées (enregistrées avec le reste du formulaire).
   */
  relecture: Record<PartieDeRelecture, boolean>;
  /**
   * Les phrases de règle que l'administrateur a confirmées une à une (« J'ai
   * vérifié cette phrase dans le texte », avenant du tour 7) : les `id` des
   * phrases du contrôle affiché, dans l'ordre de l'article
   * (`confirmationsValables`). Enregistrées avec le reste du formulaire.
   */
  confirmees: string[];
}

export type ChampDuFormulaire = Exclude<keyof Formulaire, 'citations' | 'relecture' | 'confirmees'>;

let compteur = 0;
const nouvelleCle = () => `citation-${++compteur}`;

export function citationEditable(origine: Objet, ajoutee = false): CitationEditable {
  const champ = cleDExplication(origine);
  return { cle: nouvelleCle(), origine, champ, explication: chaine(origine[champ]), ajoutee };
}

export function formulaireDepuis(article: ArticleAdmin): Formulaire {
  return {
    titre: article.title,
    slug: article.slug,
    rubrique: article.category,
    duree: article.readingTime,
    contexte: article.context,
    resume: article.summary,
    // Un point par ligne : le retour à la ligne INTERNE d'un point (le
    // serveur le garde, texte_brut) devient une espace. Joint tel quel, il
    // faisait de ce point deux points au premier enregistrement (revue du
    // 29/10) : « Pas d'expulsion : » et « sauf décision de justice. »,
    // séparés, ne disent plus la même règle. La page publique l'affichait
    // déjà ainsi : un point clé n'y garde pas ses retours à la ligne.
    pointsCles: article.keyPoints.map((p) => p.replace(/\s*\n\s*/g, ' ')).join('\n'),
    impact: article.citizenImpact,
    question: article.suggestedQuestion,
    motsCles: article.tags.join(', '),
    // Pas `map(citationEditable)` : l'indice deviendrait `ajoutee`.
    citations: article.citations.map((c) => citationEditable(c)),
    relecture: { ...article.relecture.parties },
    confirmees: confirmationsValables(article.relecture.phrasesConfirmees, article.controleIa),
  };
}

const lignes = (texte: string) =>
  texte
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const motsCles = (texte: string) =>
  texte
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

/** Les citations à renvoyer : l'objet de l'API, l'explication relue à sa place. */
function citationsDuFormulaire(f: Formulaire): Objet[] {
  return f.citations.map((c) => ({ ...c.origine, [c.champ]: c.explication.trim() }));
}

/**
 * L'empreinte de ce que l'administrateur a saisi, cases de relecture
 * comprises : deux empreintes égales, rien à enregistrer. Les clés
 * techniques des citations n'y entrent pas.
 */
export function empreinte(f: Formulaire): string {
  const { citations: _c, ...champs } = f;
  return JSON.stringify({ ...champs, citations: citationsDuFormulaire(f) });
}

/** Les champs que l'API refuse vides (schéma `Prose` de PUT /blog/{id}). */
const CHAMPS_REQUIS: readonly ChampDuFormulaire[] = ['titre', 'rubrique', 'contexte', 'resume', 'impact'];

/**
 * Les champs vides qui empêchent d'enregistrer, et donc de publier : titre,
 * rubrique, contexte, résumé et impact. L'API les refuse vides (422 : « ne
 * peut pas être vide »), l'impact compris : le front ne l'exigeait que pour
 * publier, et un enregistrement sans lui partait pour revenir en erreur
 * (revue du 29/10). Retirer un article du site n'en exige AUCUN : seule la
 * publication change (FenetreDeRelecture, `retirer`).
 */
export function champsManquants(f: Formulaire): ChampDuFormulaire[] {
  return CHAMPS_REQUIS.filter((champ) => !f[champ].trim());
}

/**
 * Le texte de chaque partie relue, dans le formulaire : ce que le contrôle IA
 * juge phrase par phrase et ce que l'administrateur relit. Le TITRE en est
 * (avenant du tour 4) : changer celui d'un article en ligne demande de le
 * retirer, de relancer le contrôle et de le relire, comme pour le résumé. La
 * rubrique, l'adresse, la durée et les mots-clés n'en font pas partie : ils
 * ne disent rien du droit.
 */
const TEXTE_DE_LA_PARTIE: Record<PartieDeRelecture, (f: Formulaire) => unknown> = {
  titre: (f) => f.titre.trim(),
  contexte: (f) => f.contexte.trim(),
  resume: (f) => f.resume.trim(),
  points_cles: (f) => lignes(f.pointsCles),
  impact: (f) => f.impact.trim(),
  // Une citation ajoutée ou retirée change aussi les explications.
  explications: (f) => citationsDuFormulaire(f),
  question: (f) => f.question.trim(),
};

/**
 * Les parties relues dont la saisie change le texte enregistré.
 *
 * POURQUOI. Le contrôle IA et la relecture portent sur un texte précis : le
 * serveur juge le contrôle « à relancer » dès que ce texte change, et décoche
 * les parties changées. Le front fait de même AVANT l'enregistrement : la
 * case d'une partie modifiée ne compte plus, et publier attend un nouveau
 * contrôle. Une relecture cochée sur l'ancien texte ne vaut rien pour le
 * nouveau.
 */
export function partiesModifiees(f: Formulaire, article: ArticleAdmin): PartieDeRelecture[] {
  const enregistre = formulaireDepuis(article);
  return PARTIES_DE_RELECTURE.filter(
    (partie) => JSON.stringify(TEXTE_DE_LA_PARTIE[partie](f)) !== JSON.stringify(TEXTE_DE_LA_PARTIE[partie](enregistre)),
  );
}

/**
 * Vrai si la partie n'a rien à relire : aucun texte, aucun point clé, aucune
 * citation (une question suggérée laissée vide, par exemple).
 */
export function partieVide(f: Formulaire, partie: PartieDeRelecture): boolean {
  const texte = TEXTE_DE_LA_PARTIE[partie](f);
  return Array.isArray(texte) ? texte.length === 0 : texte === '';
}

/**
 * Vrai si la partie compte comme relue : son texte inchangé depuis
 * l'enregistrement, et cochée, ou vide.
 *
 * VIDE, ELLE EST RELUE (API du tour 4, `parties_relues` : « une partie vide
 * n'a rien à relire et l'est toujours »). Le serveur la rend cochée ; la
 * décocher dans le formulaire bloquait « Publier » pour une raison que le
 * serveur ne connaît pas. La vue Relecture n'en montre donc pas la case.
 */
export function partieRelue(f: Formulaire, partie: PartieDeRelecture, modifiees: readonly PartieDeRelecture[]): boolean {
  if (modifiees.includes(partie)) return false;
  return f.relecture[partie] === true || partieVide(f, partie);
}

/** Les cases à envoyer : celles du formulaire, une partie modifiée toujours décochée. */
function relectureAEnvoyer(f: Formulaire, article: ArticleAdmin): Record<PartieDeRelecture, boolean> {
  const modifiees = partiesModifiees(f, article);
  return Object.fromEntries(PARTIES_DE_RELECTURE.map((p) => [p, partieRelue(f, p, modifiees)])) as Record<
    PartieDeRelecture,
    boolean
  >;
}

/**
 * Vrai si le contrôle IA porte sur le texte enregistré. Le front ne peut pas
 * recalculer l'empreinte du serveur : il se fie à l'état qu'il calcule. « À
 * relancer » le dit périmé ; « citations non vérifiées » ou un état absent
 * ne disent rien de lui (le serveur ne rend qu'un état, le premier qui
 * bloque) : dans le doute, ses verdicts ne s'affichent pas comme à jour.
 */
export function controleAJour(article: ArticleAdmin): boolean {
  return (
    article.controleIa !== null &&
    (article.etatPublication === 'publiable' ||
      article.etatPublication === 'relecture_incomplete' ||
      article.etatPublication === 'phrases_a_confirmer' ||
      article.etatPublication === 'phrases_contredites')
  );
}

/**
 * Les phrases de règle qu'il reste à confirmer dans la fenêtre : celles du
 * contrôle à jour (`phrasesAConfirmer`), hors des parties modifiées, que
 * l'administrateur n'a pas confirmées. Vide sans contrôle à jour.
 *
 * POURQUOI hors des parties modifiées : une phrase réécrite se fait juger par
 * un nouveau contrôle (« Enregistrer et relancer »), c'est l'autre façon de la
 * lever (décision du 04/11) ; « Texte modifié » le dit déjà.
 */
export function phrasesRestantesAConfirmer(f: Formulaire, article: ArticleAdmin): PhraseControlee[] {
  if (!controleAJour(article)) return [];
  const modifiees = partiesModifiees(f, article);
  return phrasesAConfirmer(article.controleIa).filter(
    (p) => !modifiees.includes(PARTIE_DE_RELECTURE[p.partie]) && !f.confirmees.includes(p.id),
  );
}

/** Ce qui empêche de publier, avec de quoi le dire ; une liste vide : on peut publier. */
export type Blocage =
  | { code: 'sources_absentes' }
  | { code: 'aucune_citation' }
  | { code: 'citations_non_verifiees'; n: number }
  | { code: 'controle_a_relancer'; cause: 'absent' | 'perime' | 'modifie' }
  | { code: 'phrases_contredites'; n: number }
  | { code: 'phrases_a_confirmer'; n: number }
  | { code: 'relecture_incomplete'; n: number; total: number }
  | { code: 'etat_inconnu' }
  | { code: 'serveur'; etat: EtatDePublication };

/**
 * Vrai si l'article n'a pas de sources contre lesquelles le juger et le
 * relire : le serveur le dit (« sources_absentes »), ou aucune n'est connue
 * (`sources` : celles de l'article, ou à défaut celles que la génération a
 * rendues pendant la visite).
 */
export function sansSources(article: ArticleAdmin, sources: readonly SourceDeGeneration[] = article.sources): boolean {
  return article.etatPublication === 'sources_absentes' || sources.length === 0;
}

/** L'état du serveur est-il déjà dit, en clair, par l'une des raisons du front ? */
function expliqueParLeFront(etat: EtatDePublication, blocages: readonly Blocage[]): boolean {
  if (etat === 'citations_non_verifiees') {
    return blocages.some((b) => b.code === 'citations_non_verifiees' || b.code === 'aucune_citation');
  }
  return blocages.some((b) => b.code === etat);
}

/**
 * Pourquoi « Publier » est désactivé, avec le formulaire tel qu'il est, dans
 * l'ordre où l'administrateur peut lever chaque raison.
 *
 * Le contrat n'autorise la publication que d'un article « publiable » : des
 * sources enregistrées (avenant du tour 4), des citations toutes vérifiées,
 * au moins une, un contrôle IA à jour sans phrase contredite, chaque partie
 * relue, titre compris. L'état du serveur décrit le texte ENREGISTRÉ ; le
 * front y ajoute ce que la saisie change (une partie modifiée rend le
 * contrôle périmé, une case cochée complète la relecture), puisque « Publier »
 * envoie le formulaire entier en une seule requête. Le serveur reste juge :
 * s'il refuse (422), sa raison s'affiche.
 *
 * Chaque raison dit quoi faire (revue du tour 3) : un article sans citation
 * ne disait que « Le serveur ne le juge pas publiable : Citations non
 * vérifiées », sans dire qu'il fallait en AJOUTER une.
 */
export function blocagesDePublication(
  f: Formulaire,
  article: ArticleAdmin,
  sources: readonly SourceDeGeneration[] = article.sources,
): Blocage[] {
  const blocages: Blocage[] = [];
  const modifiees = partiesModifiees(f, article);

  if (sansSources(article, sources)) blocages.push({ code: 'sources_absentes' });

  // Une citation citée pendant cette relecture n'est vérifiée qu'à
  // l'enregistrement : la modification le dit déjà (« enregistrez-le »), et
  // « retirez-la » serait faux.
  const nonVerifiees = f.citations.filter((c) => !c.ajoutee && !citationBruteVerifiee(c.origine)).length;
  if (f.citations.length === 0) blocages.push({ code: 'aucune_citation' });
  else if (nonVerifiees > 0) blocages.push({ code: 'citations_non_verifiees', n: nonVerifiees });

  if (modifiees.length > 0) blocages.push({ code: 'controle_a_relancer', cause: 'modifie' });
  else if (article.controleIa === null) blocages.push({ code: 'controle_a_relancer', cause: 'absent' });
  else if (article.etatPublication === 'controle_a_relancer') blocages.push({ code: 'controle_a_relancer', cause: 'perime' });

  const contredites = controleAJour(article) ? compteDesVerdicts(article.controleIa).contredite : 0;
  if (contredites > 0) blocages.push({ code: 'phrases_contredites', n: contredites });

  // Décision du propriétaire du 04/11 (avenant du tour 7) : chaque phrase de
  // règle « À vérifier » ou « Hors des sources » se réécrit ou se confirme.
  const aConfirmer = phrasesRestantesAConfirmer(f, article).length;
  if (aConfirmer > 0) blocages.push({ code: 'phrases_a_confirmer', n: aConfirmer });

  const relues = PARTIES_DE_RELECTURE.filter((p) => partieRelue(f, p, modifiees)).length;
  if (relues < PARTIES_DE_RELECTURE.length) {
    blocages.push({ code: 'relecture_incomplete', n: relues, total: PARTIES_DE_RELECTURE.length });
  }

  // L'état du serveur, quand le front ne sait pas l'expliquer (un texte cité
  // dépublié depuis, par exemple). « Relecture incomplète » et « phrases à
  // confirmer » ne comptent pas : les cases et les confirmations du
  // formulaire partent avec la publication. Après une saisie dans les parties
  // relues, l'état enregistré ne décrit plus le texte.
  const etat = article.etatPublication;
  if (etat === null) blocages.push({ code: 'etat_inconnu' });
  else if (
    etat !== 'publiable' &&
    etat !== 'relecture_incomplete' &&
    etat !== 'phrases_a_confirmer' &&
    modifiees.length === 0 &&
    !expliqueParLeFront(etat, blocages)
  ) {
    blocages.push({ code: 'serveur', etat });
  }
  return blocages;
}

/**
 * Le parcours de reprise d'un article, étape par étape : « Reconstruire les
 * sources » → citer au moins un article des sources → « Relancer le contrôle
 * IA » → relire chaque partie → publier.
 *
 * POURQUOI (décision du propriétaire du 30/10, b ; revue du tour 3). Les
 * articles d'avant la vérification sont cachés du public, gardés en base,
 * visibles et CORRIGEABLES dans l'administration, et ne reviennent en ligne
 * que par le nouveau parcours. Au tour 3, rien ne le permettait : sans
 * sources, impossible de citer un article de la base, le contrôle IA
 * répondait « aucun extrait », et la publication restait refusée. L'avenant
 * du tour 4 donne les sources reconstruites ; ce parcours dit, à chaque
 * étape, ce qui bloque et quoi faire.
 */
export const ETAPES_DE_REPRISE = ['sources', 'citations', 'controle', 'relecture', 'publication'] as const;
export type EtapeDeReprise = (typeof ETAPES_DE_REPRISE)[number];

export interface Etape {
  etape: EtapeDeReprise;
  /** Faite, en cours (la première qui bloque), ou à venir (après elle). */
  statut: 'faite' | 'en_cours' | 'a_venir';
  /** Ce qui bloque à cette étape (`blocagesDePublication`). */
  blocages: Blocage[];
}

/** L'étape du parcours où se lève une raison de blocage. */
function etapeDuBlocage(blocage: Blocage): EtapeDeReprise {
  const code = blocage.code === 'serveur' ? blocage.etat : blocage.code;
  switch (code) {
    case 'sources_absentes':
      return 'sources';
    case 'aucune_citation':
    case 'citations_non_verifiees':
      return 'citations';
    case 'controle_a_relancer':
    case 'phrases_contredites':
      return 'controle';
    case 'phrases_a_confirmer':
    case 'relecture_incomplete':
      return 'relecture';
    default:
      return 'publication';
  }
}

/**
 * Les cinq étapes, d'après les raisons de blocage : celles avant la première
 * qui bloque sont faites, elle est en cours, les suivantes à venir. Sans
 * raison, la publication est l'étape en cours.
 */
export function etapesDeReprise(blocages: readonly Blocage[]): Etape[] {
  const enCours = ETAPES_DE_REPRISE.find((e) => blocages.some((b) => etapeDuBlocage(b) === e)) ?? 'publication';
  const rang = ETAPES_DE_REPRISE.indexOf(enCours);
  return ETAPES_DE_REPRISE.map((etape, i) => ({
    etape,
    statut: i < rang ? 'faite' : i === rang ? 'en_cours' : 'a_venir',
    blocages: blocages.filter((b) => etapeDuBlocage(b) === etape),
  }));
}

/**
 * Un article publié AVANT la vérification (lignes 1 à 3 de jurix_dev, du
 * 26/10) : publié dans la base, jamais contrôlé ni relu, et que le serveur ne
 * dit pas publiable. La route publique ne le sert plus ; l'administration le
 * marque « À reprendre » pour qu'il repasse par le contrôle et la relecture.
 */
export function estAncien(article: ArticleAdmin): boolean {
  return (
    article.isPublished &&
    article.controleIa === null &&
    article.relecture.le === null &&
    article.etatPublication !== 'publiable'
  );
}

/**
 * Vrai si le public peut lire l'article : publié ET publiable, citations
 * toutes vérifiées, une au moins (la règle des pages publiques,
 * `articleDepuisLApi` et `servableAuPublic`). Un article publié dans la base
 * mais non publiable est caché du public : la liste ne le dit pas « Publié »,
 * et « Voir » ouvre l'aperçu.
 */
export function visibleDuPublic(article: ArticleAdmin): boolean {
  return (
    article.isPublished &&
    article.etatPublication === 'publiable' &&
    article.citations.length > 0 &&
    article.citations.every((c) => citationBruteVerifiee(c))
  );
}

/**
 * Le corps de `PUT /blog/{id}` : tous les champs de texte, les citations
 * relues, et la publication si elle change (`publie`). L'adresse n'est
 * envoyée que si l'administrateur l'a changée : le serveur la normalise
 * (slugify) et répond 409 `slug_pris` si elle est prise ; renvoyée telle
 * quelle, elle risquerait d'être renormalisée pour rien.
 *
 * La durée de lecture aussi, seulement si elle a changé : envoyée à chaque
 * fois (« 4 min » à défaut), elle empêchait le serveur de la recalculer
 * quand le texte change (revues du 29/10).
 */
export function corpsDeLaModification(f: Formulaire, article: ArticleAdmin, publie?: boolean): Objet {
  const corps: Objet = {
    title: f.titre.trim(),
    category: f.rubrique.trim(),
    context: f.contexte.trim(),
    bot_analysis: {
      summary: f.resume.trim(),
      keyPoints: lignes(f.pointsCles),
      citations: citationsDuFormulaire(f),
      citizenImpact: f.impact.trim(),
    },
    suggested_question: f.question.trim(),
    tags: motsCles(f.motsCles),
  };
  if (f.slug.trim() && f.slug.trim() !== article.slug) corps.slug = f.slug.trim();
  if (f.duree.trim() && f.duree.trim() !== article.readingTime.trim()) corps.reading_time = f.duree.trim();
  const relecture = relectureDuCorps(f, article);
  if (relecture) corps.relecture = relecture;
  if (publie !== undefined) corps.is_published = publie;
  return corps;
}

/**
 * Les cases de relecture du corps du PUT, ou `null` : elles ne partent que si
 * elles changent (le serveur note qui les a cochées, et quand), une partie
 * modifiée toujours décochée.
 *
 * AVENANT DU TOUR 5 (des deux côtés). Une case cochée part avec `controle`,
 * le `fait_le` du contrôle que l'administrateur avait sous les yeux en la
 * cochant ; l'API refuse (422 `relecture_perimee`, rien d'appliqué) si ce
 * n'est pas celui qu'elle a enregistré. POURQUOI (revue du tour 4) : l'API
 * attestait le contrôle enregistré AU MOMENT DU PUT ; relancé entre-temps
 * dans un autre onglet, par un autre administrateur, ou après une réponse
 * perdue, un contrôle dont personne n'avait lu les verdicts passait pour relu
 * et l'article partait en ligne en un seul PUT.
 *
 * Sans contrôle, aucune case n'atteste rien : elles partent toutes décochées
 * (une partie vide, que le serveur dit relue, le reste : rien à y relire).
 *
 * AVENANT DU TOUR 7 (des deux côtés). Les phrases de règle confirmées partent
 * dans `phrases_confirmees` (la liste entière, les `id` du contrôle affiché),
 * TOUJOURS avec `controle` : l'API refuse (422 `relecture_perimee`, rien
 * d'appliqué) un identifiant que le contrôle enregistré n'a pas, ou un autre
 * contrôle. Elles ne partent que si elles changent ; une phrase d'une partie
 * modifiée n'en est plus (sa réécriture se fait juger par un nouveau contrôle).
 */
function relectureDuCorps(f: Formulaire, article: ArticleAdmin): Objet | null {
  const relecture = relectureAEnvoyer(f, article);
  const casesChangees = PARTIES_DE_RELECTURE.some((p) => relecture[p] !== article.relecture.parties[p]);
  const controle = identiteDuControle(article.controleIa);
  const confirmees = controle ? confirmeesAEnvoyer(f, article) : null;
  if (!casesChangees && confirmees === null) return null;
  if (!controle) return { parties: relectureVide() };
  const corps: Objet = { parties: relecture };
  if (PARTIES_DE_RELECTURE.some((p) => relecture[p]) || confirmees !== null) corps.controle = controle;
  if (confirmees !== null) corps.phrases_confirmees = confirmees;
  return corps;
}

/**
 * Les confirmations à envoyer, ou `null` si elles ne changent pas : celles du
 * formulaire qui confirment une phrase du contrôle affiché, hors des parties
 * modifiées, comparées à celles que le serveur a enregistrées.
 */
function confirmeesAEnvoyer(f: Formulaire, article: ArticleAdmin): string[] | null {
  const modifiees = partiesModifiees(f, article);
  const enCours = new Set(f.confirmees);
  const aEnvoyer = phrasesAConfirmer(article.controleIa)
    .filter((p) => enCours.has(p.id) && !modifiees.includes(PARTIE_DE_RELECTURE[p.partie]))
    .map((p) => p.id);
  const enregistrees = confirmationsValables(article.relecture.phrasesConfirmees, article.controleIa);
  return JSON.stringify(aEnvoyer) === JSON.stringify(enregistrees) ? null : aEnvoyer;
}

/** Un texte de phrase sous sa forme canonique, comme `_canon` de l'API : les blancs ramenés à une espace. */
const canon = (texte: string) => texte.split(/\s+/).filter(Boolean).join(' ');

/**
 * Une phrase jugée de même par deux contrôles : même partie, même texte, même
 * verdict (ce qu'atteste une confirmation pour l'API, `empreintes_a_confirmer`,
 * avec les sources, qu'un contrôle ne change pas).
 */
function memeJugement(une: PhraseControlee | undefined, autre: PhraseControlee | undefined): boolean {
  return (
    une !== undefined &&
    autre !== undefined &&
    une.partie === autre.partie &&
    canon(une.texte) === canon(autre.texte) &&
    une.verdict === autre.verdict
  );
}

/**
 * Les confirmations de la fenêtre quand une lecture de l'article apporte un
 * autre contrôle (avenant du tour 7, comme `casesApresUnAutreControle`) : une
 * phrase ne reste confirmée que si elle l'était dans la fenêtre, que le
 * serveur la dit encore confirmée, qu'elle est toujours à confirmer, ET que
 * l'ancien contrôle et le nouveau la jugent de même sous le même `id`.
 *
 * POURQUOI ce dernier point. Les `id` du contrôle (« P4 ») sont des rangs :
 * un contrôle refait après une réécriture peut donner « P4 » à une autre
 * phrase. Une confirmation ne passe jamais d'une phrase à l'autre, quelle que
 * soit l'API en face : sinon une règle que personne n'a lue partirait en ligne
 * sous la confirmation d'une autre.
 */
export function confirmationsApresUnAutreControle(
  confirmees: readonly string[],
  avant: ArticleAdmin,
  relu: ArticleAdmin,
): string[] {
  const dansLaFenetre = new Set(confirmees);
  const ancien = new Map((avant.controleIa?.phrases ?? []).map((p) => [p.id, p]));
  return confirmationsValables(relu.relecture.phrasesConfirmees, relu.controleIa).filter(
    (id) => dansLaFenetre.has(id) && memeJugement(ancien.get(id), relu.controleIa?.phrases.find((p) => p.id === id)),
  );
}

/**
 * Vrai si l'article relu apporte un AUTRE contrôle IA que celui de la fenêtre
 * (`fait_le` différent, ou un contrôle apparu ou effacé).
 */
export function autreControle(avant: ArticleAdmin, relu: ArticleAdmin): boolean {
  return identiteDuControle(avant.controleIa) !== identiteDuControle(relu.controleIa);
}

/**
 * Les cases de la fenêtre quand une lecture de l'article apporte un autre
 * contrôle (avenant du tour 5) : refaites depuis le serveur. Une case ne
 * reste cochée que si le serveur la compte encore, contre les nouveaux
 * verdicts, ET qu'elle l'était dans la fenêtre : un décochage en cours est
 * gardé, et rien n'est coché que l'administrateur n'ait coché ici.
 *
 * POURQUOI (revue du tour 4, chemins `relire()`, publication refusée,
 * contrôle en échec, retrait). La fenêtre gardait ses cases quand une saisie
 * était en cours, et « Publier » les renvoyait : un contrôle relancé ailleurs,
 * ou dont la réponse s'était perdue, passait pour relu.
 */
export function casesApresUnAutreControle(
  cochees: Readonly<Record<PartieDeRelecture, boolean>>,
  relu: ArticleAdmin,
): Record<PartieDeRelecture, boolean> {
  return Object.fromEntries(
    PARTIES_DE_RELECTURE.map((p) => [p, relu.relecture.parties[p] === true && cochees[p] === true]),
  ) as Record<PartieDeRelecture, boolean>;
}

/**
 * Les cases du serveur, sans le retour d'une partie à relire de nouveau
 * (`aRelire` : sa case est tombée avec un autre contrôle, et personne ne l'a
 * recochée ici) : elle reste décochée, sauf si le serveur dit ses cases
 * cochées contre le contrôle qu'il garde (`relecture.controle` égal à
 * `controle_ia.fait_le` : quelqu'un, ailleurs, l'a relue contre lui).
 *
 * POURQUOI (revue du front du tour 5, par la vraie API). Une case gardait
 * l'empreinte des verdicts de sa partie : le contrôle Y la faisait tomber, et
 * le contrôle Z, qui redonnait les verdicts d'avant, la faisait revivre. La
 * fenêtre reprenait la case du serveur, la partie quittait la liste « à
 * relire de nouveau », et l'article caché par Y revenait en ligne sans que
 * personne ait lu ce que Y avait trouvé. L'API l'efface désormais ; la
 * fenêtre ne la recoche pas non plus, quelle que soit l'API en face.
 */
export function casesSansRetourDesPartiesARelire(
  cases: Readonly<Record<PartieDeRelecture, boolean>>,
  aRelire: readonly PartieDeRelecture[],
  relu: ArticleAdmin,
): Record<PartieDeRelecture, boolean> {
  const controle = identiteDuControle(relu.controleIa);
  const recocheesContreLui = controle !== null && relu.relecture.controle === controle;
  return Object.fromEntries(
    PARTIES_DE_RELECTURE.map((p) => [p, cases[p] === true && (recocheesContreLui || !aRelire.includes(p))]),
  ) as Record<PartieDeRelecture, boolean>;
}

/** Les parties qui comptent comme relues dans la fenêtre (`partieRelue`). */
export function partiesRelues(f: Formulaire, article: ArticleAdmin): PartieDeRelecture[] {
  const modifiees = partiesModifiees(f, article);
  return PARTIES_DE_RELECTURE.filter((p) => partieRelue(f, p, modifiees));
}

/**
 * L'article tel que le lira le public, AVEC les modifications non
 * enregistrées : l'aperçu de la fenêtre passe par la même lecture que la page
 * publique (`articleDepuisLApi`), donc par le même rendu.
 */
export function articleDuFormulaire(f: Formulaire, article: ArticleAdmin): BlogPost {
  const brut = {
    id: article.id,
    slug: f.slug.trim() || article.slug || 'apercu',
    title: f.titre.trim() || '…',
    category: f.rubrique,
    publishedAt: article.publishedAt,
    readingTime: f.duree,
    context: f.contexte,
    botAnalysis: {
      summary: f.resume,
      keyPoints: lignes(f.pointsCles),
      citations: citationsDuFormulaire(f),
      citizenImpact: f.impact,
    },
    suggestedQuestion: f.question,
    tags: motsCles(f.motsCles),
    isPublished: article.isPublished,
  };
  // Le titre et l'adresse ne sont jamais vides ici : l'aperçu se montre même
  // pendant la saisie.
  return articleDepuisLApi(brut) as BlogPost;
}

/**
 * « Article 299 · Code pénal », « Article 39 (suite) · Code du travail » : une
 * citation nommée pour l'administrateur, comme sur la carte publique.
 */
export function nomDeCitation(citation: Objet, t: (cle: string) => string): string {
  const article =
    articleNomme(
      {
        articleNumber: chaine(citation.article_number ?? citation.articleNumber),
        verifie: citationBruteVerifiee(citation),
        suite: citation.suite === true,
      },
      t,
    ) || t('blog.legalExcerpt');
  const texte = referenceAffichable({ reference: chaine(citation.reference ?? citation.law_title) });
  return [article, texte ?? ''].filter(Boolean).join('\u00a0· ');
}

/**
 * Les avertissements du serveur que le front recalcule lui-même, sur la
 * SAISIE : une citation non vérifiée (« Citation 2 : non vérifiée… ») et
 * l'absence de citation (« Aucune citation : … »), textes de
 * avertissements_du_billet. Gardés, ils doublaient les lignes du front
 * (revue du 29/10) : la liste disait « 2 à vérifier » d'un article que la
 * fenêtre comptait 4 fois. Si le serveur change ces phrases, elles
 * reviennent en double, ce qui avertit plus et jamais moins.
 *
 * « Sources absentes : … » (API du tour 4, `_avertissements_d_etat`) : le
 * front le dit déjà, en clair et étape par étape (raison « Sources
 * absentes » du pied, parcours de reprise, panneau des sources).
 */
const RECALCULES_PAR_LE_FRONT = [/^Citation\s+\d+\s*:\s*non\s+vérifiée/i, /^Aucune\s+citation\b/i, /^Sources\s+absentes\b/i];

const recalculeParLeFront = (avertissement: string) =>
  RECALCULES_PAR_LE_FRONT.some((motif) => motif.test(avertissement.trim()));

/**
 * Les points à vérifier en relisant, ceux que la liste compte (« 2 à
 * vérifier ») et que la fenêtre montre en tête de la relecture. Ils ne
 * bloquent pas la publication à eux seuls : c'est la relecture de chaque
 * partie, obligatoire, qui les tranche (contrat du 30/10).
 * - les avertissements du serveur (articles ou textes mentionnés qu'aucune
 *   citation ne porte) ;
 * - ceux que seule la génération a relevés (`deLaGeneration`), gardés pour
 *   la visite et marqués comme tels ;
 * - chaque citation NON VÉRIFIÉE selon la règle de la page publique
 *   (`citationBruteVerifiee` : `verifie`, extrait et lien du serveur), y
 *   compris celle qu'on vient de citer depuis une source, que le serveur ne
 *   vérifie qu'à l'enregistrement ;
 * - l'absence de toute citation.
 * Une liste vide : rien à confirmer.
 */
export function pointsAVerifier(
  avertissements: readonly string[],
  citations: readonly Objet[],
  t: (cle: string) => string,
  deLaGeneration: readonly string[] = [],
  deLaReconstruction: readonly string[] = [],
): string[] {
  const points: string[] = [];
  for (const avertissement of avertissements) {
    if (!recalculeParLeFront(avertissement) && !points.includes(avertissement)) points.push(avertissement);
  }
  for (const [liste, cle] of [
    [deLaGeneration, 'admin.blog.generationWarning'],
    // Une citation retirée par la reconstruction des sources : à savoir
    // avant de relire les explications (avenant du tour 4).
    [deLaReconstruction, 'admin.blog.rebuildWarning'],
  ] as const) {
    for (const avertissement of liste) {
      if (recalculeParLeFront(avertissement) || avertissements.includes(avertissement)) continue;
      const point = t(cle).replace('{texte}', () => avertissement);
      if (!points.includes(point)) points.push(point);
    }
  }
  for (const citation of citations) {
    if (!citationBruteVerifiee(citation)) {
      points.push(t('admin.blog.unverifiedWarning').replace('{cite}', () => nomDeCitation(citation, t)));
    }
  }
  if (citations.length === 0) points.push(t('admin.blog.noCitationWarning'));
  return points;
}

/**
 * L'avertissement de la génération qui dit que le contrôle IA n'a pas pu se
 * faire (« Le contrôle IA n'a pas pu être fait (…) : relancez le contrôle
 * IA avant de publier »).
 */
const CONTROLE_NON_FAIT = /contr[ôo]le IA n['’]a pas (?:pu être fait|abouti)/i;

/**
 * Ce que la génération a relevé et qui vaut encore pour l'article : une fois
 * un contrôle IA enregistré, « le contrôle IA n'a pas pu être fait » n'est
 * plus vrai, et restait pourtant à vérifier pendant toute la visite (revue
 * du tour 3).
 */
export function avertissementsDeGenerationValables(avertissements: readonly string[], article: ArticleAdmin): string[] {
  return article.controleIa ? avertissements.filter((a) => !CONTROLE_NON_FAIT.test(a)) : [...avertissements];
}

/**
 * L'avertissement de la reconstruction des sources qui dit le contrôle d'avant
 * effacé (« Les sources ont changé : le contrôle IA d'avant, fait sur les
 * anciennes, est effacé. Relancez-le… », routes/blog.py du tour 4).
 */
const CONTROLE_EFFACE = /contr[ôo]le IA d['’]avant/i;

/**
 * Ce que la reconstruction des sources a relevé et qui vaut encore : une fois
 * un nouveau contrôle enregistré, « le contrôle d'avant est effacé, relancez-le »
 * n'est plus vrai. Les citations retirées, elles, restent à savoir.
 */
export function avertissementsDeRepriseValables(avertissements: readonly string[], article: ArticleAdmin): string[] {
  return article.controleIa ? avertissements.filter((a) => !CONTROLE_EFFACE.test(a)) : [...avertissements];
}

/**
 * Vrai si la source est déjà citée : même texte, même article, et même
 * passage (le début d'un article ou sa suite ne sont pas le même extrait).
 */
export function dejaCitee(f: Formulaire, source: SourceDeGeneration): boolean {
  return f.citations.some(
    (c) =>
      Number(c.origine.law_id ?? c.origine.lawId) === source.lawId &&
      chaine(c.origine.article_number ?? c.origine.articleNumber) === source.articleNumber &&
      (c.origine.suite === true) === source.suite,
  );
}

/**
 * Une citation tirée d'une source retrouvée, sans rien taper : le texte,
 * l'article et l'extrait sont ceux de la base. Le serveur la vérifie à
 * l'enregistrement (422 si le texte n'est pas publié ou n'a pas cet
 * article) et la reconstruit, lien compris ; jusque-là, elle n'a ni
 * `verifie` ni lien du serveur : elle s'affiche « Citation non vérifiée »,
 * sans extrait, et compte parmi les points à vérifier.
 */
export function citationDepuisSource(source: SourceDeGeneration): CitationEditable {
  return citationEditable(
    {
      law_id: source.lawId,
      ...(source.articleId !== null ? { article_id: source.articleId } : {}),
      article_number: source.articleNumber,
      ...(source.suite ? { suite: true } : {}),
      reference: source.lawTitle,
      excerpt: source.extrait,
      title: '',
    },
    true,
  );
}
