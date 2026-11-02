/**
 * Données de TEST de l'administration du blog, et une doublure du serveur
 * qui applique le contrat du 30/10 (« Relecture + contrôle IA »). Aucun
 * import : la spec Playwright du blog (tests/e2e/navigation/blog.spec.ts) les
 * lit aussi, et elle ne résout pas les alias de SvelteKit.
 *
 * LA DOUBLURE (`serveurDuBlog`). Elle tient l'état d'UN article et répond
 * comme l'API du contrat :
 * - `PUT` d'un corps qui vaut exactement `{"is_published": false}` : retiré,
 *   toujours ;
 * - tout autre `PUT` : validé EN ENTIER puis appliqué d'un bloc. Une partie
 *   relue dont le texte change est décochée, et le contrôle devient périmé
 *   (son empreinte ne correspond plus). Publier un article qui n'est pas
 *   « publiable » répond 422, le code étant l'état, et RIEN n'est appliqué ;
 * - `POST /controle` : un contrôle neuf du texte enregistré ;
 * - `etat_publication` calculé à chaque réponse, dans l'ordre du contrat :
 *   citations, contrôle, phrases contredites, relecture.
 * Elle n'imite ni la base ni le modèle : les verdicts du contrôle neuf sont
 * donnés par le test.
 */

type Objet = Record<string, unknown>;

export const PARTIES = ['contexte', 'resume', 'points_cles', 'impact', 'explications', 'question'] as const;

export const RELECTURE_VIDE = {
  parties: { contexte: false, resume: false, points_cles: false, impact: false, explications: false, question: false },
  par: null,
  le: null,
};

export const RELECTURE_COMPLETE = {
  parties: { contexte: true, resume: true, points_cles: true, impact: true, explications: true, question: true },
  par: 'admin@jurix.cm',
  le: '2026-10-30T09:40:00+00:00',
};

export const CITATION_VERIFIEE = {
  law_id: 2236,
  article_id: 501,
  article_number: '299',
  reference: 'Code pénal (loi n° 2016/007)',
  title: 'Violation de domicile',
  excerpt: 'Est puni d’un emprisonnement de dix (10) jours à un (01) an…',
  url: '/laws/2236?article=299',
  verifie: true,
};

export const CITATION_CODE_CIVIL = {
  law_id: 2285,
  article_number: '1736',
  reference: 'Code civil',
  title: 'Le congé',
  excerpt: 'Si le bail a été fait sans écrit…',
  url: '/laws/2285?article=1736',
  verifie: true,
};

/**
 * La suite de l'article 39 du Code du travail, telle que l'essai réel du 30/10
 * l'a citée depuis le morceau « 35.2 » : `suite`, extrait ouvert par « […] ».
 */
export const CITATION_SUITE = {
  law_id: 2274,
  article_id: 97421,
  article_number: '39',
  reference: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
  title: 'Les dommages-intérêts ne se confondent ni avec l’indemnité de préavis ni avec celle de licenciement.',
  excerpt:
    '[…] (6) Le salaire à prendre en considération aux alinéas précédents est le salaire moyen mensuel brut des douze (12) derniers mois d’activité du travailleur.',
  url: '/laws/2274?article=39',
  verifie: true,
  suite: true,
};

/** Les extraits remis au modèle (réponse de la génération). */
export const SOURCES = [
  { n: 1, law_id: 2236, law_title: 'Code pénal (loi n° 2016/007)', article_number: '299', article_id: 501, suite: false, extrait: 'Est puni d’un emprisonnement de dix (10) jours à un (01) an…' },
  { n: 2, law_id: 2285, law_title: 'Code civil', article_number: '1736', article_id: 94790, suite: false, extrait: 'Si le bail a été fait sans écrit, l’une des parties ne pourra donner congé à l’autre qu’en observant les délais fixés par l’usage des lieux.' },
  {
    n: 3,
    law_id: 2277,
    law_title: 'Acte uniforme OHADA relatif au droit commercial général',
    article_number: '133',
    article_id: 89451,
    suite: false,
    extrait: 'Le preneur et le bailleur sont tenus chacun en ce qui le concerne au respect de chacune des clauses et conditions du bail sous peine de résiliation. La demande en justice aux fins de résiliation du bail doit être précédée d’une mise en demeure… La juridiction compétente statuant à bref délai est saisie de la demande en résiliation du bail et d’expulsion du preneur.',
  },
];

