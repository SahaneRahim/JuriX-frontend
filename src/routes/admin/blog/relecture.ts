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
  compteDesVerdicts,
  controleDepuis,
  relectureDepuis,
  type ControleIA,
  type PartieDeRelecture,
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
  };
}

/** La liste de `GET /blog/admin/all`, ou `null` si ce n'est pas une liste. */
export function articlesAdminDepuis(brut: unknown): ArticleAdmin[] | null {
  if (!Array.isArray(brut)) return null;
  return brut.map(articleAdminDepuis).filter((a): a is ArticleAdmin => a !== null);
}

/** Un extrait retrouvé pour une génération (réponse de `POST /blog/generate`). */
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
  const article = articleAdminDepuis(brut.post);
  if (!article) return null;
  const avertissementsDeGeneration = [...new Set(listeDeTextes(brut.avertissements))].filter(
    (a) => !article.avertissements.includes(a),
  );
  return { article, sources: sourcesDepuis(brut.sources), avertissementsDeGeneration };
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
}

export type ChampDuFormulaire = Exclude<keyof Formulaire, 'citations' | 'relecture'>;

let compteur = 0;
const nouvelleCle = () => `citation-${++compteur}`;

export function citationEditable(origine: Objet): CitationEditable {
  const champ = cleDExplication(origine);
  return { cle: nouvelleCle(), origine, champ, explication: chaine(origine[champ]) };
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
    citations: article.citations.map(citationEditable),
    relecture: { ...article.relecture.parties },
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
 * juge phrase par phrase et ce que l'administrateur relit. Le titre, la
 * rubrique, l'adresse, la durée et les mots-clés n'en font pas partie.
 */
const TEXTE_DE_LA_PARTIE: Record<PartieDeRelecture, (f: Formulaire) => unknown> = {
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

/** Vrai si la partie compte comme relue : cochée, et son texte inchangé depuis l'enregistrement. */
export function partieRelue(f: Formulaire, partie: PartieDeRelecture, modifiees: readonly PartieDeRelecture[]): boolean {
  return f.relecture[partie] === true && !modifiees.includes(partie);
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
      article.etatPublication === 'phrases_contredites')
  );
}

/** Ce qui empêche de publier, avec de quoi le dire ; une liste vide : on peut publier. */
export type Blocage =
  | { code: 'citations_non_verifiees'; n: number }
  | { code: 'controle_a_relancer'; cause: 'absent' | 'perime' | 'modifie' }
  | { code: 'phrases_contredites'; n: number }
  | { code: 'relecture_incomplete'; n: number; total: number }
  | { code: 'etat_inconnu' }
  | { code: 'serveur'; etat: EtatDePublication };

/**
 * Pourquoi « Publier » est désactivé, avec le formulaire tel qu'il est.
 *
 * Le contrat du 30/10 n'autorise la publication que d'un article
 * « publiable » : toutes les citations vérifiées, un contrôle IA à jour sans
 * phrase contredite, chaque partie relue. L'état du serveur décrit le texte
 * ENREGISTRÉ ; le front y ajoute ce que la saisie change (une partie modifiée
 * rend le contrôle périmé, une case cochée complète la relecture), puisque
 * « Publier » envoie le formulaire entier en une seule requête. Le serveur
 * reste juge : s'il refuse (422), sa raison s'affiche.
 */
export function blocagesDePublication(f: Formulaire, article: ArticleAdmin): Blocage[] {
  const blocages: Blocage[] = [];
  const modifiees = partiesModifiees(f, article);

  const nonVerifiees = f.citations.filter((c) => !citationBruteVerifiee(c.origine)).length;
  if (nonVerifiees > 0) blocages.push({ code: 'citations_non_verifiees', n: nonVerifiees });

  if (modifiees.length > 0) blocages.push({ code: 'controle_a_relancer', cause: 'modifie' });
  else if (article.controleIa === null) blocages.push({ code: 'controle_a_relancer', cause: 'absent' });
  else if (article.etatPublication === 'controle_a_relancer') blocages.push({ code: 'controle_a_relancer', cause: 'perime' });

  const contredites = controleAJour(article) ? compteDesVerdicts(article.controleIa).contredite : 0;
  if (contredites > 0) blocages.push({ code: 'phrases_contredites', n: contredites });

  const relues = PARTIES_DE_RELECTURE.filter((p) => partieRelue(f, p, modifiees)).length;
  if (relues < PARTIES_DE_RELECTURE.length) {
    blocages.push({ code: 'relecture_incomplete', n: relues, total: PARTIES_DE_RELECTURE.length });
  }

  // L'état du serveur, quand le front ne sait pas l'expliquer (un texte cité
  // dépublié depuis, par exemple). « Relecture incomplète » ne compte pas :
  // les cases du formulaire partent avec la publication. Après une saisie
  // dans les parties relues, l'état enregistré ne décrit plus le texte.
  const etat = article.etatPublication;
  if (etat === null) blocages.push({ code: 'etat_inconnu' });
  else if (
    etat !== 'publiable' &&
    etat !== 'relecture_incomplete' &&
    modifiees.length === 0 &&
    !blocages.some((b) => b.code === etat)
  ) {
    blocages.push({ code: 'serveur', etat });
  }
  return blocages;
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
 * toutes vérifiées (la règle des pages publiques, `servableAuPublic`). Un
 * article publié dans la base mais non publiable est caché du public : la
 * liste ne le dit pas « Publié », et « Voir » ouvre l'aperçu.
 */
export function visibleDuPublic(article: ArticleAdmin): boolean {
  return (
    article.isPublished &&
    article.etatPublication === 'publiable' &&
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
  // Les cases de relecture, seulement si elles changent (le serveur note qui
  // les a cochées, et quand) ; une partie modifiée part décochée.
  const relecture = relectureAEnvoyer(f, article);
  if (PARTIES_DE_RELECTURE.some((p) => relecture[p] !== article.relecture.parties[p])) corps.relecture = { parties: relecture };
  if (publie !== undefined) corps.is_published = publie;
  return corps;
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
 */
const RECALCULES_PAR_LE_FRONT = [/^Citation\s+\d+\s*:\s*non\s+vérifiée/i, /^Aucune\s+citation\b/i];

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
): string[] {
  const points: string[] = [];
  for (const avertissement of avertissements) {
    if (!recalculeParLeFront(avertissement) && !points.includes(avertissement)) points.push(avertissement);
  }
  for (const avertissement of deLaGeneration) {
    if (recalculeParLeFront(avertissement) || avertissements.includes(avertissement)) continue;
    const point = t('admin.blog.generationWarning').replace('{texte}', () => avertissement);
    if (!points.includes(point)) points.push(point);
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
  return citationEditable({
    law_id: source.lawId,
    ...(source.articleId !== null ? { article_id: source.articleId } : {}),
    article_number: source.articleNumber,
    ...(source.suite ? { suite: true } : {}),
    reference: source.lawTitle,
    excerpt: source.extrait,
    title: '',
  });
}