/** Une phrase contrôlée, à la forme du contrat. */
export const phrase = (
  id: string,
  partie: string,
  index: number,
  texte: string,
  verdict: string,
  extraits: number[] = [],
  raison = '',
) => ({ id, partie, index, texte, verdict, extraits, raison });

/** Le texte que juge le contrôle, partie par partie ; son « empreinte » ici. */
export function empreinteDuTexte(article: Objet): string {
  const analyse = (article.botAnalysis ?? {}) as Objet;
  const citations = (Array.isArray(analyse.citations) ? analyse.citations : []) as Objet[];
  return JSON.stringify([
    article.context,
    analyse.summary,
    analyse.keyPoints,
    analyse.citizenImpact,
    citations.map((c) => c.title ?? c.explication ?? ''),
    article.suggestedQuestion,
  ]);
}

/** Les phrases du brouillon d'exemple : chacune soutenue, sauf l'impact (« À vérifier ») et le contexte (« Hors des sources »). */
export const PHRASES = [
  phrase('p1', 'contexte', 0, 'Un bailleur de Douala a changé la serrure.', 'hors_sources', [], 'Aucun extrait ne relate ce fait : il plante le décor.'),
  phrase('p2', 'resume', 0, 'Le bailleur ne peut pas expulser seul.', 'soutenue', [3], 'L’extrait 3 confie la résiliation et l’expulsion à la juridiction compétente.'),
  phrase('p3', 'point_cle', 0, 'Pas d’expulsion sans décision de justice.', 'soutenue', [2, 3], 'Les extraits 2 et 3 encadrent la fin du bail.'),
  phrase('p4', 'impact', 0, 'Saisissez le juge des référés.', 'non_soutenue', [], 'Aucun extrait ne parle du juge des référés.'),
  phrase('p5', 'explication', 0, 'Violation de domicile', 'soutenue', [1], 'L’extrait 1 punit l’introduction dans le domicile d’autrui.'),
  phrase('p6', 'explication', 1, 'Le congé', 'soutenue', [2], 'L’extrait 2 porte sur le congé.'),
  phrase('p7', 'question', 0, 'Que faire si mon bailleur change la serrure ?', 'soutenue', [], 'Une question, sans règle à vérifier.'),
];

const ANALYSE = {
  summary: 'Le bailleur ne peut pas expulser seul.',
  keyPoints: ['Pas d’expulsion sans décision de justice.'],
  citations: [CITATION_VERIFIEE, CITATION_CODE_CIVIL],
  citizenImpact: 'Saisissez le juge des référés.',
};

const TEXTE = {
  context: 'Un bailleur de Douala a changé la serrure.',
  botAnalysis: ANALYSE,
  suggestedQuestion: 'Que faire si mon bailleur change la serrure ?',
};

/**
 * Le brouillon d'exemple, tel que le rend la génération : contrôle IA à jour,
 * aucune phrase contredite, rien de relu (« relecture_incomplete »).
 */
export const BROUILLON = {
  id: 12,
  slug: 'bail-expulsion-sans-juge',
  title: 'Expulsion sans juge',
  category: 'Immobilier',
  publishedAt: '2026-10-30',
  readingTime: '4 min',
  ...TEXTE,
  tags: ['bail'],
  isPublished: false,
  avertissements: [] as string[],
  controle_ia: { fait_le: '2026-10-30T09:12:00+00:00', modele: 'ministral-14b-latest', empreinte: empreinteDuTexte(TEXTE), phrases: PHRASES },
  relecture: RELECTURE_VIDE,
  etat_publication: 'relecture_incomplete',
};

/** Le même article, publié et lisible du public : contrôlé, relu, publiable. */
export const PUBLIE = {
  ...BROUILLON,
  id: 13,
  slug: 'bail-expulsion-en-ligne',
  title: 'Expulsion sans juge : l’article en ligne',
  isPublished: true,
  relecture: RELECTURE_COMPLETE,
  etat_publication: 'publiable',
};

/** Le contrôle de l'essai réel sur le bail : l'expulsion sans juge, contredite par l'art. 133. */
export const PHRASES_AVEC_CONTRADICTION = PHRASES.map((p) =>
  p.id === 'p2'
    ? phrase('p2', 'resume', 0, 'Le bailleur ne peut pas expulser seul.', 'contredite', [3], 'L’extrait 3 dit le contraire : la juridiction prononce l’expulsion.')
    : p,
);

/* -------------------------------------------------------------------------- */
/* La doublure du serveur                                                      */
/* -------------------------------------------------------------------------- */

const tousRelus = (relecture: Objet) => {
  const parties = (relecture?.parties ?? {}) as Objet;
  return PARTIES.every((p) => parties[p] === true);
};

/** L'état de publication d'un article, dans l'ordre du contrat. */
export function etatDe(article: Objet): string {
  const citations = (((article.botAnalysis ?? {}) as Objet).citations ?? []) as Objet[];
  if (citations.some((c) => c.verifie !== true)) return 'citations_non_verifiees';
  const controle = article.controle_ia as Objet | null;
  if (!controle || controle.empreinte !== empreinteDuTexte(article)) return 'controle_a_relancer';
  if (((controle.phrases ?? []) as Objet[]).some((p) => p.verdict === 'contredite')) return 'phrases_contredites';
  if (!tousRelus(article.relecture as Objet)) return 'relecture_incomplete';
  return 'publiable';
}

/** Les parties relues dont le texte change entre deux versions. */
function partiesChangees(avant: Objet, apres: Objet): string[] {
  const a = (avant.botAnalysis ?? {}) as Objet;
  const b = (apres.botAnalysis ?? {}) as Objet;
  const explications = (x: Objet) => JSON.stringify(((x.citations ?? []) as Objet[]).map((c) => [c.law_id, c.article_number, c.title]));
  const differe = (x: unknown, y: unknown) => JSON.stringify(x) !== JSON.stringify(y);
  return [
    differe(avant.context, apres.context) ? 'contexte' : '',
    differe(a.summary, b.summary) ? 'resume' : '',
    differe(a.keyPoints, b.keyPoints) ? 'points_cles' : '',
    differe(a.citizenImpact, b.citizenImpact) ? 'impact' : '',
    explications(a) !== explications(b) ? 'explications' : '',
    differe(avant.suggestedQuestion, apres.suggestedQuestion) ? 'question' : '',
  ].filter(Boolean);
}

/** Une citation renvoyée par le front, reconstruite « depuis la base » : vérifiée, sauf celle d'avant le contrat (texte 1). */
function citationReconstruite(c: Objet): Objet {
  if (Number(c.law_id) <= 1) return { ...c, verifie: false };
  const numero = String(c.article_number ?? '');
  return {
    ...c,
    title: typeof c.title === 'string' ? c.title : '',
    excerpt: typeof c.excerpt === 'string' && c.excerpt ? c.excerpt : `Extrait de l’article ${numero}.`,
    url: `/laws/${c.law_id}?article=${encodeURIComponent(numero)}`,
    verifie: true,
  };
}

export interface ReponseSimulee {
  statut: number;
  corps: unknown;
}

/**
 * Un serveur du blog pour UN article. `repondre(methode, chemin, corps)` rend
 * la réponse du contrat ; `article()` l'état enregistré ; `envois` les corps
 * reçus, dans l'ordre.
 */
export function serveurDuBlog(depart: Objet, options: { phrasesDuControle?: (article: Objet) => unknown[] } = {}) {
  let enregistre: Objet = JSON.parse(JSON.stringify(depart));
  const envois: { methode: string; chemin: string; corps: unknown }[] = [];
  const versLeFront = (): Objet => ({ ...enregistre, etat_publication: etatDe(enregistre) });

  function modifier(corps: Objet): ReponseSimulee {
    // Retirer du site : toujours accepté, rien d'autre ne change.
    if (Object.keys(corps).length === 1 && corps.is_published === false) {
      enregistre = { ...enregistre, isPublished: false };
      return { statut: 200, corps: versLeFront() };
    }
    // Tout le reste : validé en entier sur une copie, puis appliqué d'un bloc.
    const analyse = (corps.bot_analysis ?? {}) as Objet;
    const avant = enregistre;
    const apres: Objet = JSON.parse(JSON.stringify(avant));
    for (const [cle, champ] of [
      ['title', 'title'],
      ['category', 'category'],
      ['context', 'context'],
      ['reading_time', 'readingTime'],
      ['suggested_question', 'suggestedQuestion'],
      ['tags', 'tags'],
      ['slug', 'slug'],
    ] as const) {
      if (corps[cle] !== undefined) apres[champ] = corps[cle];
    }
    const nouvelleAnalyse = { ...(apres.botAnalysis as Objet) };
    for (const cle of ['summary', 'keyPoints', 'citizenImpact'] as const) {
      if (analyse[cle] !== undefined) nouvelleAnalyse[cle] = analyse[cle];
    }
    if (Array.isArray(analyse.citations)) nouvelleAnalyse.citations = (analyse.citations as Objet[]).map(citationReconstruite);
    apres.botAnalysis = nouvelleAnalyse;
    const parties = { ...((((corps.relecture as Objet)?.parties ?? (avant.relecture as Objet).parties) ?? {}) as Objet) };
    for (const partie of partiesChangees(avant, apres)) parties[partie] = false;
    const relectureChangee = JSON.stringify(parties) !== JSON.stringify((avant.relecture as Objet).parties);
    apres.relecture = relectureChangee
      ? { parties, par: 'admin@jurix.cm', le: '2026-10-30T10:05:00+00:00' }
      : avant.relecture;
    if (corps.is_published === true) {
      const etat = etatDe(apres);
      if (etat !== 'publiable') {
        return { statut: 422, corps: { detail: `Publication refusée : l’article n’est pas publiable (${etat}).`, code: etat } };
      }
      apres.isPublished = true;
    } else if (corps.is_published === false) {
      apres.isPublished = false;
    }
    enregistre = apres;
    return { statut: 200, corps: versLeFront() };
  }

  function repondre(methode: string, chemin: string, corps?: unknown): ReponseSimulee {
    envois.push({ methode, chemin, corps });
    const id = enregistre.id;
    if (methode === 'PUT' && chemin === `/blog/${id}`) return modifier((corps ?? {}) as Objet);
    if (methode === 'POST' && chemin === `/blog/${id}/controle`) {
      const phrases = options.phrasesDuControle?.(enregistre) ?? ((enregistre.controle_ia as Objet | null)?.phrases ?? PHRASES);
      enregistre = {
        ...enregistre,
        controle_ia: { fait_le: '2026-10-30T10:10:00+00:00', modele: 'ministral-14b-latest', empreinte: empreinteDuTexte(enregistre), phrases },
      };
      return { statut: 200, corps: versLeFront() };
    }
    if (methode === 'GET' && chemin === `/blog/admin/${id}`) return { statut: 200, corps: versLeFront() };
    if (methode === 'GET' && chemin === '/blog/admin/all') return { statut: 200, corps: [versLeFront()] };
    return { statut: 404, corps: { detail: 'Not Found' } };
  }

  return { repondre, article: versLeFront, envois };
}
