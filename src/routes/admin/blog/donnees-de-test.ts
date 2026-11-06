/**
 * Données de TEST de l'administration du blog, et une doublure du serveur
 * qui applique le contrat du 30/10 (« Relecture + contrôle IA ») et son
 * avenant du tour 4. Aucun import : la spec Playwright du blog
 * (tests/e2e/navigation/blog.spec.ts) les lit aussi, et elle ne résout pas les
 * alias de SvelteKit.
 *
 * LA DOUBLURE (`serveurDuBlog`) tient l'état d'UN article et répond comme
 * l'API écrite pour le tour 4 (dépôt du backend, worktree wt-fix :
 * app/api/routes/blog.py et app/services/controle_du_billet.py, lus le
 * 04/11) :
 * - `PUT` d'un corps qui vaut exactement `{"is_published": false}` : retiré,
 *   toujours ;
 * - tout autre `PUT` : validé EN ENTIER puis appliqué d'un bloc. Une partie
 *   inconnue dans `relecture.parties` : 422 `entree_invalide`. Une partie
 *   relue dont le texte change est décochée, et le contrôle devient périmé
 *   (son empreinte couvre le texte de chaque partie, titre compris, ET les
 *   sources). Publier un article qui n'est pas « publiable », ou le garder en
 *   ligne (`is_published` absent sur un article publié), répond 422, le code
 *   étant l'état, et RIEN n'est appliqué ;
 * - `POST /controle` : un contrôle neuf du texte enregistré ; 422
 *   `sources_absentes` pour un article sans sources (le modèle n'est pas
 *   appelé) ;
 * - `POST /sources` : les sources reconstruites ; une citation n'est gardée
 *   que vérifiée et portée par une source (même texte, même ligne, même
 *   numéro, début ou suite), les autres sont retirées, chacune avec un
 *   avertissement ; le contrôle d'avant est effacé si les sources changent ;
 *   l'article repasse TOUJOURS en brouillon ; rend `{post, sources,
 *   avertissements}` ; 422 `sans_source` si rien ne couvre le sujet ;
 * - une case de relecture ATTESTE le texte de sa partie, les sources et les
 *   verdicts que le contrôle enregistré donne à cette partie : cochée avant
 *   un contrôle qui juge autrement la partie, ou avant une reconstruction qui
 *   change les sources, elle ne compte plus. Une partie vide n'a rien à
 *   relire : elle l'est toujours ;
 * - l'identité d'une citation (ce qu'atteste la relecture des explications)
 *   comprend son extrait ; les blancs ne comptent pas ;
 * - `etat_publication` et `avertissements` calculés à chaque réponse, l'état
 *   dans l'ordre : sources, citations (au moins une, toutes vérifiées),
 *   contrôle, phrases contredites, relecture ;
 * - `sources` dans toute réponse (de l'administration : la doublure n'a pas
 *   de route publique).
 *
 * AVENANT DU TOUR 5 (des deux côtés ; l'API dans le worktree wt-blog,
 * routes/blog.py et controle_du_billet.py lus le 04/11 à 15:40 :
 * `relecture_perimee`, `_relance_confirmee`, `fait_le_apres`) :
 * - un PUT qui coche une partie porte `relecture.controle`, le `fait_le` du
 *   contrôle relu ; sans contrôle enregistré, absent, ou autre que celui du
 *   contrôle enregistré : 422 `relecture_perimee`, RIEN d'appliqué. Décocher
 *   n'en demande pas. La relecture enregistrée garde ce `controle`, que
 *   chaque réponse rend (`relecture.controle`) ;
 * - `POST /controle` d'un article publié (qui a des sources : sans elles,
 *   d'abord 422 `sources_absentes`) : 409 `article_en_ligne` sans
 *   `{"confirmer": true}`, le modèle n'étant pas appelé ;
 * - chaque contrôle a son propre `fait_le` (ici une minute plus tard que le
 *   précédent ; l'API, au moins une seconde) : c'est ce qui le désigne ;
 * - les cases qu'un contrôle fait tomber sont EFFACÉES (correctif de la revue
 *   du front du tour 5, `relecture_apres_un_controle`, lu le 04/11 au soir) :
 *   un contrôle suivant qui redonne les verdicts d'avant ne les fait pas
 *   revivre, et un article qu'un contrôle a caché du public n'y revient pas
 *   sans qu'on recoche la partie.
 *
 * AVENANT DU TOUR 7 (des deux côtés ; décision du propriétaire du 04/11,
 * « Confirmer phrase par phrase ») :
 * - chaque phrase du contrôle porte `nature` (« regle » ou « autre ») ;
 *   absente, c'est une règle (`lire_la_nature` de l'API) ;
 * - une phrase de règle « non_soutenue » ou « hors_sources » se réécrit, ou
 *   se CONFIRME : le PUT porte `relecture.phrases_confirmees` (la liste
 *   entière des `id` confirmés), toujours avec `relecture.controle`. Un
 *   identifiant que le contrôle enregistré n'a pas, ou un autre contrôle :
 *   422 `relecture_perimee`, RIEN d'appliqué. Une liste qui n'est pas faite
 *   de textes : 422 `entree_invalide` ;
 * - l'état « phrases_a_confirmer » vient après « phrases_contredites » et
 *   avant « relecture_incomplete » ; publier exige chaque règle confirmée ;
 * - une confirmation atteste sa phrase (identifiant, partie, texte,
 *   verdict) et les sources, comme une case sa partie
 *   (`empreintes_a_confirmer`) : un contrôle neuf qui juge autrement la phrase
 *   l'EFFACE, et un contrôle suivant ne la fait pas revivre ; une phrase d'une
 *   partie dont le texte change perd la sienne (`nouvelle_relecture`) ;
 * - les réponses d'administration rendent `relecture.phrases_confirmees` (les
 *   confirmations qui comptent encore, dans l'ordre de l'article) ; les
 *   réponses PUBLIQUES (`GET /blog`, `GET /blog/{slug}`) ne portent ni
 *   `controle_ia`, ni `relecture`, ni `etat_publication`, ni
 *   `avertissements`, ni `sources`, et ne servent qu'un article publié ET
 *   publiable (404 sinon).
 * Elle n'imite ni la base ni le modèle : les verdicts d'un contrôle neuf et
 * les sources reconstruites sont donnés par le test. Les messages sont ceux de
 * l'API, raccourcis quand le test n'en lit rien.
 */

type Objet = Record<string, unknown>;

export const PARTIES = ['titre', 'contexte', 'resume', 'points_cles', 'impact', 'explications', 'question'] as const;
type Partie = (typeof PARTIES)[number];

export const RELECTURE_VIDE = {
  parties: { titre: false, contexte: false, resume: false, points_cles: false, impact: false, explications: false, question: false },
  par: null,
  le: null,
};

export const RELECTURE_COMPLETE = {
  parties: { titre: true, contexte: true, resume: true, points_cles: true, impact: true, explications: true, question: true },
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

/** Une citation construite par le serveur porte toujours la ligne de l'article (`article_id`). */
export const CITATION_CODE_CIVIL = {
  law_id: 2285,
  article_id: 94790,
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

/** Les extraits remis au modèle : rendus par la génération, puis gardés avec l'article. */
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

/**
 * Une phrase contrôlée, à la forme du contrat. `nature` (avenant du tour 7) :
 * « regle » par défaut, comme l'API quand le modèle ne la dit pas.
 */
export const phrase = (
  id: string,
  partie: string,
  index: number,
  texte: string,
  verdict: string,
  extraits: number[] = [],
  raison = '',
  nature: 'regle' | 'autre' = 'regle',
) => ({ id, partie, index, texte, verdict, extraits, raison, nature });

const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Un texte sous sa forme canonique, comme l'API (`_canon`) : les blancs ramenés à une espace. */
const canon = (v: unknown) => String(v ?? '').split(/\s+/).filter(Boolean).join(' ');
const entier = (v: unknown): number | null => (typeof v === 'boolean' || v === null || v === undefined || v === '' ? null : Number.isInteger(Number(v)) ? Number(v) : null);
/** Un passage de la base, comme `cle_d_article` : texte, ligne, numéro d'article, début ou suite. */
const cleDArticle = (lawId: unknown, articleId: unknown, numero: unknown, suite: unknown) =>
  JSON.stringify([entier(lawId), entier(articleId), String(numero ?? '').trim(), suite === true]);

/**
 * Une explication ne se relit qu'avec l'article qu'elle accompagne ET
 * l'extrait qu'en montre la carte (`_identite_de_citation` de l'API, tour 4).
 */
const identiteDExplication = (c: Objet) => [
  entier(c.law_id),
  entier(c.article_id),
  String(c.article_number ?? '').trim(),
  c.suite === true,
  c.verifie === true,
  canon(c.title),
  canon(c.excerpt),
];

const citationsDe = (article: Objet): Objet[] => {
  const analyse = (article.botAnalysis ?? {}) as Objet;
  return (Array.isArray(analyse.citations) ? analyse.citations : []).filter(estObjet);
};

/** Le texte de chaque partie relue, titre compris, sous sa forme canonique. */
function texteDesParties(article: Objet): Record<Partie, unknown> {
  const analyse = (article.botAnalysis ?? {}) as Objet;
  return {
    titre: canon(article.title),
    contexte: canon(article.context),
    resume: canon(analyse.summary),
    points_cles: ((analyse.keyPoints ?? []) as unknown[]).map(canon).filter(Boolean),
    impact: canon(analyse.citizenImpact),
    explications: citationsDe(article).map(identiteDExplication),
    question: canon(article.suggestedQuestion),
  };
}

const vide = (valeur: unknown) => (Array.isArray(valeur) ? valeur.length === 0 : valeur === '');

/**
 * Les sources valables, comme `sources_valables` : un numéro entier d'au moins
 * 1, jamais deux fois, un extrait non vide ; triées par numéro.
 */
function sourcesValables(sources: unknown): Objet[] {
  const vues = new Map<number, Objet>();
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!estObjet(source)) continue;
    const n = entier(source.n);
    if (n === null || n < 1 || vues.has(n) || !String(source.extrait ?? '').trim()) continue;
    vues.set(n, source);
  }
  return [...vues.entries()].sort(([a], [b]) => a - b).map(([, s]) => s);
}

const sourcesCanon = (sources: unknown) =>
  sourcesValables(sources).map((s) => [entier(s.n), cleDArticle(s.law_id, s.article_id, s.article_number, s.suite), canon(s.extrait)]);

/** Le texte que juge le contrôle, partie par partie, titre compris, ET les sources : son « empreinte » ici. */
export function empreinteDuTexte(article: Objet): string {
  return JSON.stringify({ parties: texteDesParties(article), sources: sourcesCanon(article.sources) });
}

/** La partie relue de chaque partie de phrase (`PARTIE_RELUE` de l'API). */
const PARTIE_RELUE: Record<string, Partie> = {
  titre: 'titre',
  contexte: 'contexte',
  resume: 'resume',
  point_cle: 'points_cles',
  impact: 'impact',
  explication: 'explications',
  question: 'question',
};

/** Les (phrase, verdict) que le contrôle enregistré donne à la partie ; `null` sans contrôle. */
function verdictsDeLaPartie(controle: unknown, partie: Partie): string[][] | null {
  if (!estObjet(controle) || !Array.isArray(controle.phrases)) return null;
  return controle.phrases
    .filter((p): p is Objet => estObjet(p) && PARTIE_RELUE[String(p.partie)] === partie)
    .map((p) => [String(p.texte ?? ''), String(p.verdict ?? '')]);
}

/**
 * Ce qu'atteste la case cochée d'une partie (`empreintes_de_relecture`) : son
 * texte, les sources, et les verdicts que le contrôle enregistré lui donne.
 * `null` pour une partie vide : rien à relire.
 */
function attestation(article: Objet, partie: Partie): string | null {
  const valeur = texteDesParties(article)[partie];
  if (vide(valeur)) return null;
  return JSON.stringify([partie, valeur, sourcesCanon(article.sources), verdictsDeLaPartie(article.controle_ia, partie)]);
}

/**
 * Les cases telles que le serveur les rend (`parties_relues`) : une partie est
 * relue si sa case atteste le texte, les sources et les verdicts
 * d'aujourd'hui ; une partie vide l'est toujours.
 */
function partiesRelues(article: Objet): Record<Partie, boolean> {
  const parties = ((estObjet(article.relecture) && estObjet(article.relecture.parties) ? article.relecture.parties : {}) as Objet);
  return Object.fromEntries(
    PARTIES.map((p) => {
      const atteste = attestation(article, p);
      return [p, atteste === null || parties[p] === atteste];
    }),
  ) as Record<Partie, boolean>;
}

/** Un article de test dont les cases (booléens) deviennent ce qu'elles attestent dans l'état de départ. */
function avecDesAttestations(article: Objet): Objet {
  const relecture = (estObjet(article.relecture) ? article.relecture : {}) as Objet;
  const parties = (estObjet(relecture.parties) ? relecture.parties : {}) as Objet;
  const confirmees = Array.isArray(relecture.phrases_confirmees) ? relecture.phrases_confirmees : [];
  return {
    ...article,
    relecture: {
      par: relecture.par ?? null,
      le: relecture.le ?? null,
      controle: relecture.controle ?? null,
      parties: Object.fromEntries(PARTIES.map((p) => [p, parties[p] === true ? attestation(article, p) : null])),
      phrases_confirmees: Object.fromEntries(
        confirmees.filter((id): id is string => typeof id === 'string').map((id) => [id, attestationDeLaPhrase(article, id)]),
      ),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Les phrases de règle à confirmer (avenant du tour 7)                         */
/* -------------------------------------------------------------------------- */

const phrasesDuControle = (controle: unknown): Objet[] =>
  estObjet(controle) && Array.isArray(controle.phrases) ? controle.phrases.filter(estObjet) : [];

/** « regle » sauf « autre » dit en toutes lettres (`lire_la_nature`). */
const natureDe = (p: Objet) => (String(p.nature ?? '').trim().toLowerCase() === 'autre' ? 'autre' : 'regle');

/** Une phrase de règle « non soutenue » ou « hors des sources » : à réécrire, ou à confirmer. */
const estAConfirmer = (p: Objet) => natureDe(p) === 'regle' && (p.verdict === 'non_soutenue' || p.verdict === 'hors_sources');

/**
 * Ce qu'atteste la confirmation d'une phrase (`empreintes_a_confirmer` de
 * l'API) : la phrase telle que le contrôle enregistré la juge (identifiant,
 * partie, texte, verdict) et les sources. `null` si le contrôle n'a pas cette
 * phrase, ou ne la dit pas à confirmer.
 */
function attestationDeLaPhrase(article: Objet, id: string): string | null {
  const p = phrasesDuControle(article.controle_ia).find((q) => String(q.id) === id);
  if (!p || !estAConfirmer(p)) return null;
  return JSON.stringify(['phrase', id, String(p.partie), canon(p.texte), String(p.verdict), sourcesCanon(article.sources)]);
}

/** La partie relue d'une phrase du contrôle enregistré, par identifiant. */
const partieDeLaPhrase = (article: Objet, id: string): Partie | undefined =>
  PARTIE_RELUE[String(phrasesDuControle(article.controle_ia).find((q) => String(q.id) === id)?.partie ?? '')];

/** Les confirmations enregistrées (id → ce qu'elles attestaient). */
function confirmationsEnregistrees(article: Objet): Record<string, unknown> {
  const relecture = estObjet(article.relecture) ? article.relecture : {};
  return estObjet(relecture.phrases_confirmees) ? relecture.phrases_confirmees : {};
}

/** Les phrases confirmées qui comptent encore, dans l'ordre de l'article. */
function confirmationsQuiComptent(article: Objet): string[] {
  const enregistrees = confirmationsEnregistrees(article);
  return phrasesDuControle(article.controle_ia)
    .map((p) => String(p.id))
    .filter((id) => id in enregistrees && enregistrees[id] !== null && enregistrees[id] === attestationDeLaPhrase(article, id));
}

/** Les phrases de règle à confirmer que personne n'a confirmées. */
function phrasesNonConfirmees(article: Objet): Objet[] {
  const confirmees = new Set(confirmationsQuiComptent(article));
  return phrasesDuControle(article.controle_ia).filter((p) => estAConfirmer(p) && !confirmees.has(String(p.id)));
}

/**
 * Les phrases d'un article, une par élément de chaque partie, toutes du même
 * verdict : de quoi simuler le contrôle d'un texte quelconque (un article
 * d'avant la vérification, par exemple).
 */
export function phrasesDe(article: Objet, verdict = 'soutenue', extraits: number[] = [1]): ReturnType<typeof phrase>[] {
  const analyse = (article.botAnalysis ?? {}) as Objet;
  const elements: [string, number, unknown][] = [
    ['titre', 0, article.title],
    ['contexte', 0, article.context],
    ['resume', 0, analyse.summary],
    ...((analyse.keyPoints ?? []) as unknown[]).map((p, i): [string, number, unknown] => ['point_cle', i, p]),
    ['impact', 0, analyse.citizenImpact],
    ...citationsDe(article).map((c, i): [string, number, unknown] => ['explication', i, c.title ?? c.explication]),
    ['question', 0, article.suggestedQuestion],
  ];
  return elements
    .filter(([, , texte]) => typeof texte === 'string' && texte.trim() !== '')
    .map(([partie, index, texte], i) => phrase(`q${i + 1}`, partie, index, String(texte).trim(), verdict, extraits, 'Simulé par le test.'));
}

/**
 * Les phrases du brouillon d'exemple : chacune soutenue, sauf l'impact (« À
 * vérifier ») et le contexte (« Hors des sources »). Les raisons ont la forme
 * de l'API : le passage vérifié est cité à la fin, avec les mots DE L'EXTRAIT
 * (« — Extrait 3 : « … » », tour 5) ; un verdict rétrogradé faute de passage
 * réel commence par « À vérifier : » et nomme le morceau introuvable.
 */
export const PHRASES = [
  phrase('p0', 'titre', 0, 'Expulsion sans juge', 'soutenue', [3], 'L’extrait 3 confie l’expulsion du preneur à la juridiction compétente.'),
  phrase('p1', 'contexte', 0, 'Un bailleur de Douala a changé la serrure.', 'hors_sources', [], 'Aucun extrait ne relate ce fait : il plante le décor.', 'autre'),
  phrase(
    'p2',
    'resume',
    0,
    'Le bailleur ne peut pas expulser seul.',
    'soutenue',
    [3],
    'L’extrait 3 confie la résiliation et l’expulsion à la juridiction compétente. — Extrait 3 : « La juridiction compétente statuant à bref délai est saisie de la demande en résiliation du bail et d’expulsion du preneur. »',
  ),
  phrase('p3', 'point_cle', 0, 'Pas d’expulsion sans décision de justice.', 'soutenue', [2, 3], 'Les extraits 2 et 3 encadrent la fin du bail.'),
  phrase(
    'p4',
    'impact',
    0,
    'Saisissez le juge des référés.',
    'non_soutenue',
    [],
    'À vérifier : le contrôle la disait soutenue, sans pouvoir copier un passage des extraits qui le dise (introuvable tel quel dans les extraits : « le juge des référés ordonne »). Sa raison : « Aucun extrait ne parle du juge des référés. »',
    // Un conseil pratique : il ne prête rien au droit, il ne se confirme pas.
    'autre',
  ),
  phrase('p5', 'explication', 0, 'Violation de domicile', 'soutenue', [1], 'L’extrait 1 punit l’introduction dans le domicile d’autrui.'),
  phrase('p6', 'explication', 1, 'Le congé', 'soutenue', [2], 'L’extrait 2 porte sur le congé.'),
  phrase('p7', 'question', 0, 'Que faire si mon bailleur change la serrure ?', 'soutenue', [], 'Une question, sans règle à vérifier.', 'autre'),
];

/**
 * Le contrôle de l'essai réel du 04/11 sur le bail (avenant du tour 7) : deux
 * phrases qui énoncent une RÈGLE, que le contrôle n'a pas trouvée dans les
 * extraits. Le résumé, « À vérifier » (rabattu faute de passage réel) ; le
 * point clé, « Hors des sources ». Elles bloquent la publication jusqu'à leur
 * réécriture ou leur confirmation, une à une.
 */
export const PHRASES_A_CONFIRMER = PHRASES.map((p) =>
  p.id === 'p2'
    ? phrase(
        'p2',
        'resume',
        0,
        'Le bailleur ne peut pas expulser seul.',
        'non_soutenue',
        [],
        'À vérifier : le contrôle la disait soutenue, sans pouvoir copier un passage des extraits qui le dise (introuvable tel quel dans les extraits : « le bailleur ne peut expulser »). Sa raison : « L’extrait 3 confie l’expulsion au juge. »',
      )
    : p.id === 'p3'
      ? phrase('p3', 'point_cle', 0, 'Pas d’expulsion sans décision de justice.', 'hors_sources', [], 'Aucun extrait ne dit cette règle telle quelle.')
      : p,
);

const ANALYSE = {
  summary: 'Le bailleur ne peut pas expulser seul.',
  keyPoints: ['Pas d’expulsion sans décision de justice.'],
  citations: [CITATION_VERIFIEE, CITATION_CODE_CIVIL],
  citizenImpact: 'Saisissez le juge des référés.',
};

const TEXTE = {
  title: 'Expulsion sans juge',
  context: 'Un bailleur de Douala a changé la serrure.',
  botAnalysis: ANALYSE,
  suggestedQuestion: 'Que faire si mon bailleur change la serrure ?',
};

/**
 * Le même article, son contrôle remis à jour : l'empreinte suit son texte et
 * ses sources, et la phrase du titre est son titre. Pour un article d'exemple
 * dont un test change le titre ou le texte.
 */
export function avecLeControleAJour<T extends Objet>(article: T): T {
  const controle = (article.controle_ia ?? {
    fait_le: '2026-10-30T09:12:00+00:00',
    modele: 'ministral-14b-latest',
    phrases: PHRASES,
  }) as Objet;
  const phrases = ((controle.phrases ?? []) as Objet[]).map((p) => (p.partie === 'titre' ? { ...p, texte: String(article.title) } : p));
  return { ...article, controle_ia: { ...controle, phrases, empreinte: empreinteDuTexte(article) } };
}

/**
 * Le brouillon d'exemple, tel que le rend la génération : sources gardées,
 * contrôle IA à jour, aucune phrase contredite, rien de relu
 * (« relecture_incomplete »).
 */
export const BROUILLON = {
  id: 12,
  slug: 'bail-expulsion-sans-juge',
  ...TEXTE,
  category: 'Immobilier',
  publishedAt: '2026-10-30',
  readingTime: '4 min',
  tags: ['bail'],
  isPublished: false,
  avertissements: [] as string[],
  sources: SOURCES,
  controle_ia: {
    fait_le: '2026-10-30T09:12:00+00:00',
    modele: 'ministral-14b-latest',
    empreinte: empreinteDuTexte({ ...TEXTE, sources: SOURCES }),
    phrases: PHRASES,
  },
  relecture: RELECTURE_VIDE,
  etat_publication: 'relecture_incomplete',
};

/** Le même article, publié et lisible du public : contrôlé, relu, publiable. */
export const PUBLIE = avecLeControleAJour({
  ...BROUILLON,
  id: 13,
  slug: 'bail-expulsion-en-ligne',
  title: 'Expulsion sans juge : l’article en ligne',
  isPublished: true,
  relecture: RELECTURE_COMPLETE,
  etat_publication: 'publiable',
});

/** Le contrôle de l'essai réel sur le bail : l'expulsion sans juge, contredite par l'art. 133. */
export const PHRASES_AVEC_CONTRADICTION = PHRASES.map((p) =>
  p.id === 'p2'
    ? phrase('p2', 'resume', 0, 'Le bailleur ne peut pas expulser seul.', 'contredite', [3], 'L’extrait 3 dit le contraire : la juridiction prononce l’expulsion.')
    : p,
);

/* -------------------------------------------------------------------------- */
/* La doublure du serveur                                                      */
/* -------------------------------------------------------------------------- */

/** L'état de publication d'un article, dans l'ordre du contrat (`etat_de_publication`). */
export function etatDe(article: Objet): string {
  if (sourcesValables(article.sources).length === 0) return 'sources_absentes';
  const citations = citationsDe(article);
  if (citations.length === 0 || citations.some((c) => c.verifie !== true)) return 'citations_non_verifiees';
  const controle = article.controle_ia;
  if (!estObjet(controle) || !Array.isArray(controle.phrases) || controle.empreinte !== empreinteDuTexte(article)) return 'controle_a_relancer';
  if (controle.phrases.some((p) => estObjet(p) && p.verdict === 'contredite')) return 'phrases_contredites';
  if (phrasesNonConfirmees(article).length > 0) return 'phrases_a_confirmer';
  if (!Object.values(partiesRelues(article)).every(Boolean)) return 'relecture_incomplete';
  return 'publiable';
}

const NOMS_DES_PARTIES: Record<Partie, string> = {
  titre: 'titre',
  contexte: 'contexte',
  resume: 'résumé',
  points_cles: 'points clés',
  impact: 'impact pour le citoyen',
  explications: 'explications des citations',
  question: 'question suggérée',
};

/** Le `detail` d'une publication refusée, comme `motif_du_refus` (raccourci). */
function motifDuRefus(etat: string, article: Objet): string {
  switch (etat) {
    case 'sources_absentes':
      return "Publication refusée : l'article n'a pas les sources sur lesquelles il a été écrit (article d'avant le contrôle IA, ou écrit à la main). Reconstruisez-les, citez des articles parmi elles, relancez le contrôle IA, puis relisez chaque partie.";
    case 'citations_non_verifiees':
      return citationsDe(article).length === 0
        ? "Publication refusée : l'article ne cite aucun article de la base. Citez au moins un article, relancez le contrôle IA, puis relisez chaque partie."
        : "Publication refusée : une citation n'est pas vérifiée dans la base. Retirez-la ou citez à nouveau l'article, relancez le contrôle IA, puis relisez les explications.";
    case 'controle_a_relancer':
      return estObjet(article.controle_ia)
        ? 'Publication refusée : le texte ou les sources ont changé depuis le contrôle IA. Relancez le contrôle, puis relisez les parties concernées.'
        : "Publication refusée : le contrôle IA n'a pas été fait sur cet article (il a échoué, l'article a été écrit à la main, ou ses sources ont été reconstruites). Lancez-le, puis relisez chaque partie.";
    case 'phrases_contredites':
      return 'Publication refusée : le contrôle IA a trouvé des phrases que les extraits contredisent. Corrigez-les, relancez le contrôle, puis relisez les parties corrigées.';
    case 'phrases_a_confirmer': {
      const restantes = phrasesNonConfirmees(article);
      const nombre = restantes.length === 1 ? 'une phrase de règle' : `${restantes.length} phrases de règle`;
      return `Publication refusée : ${nombre} que le contrôle IA n'a pas trouvée(s) dans les extraits n'est ni réécrite ni confirmée (« ${String(restantes[0]?.texte ?? '')} »). Réécrivez-la et relancez le contrôle, ou confirmez-la après l'avoir vérifiée dans le texte.`;
    }
    default: {
      const relues = partiesRelues(article);
      const aRelire = PARTIES.filter((p) => !relues[p]).map((p) => NOMS_DES_PARTIES[p]);
      return `Publication refusée : la relecture n'est pas complète. À relire contre les sources et les verdicts du contrôle, puis à cocher : ${aRelire.join(', ')}.`;
    }
  }
}

/** « Sources absentes », comme `_avertissements_d_etat` de l'API. */
const SANS_SOURCES_DANS_L_ETAT =
  "Sources absentes : l'article n'a pas les extraits sur lesquels il a été écrit (article d'avant le contrôle IA, ou écrit à la main). Reconstruisez ses sources, citez des articles parmi elles, puis lancez le contrôle IA et relisez chaque partie : il n'est pas publiable avant.";

/** Le refus du contrôle sans sources (`SANS_SOURCES` de controle_du_billet). */
const SANS_SOURCES_POUR_LE_CONTROLE =
  "L'article n'a pas de sources enregistrées (article d'avant le contrôle IA, ou écrit à la main) : rien contre quoi juger ses phrases. Reconstruisez d'abord ses sources, citez des articles parmi elles, puis relancez le contrôle.";

/** Le refus d'un contrôle relancé sur un article publié, sans confirmation (`ARTICLE_EN_LIGNE` de routes/blog, tour 5). */
export const ARTICLE_EN_LIGNE =
  "Contrôle non relancé : l'article est en ligne. Un nouveau contrôle peut juger autrement des phrases : leurs parties seraient à relire, et l'article ne serait plus servi au public jusqu'à cette relecture. Rien n'a été fait : confirmez la relance ({\"confirmer\": true}) pour la lancer.";

/**
 * Le refus de cases cochées contre un autre contrôle que celui enregistré
 * (`relecture_perimee` de controle_du_billet, tour 5) : sans contrôle
 * enregistré, sans `controle` nommé, ou un autre que l'enregistré.
 */
export function motifDeRelecturePerimee(enregistreLe: string | undefined, lu: unknown): string {
  if (!enregistreLe) {
    return "Relecture refusée : aucun contrôle IA n'est enregistré pour cet article, les cases n'ont rien à attester. Rien n'a été enregistré : lancez le contrôle IA, puis relisez chaque partie contre ses verdicts.";
  }
  if (typeof lu !== 'string' || !lu.trim()) {
    return "Relecture refusée : les cases cochées ne disent pas contre quel contrôle IA elles l'ont été (relecture.controle, le fait_le du contrôle relu). Rien n'a été enregistré : relisez l'article, puis cochez de nouveau.";
  }
  return `Relecture périmée : les cases cochées portent sur un autre contrôle IA que celui enregistré (fait le ${enregistreLe}, relancé depuis). Rien n'a été enregistré : relisez l'article avec les verdicts du contrôle enregistré, puis cochez de nouveau.`;
}

/** Le refus de confirmations qui nomment une phrase que le contrôle enregistré n'a pas (avenant du tour 7). */
export function motifDeConfirmationsInconnues(inconnues: readonly string[]): string {
  return `Relecture périmée : les phrases confirmées ${inconnues.join(', ')} ne sont pas celles du contrôle IA enregistré (relancé depuis). Rien n'a été enregistré : relisez l'article avec les verdicts du contrôle enregistré, puis confirmez de nouveau.`;
}

/** Ce que l'API recalcule à chaque lecture : la doublure le recalcule aussi, et garde le reste des avertissements de départ. */
const RECALCULES = [/^Citation\s+\d+\s*:\s*non\s+vérifiée/i, /^Aucune\s+citation\b/i, /^Sources\s+absentes\b/i];

/**
 * Les avertissements de l'article tel qu'il est (`avertissements_du_billet`) :
 * chaque citation non vérifiée, l'absence de citation, puis ceux du départ
 * (ce que la relecture de la prose aurait relevé, que la doublure ne calcule
 * pas).
 */
function avertissementsDuBillet(article: Objet): string[] {
  const citations = citationsDe(article);
  const calcules = citations.flatMap((c, i) =>
    c.verifie === true
      ? []
      : [
          `Citation ${i + 1} : non vérifiée (écrite avant la vérification par le serveur). L'article ne peut pas être publié tant qu'elle y est : retirez-la, ou remplacez-la par un article de la base.`,
        ],
  );
  if (citations.length === 0) calcules.push("Aucune citation : l'article ne s'appuie sur aucun texte de la base, et ne peut pas être publié.");
  const deDepart = (Array.isArray(article.avertissements) ? article.avertissements : []).filter(
    (a): a is string => typeof a === 'string' && !RECALCULES.some((motif) => motif.test(a.trim())),
  );
  return [...calcules, ...deDepart];
}

/** Ceux de la route : l'absence de sources (`_avertissements_d_etat`). */
function avertissementsDeLEtat(article: Objet): string[] {
  return sourcesValables(article.sources).length === 0 ? [SANS_SOURCES_DANS_L_ETAT] : [];
}

/** Les parties relues dont le texte change entre deux versions. */
function partiesChangees(avant: Objet, apres: Objet): Partie[] {
  const a = texteDesParties(avant);
  const b = texteDesParties(apres);
  return PARTIES.filter((p) => JSON.stringify(a[p]) !== JSON.stringify(b[p]));
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

/** « Citation 2 (Article 1736 · Code civil) », comme la reconstruction des sources de l'API. */
const nomDeLaCitation = (c: Objet, rang: number) =>
  `Citation ${rang} (Article ${String(c.article_number ?? '?') || '?'}${c.suite === true ? ' (suite)' : ''} · ${String(c.reference ?? '') || 'texte inconnu'})`;

export interface ReponseSimulee {
  statut: number;
  corps: unknown;
}

const refus = (code: string, detail: string): ReponseSimulee => ({ statut: 422, corps: { detail, code } });

/**
 * Un serveur du blog pour UN article. `repondre(methode, chemin, corps)` rend
 * la réponse du contrat ; `article()` l'état enregistré, tel que le front le
 * lit ; `envois` les corps reçus, dans l'ordre.
 *
 * `phrasesDuControle` : les verdicts d'un contrôle neuf (par défaut, ceux du
 * contrôle enregistré, sinon PHRASES). `sourcesReconstruites` : ce que
 * retrouve `POST /sources` (par défaut SOURCES ; vide : 422 sans_source).
 */
export function serveurDuBlog(
  depart: Objet,
  options: { phrasesDuControle?: (article: Objet) => unknown[]; sourcesReconstruites?: Objet[] } = {},
) {
  let enregistre: Objet = avecDesAttestations(JSON.parse(JSON.stringify(depart)));
  const envois: { methode: string; chemin: string; corps: unknown }[] = [];
  /** Les contrôles faits par la doublure : chacun a son `fait_le`, 10:10, 10:11… */
  let controles = 0;
  const versLeFront = (): Objet => {
    const relecture = (estObjet(enregistre.relecture) ? enregistre.relecture : {}) as Objet;
    return {
      ...enregistre,
      sources: sourcesValables(enregistre.sources),
      relecture: {
        parties: partiesRelues(enregistre),
        par: relecture.par ?? null,
        le: relecture.le ?? null,
        controle: typeof relecture.controle === 'string' ? relecture.controle : null,
        phrases_confirmees: confirmationsQuiComptent(enregistre),
      },
      etat_publication: etatDe(enregistre),
      avertissements: [...avertissementsDuBillet(enregistre), ...avertissementsDeLEtat(enregistre)],
    };
  };

  /**
   * L'article tel que le rendent les routes PUBLIQUES (avenant du tour 7) :
   * le texte et les citations, sans rien de la relecture ni de la qualité.
   * `null` s'il n'est pas publié ET publiable (404).
   */
  const versLePublic = (): Objet | null => {
    if (enregistre.isPublished !== true || etatDe(enregistre) !== 'publiable') return null;
    const { controle_ia: _c, relecture: _r, etat_publication: _e, avertissements: _a, sources: _s, ...texte } = enregistre;
    return texte;
  };

  /**
   * La relecture après une modification (`nouvelle_relecture`) : une partie
   * dont le texte change est décochée, même si la requête la coche ; une case
   * envoyée atteste l'état d'après ; `par` et `le` notés quand une case
   * change par le fait de l'administrateur. Des cases cochées gardent le
   * contrôle contre lequel elles l'ont été (`controle`, avenant du tour 5).
   */
  function relectureApres(avant: Objet, apres: Objet, demandees?: Objet, controle?: string, confirmees?: string[]): Objet {
    const ancienne = (estObjet(avant.relecture) ? avant.relecture : {}) as Objet;
    const anciennes = (estObjet(ancienne.parties) ? ancienne.parties : {}) as Objet;
    const changees = partiesChangees(avant, apres);
    const parties: Objet = Object.fromEntries(PARTIES.map((p) => [p, changees.includes(p) ? null : (anciennes[p] ?? null)]));
    const cochees = PARTIES.filter((p) => demandees !== undefined && p in demandees && !changees.includes(p));
    for (const p of cochees) parties[p] = demandees![p] === true ? attestation(apres, p) : null;
    // Les confirmations envoyées remplacent celles d'avant ; absentes, elles
    // restent. Une phrase d'une partie dont le texte change perd la sienne,
    // comme la case de sa partie (`nouvelle_relecture`) : sa réécriture se fait
    // juger par un nouveau contrôle.
    const horsDesPartiesChangees = ([id]: [string, unknown]) => !changees.includes(partieDeLaPhrase(avant, id) as Partie);
    const phrasesConfirmees =
      confirmees === undefined
        ? Object.fromEntries(Object.entries(confirmationsEnregistrees(avant)).filter(horsDesPartiesChangees))
        : Object.fromEntries(
            confirmees
              .map((id): [string, string | null] => [id, attestationDeLaPhrase(apres, id)])
              .filter(([, a]) => a !== null)
              .filter(horsDesPartiesChangees),
          );
    const nouvelle: Objet = {
      par: ancienne.par ?? null,
      le: ancienne.le ?? null,
      controle: ancienne.controle ?? null,
      parties,
      phrases_confirmees: phrasesConfirmees,
    };
    // Le contrôle relu est noté quand une case est cochée, ou une phrase
    // confirmée et gardée (`atteste` de `nouvelle_relecture`).
    const atteste = cochees.some((p) => demandees![p] === true) || (confirmees !== undefined && Object.keys(phrasesConfirmees).length > 0);
    if (atteste) nouvelle.controle = controle ?? null;
    const reluesAvant = partiesRelues(avant);
    const reluesApres = partiesRelues({ ...apres, relecture: nouvelle });
    const confirmationsChangent =
      JSON.stringify(confirmationsQuiComptent(avant)) !== JSON.stringify(confirmationsQuiComptent({ ...apres, relecture: nouvelle }));
    if (cochees.some((p) => reluesAvant[p] !== reluesApres[p]) || confirmationsChangent) {
      return { ...nouvelle, par: 'admin@jurix.cm', le: '2026-10-30T10:05:00+00:00' };
    }
    return nouvelle;
  }

  function modifier(corps: Objet): ReponseSimulee {
    // Retirer du site : toujours accepté, rien d'autre ne change.
    if (Object.keys(corps).length === 1 && corps.is_published === false) {
      enregistre = { ...enregistre, isPublished: false };
      return { statut: 200, corps: versLeFront() };
    }
    // Tout le reste : validé en entier sur une copie, puis appliqué d'un bloc.
    let demandees: Objet | undefined;
    let confirmees: string[] | undefined;
    if (corps.relecture !== undefined && corps.relecture !== null) {
      const parties = estObjet(corps.relecture) ? (corps.relecture.parties ?? {}) : null;
      if (!estObjet(parties)) return refus('entree_invalide', 'Requête invalide — relecture › parties : objet attendu.');
      const inconnues = Object.keys(parties).filter((p) => !(PARTIES as readonly string[]).includes(p) && p !== 'pointsCles').sort();
      if (inconnues.length > 0) {
        return refus(
          'entree_invalide',
          `Requête invalide — relecture › parties : partie(s) inconnue(s) : ${inconnues.join(', ')} (attendues : ${PARTIES.join(', ')}).`,
        );
      }
      if (Object.values(parties).some((v) => typeof v !== 'boolean')) {
        return refus('entree_invalide', 'Requête invalide — relecture › parties : vrai ou faux attendu.');
      }
      demandees = 'pointsCles' in parties && !('points_cles' in parties) ? { ...parties, points_cles: parties.pointsCles } : parties;
      const brutes = (corps.relecture as Objet).phrases_confirmees;
      if (brutes !== undefined && brutes !== null) {
        // `IdDePhrase` de l'API : un texte non vide une fois les blancs retirés.
        if (!Array.isArray(brutes) || brutes.some((id) => typeof id !== 'string' || !id.trim())) {
          return refus('entree_invalide', 'Requête invalide — relecture › phrases_confirmees : liste d’identifiants attendue.');
        }
        confirmees = [...new Set(brutes.map((id) => String(id).trim()))];
      }
      // Une case cochée, comme une phrase confirmée (avenant du tour 7),
      // atteste le contrôle que l'administrateur a lu : celui qu'il nomme doit
      // être le contrôle enregistré (avenant du tour 5).
      if (Object.values(parties).some((v) => v === true) || confirmees !== undefined) {
        const lu = (corps.relecture as Objet).controle;
        const enregistreLe = estObjet(enregistre.controle_ia) ? String(enregistre.controle_ia.fait_le ?? '') : undefined;
        if (!enregistreLe || typeof lu !== 'string' || lu.trim() !== enregistreLe) {
          return refus('relecture_perimee', motifDeRelecturePerimee(enregistreLe, lu));
        }
      }
      if (confirmees !== undefined) {
        const connues = new Set(phrasesDuControle(enregistre.controle_ia).map((p) => String(p.id)));
        const inconnues = confirmees.filter((id) => !connues.has(id));
        if (inconnues.length > 0) return refus('relecture_perimee', motifDeConfirmationsInconnues(inconnues));
      }
    }
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
    const lu = estObjet(corps.relecture) && typeof corps.relecture.controle === 'string' ? corps.relecture.controle : undefined;
    apres.relecture = relectureApres(avant, apres, demandees, lu, confirmees);
    // Publier, ou RESTER en ligne (`is_published` absent sur un article
    // publié), exige l'état « publiable » après la modification : changer le
    // titre d'un article en ligne répond « controle_a_relancer », sauf avec
    // `is_published: false` dans la même requête.
    const publie = corps.is_published === undefined || corps.is_published === null ? avant.isPublished === true : corps.is_published === true;
    if (publie) {
      const etat = etatDe(apres);
      if (etat !== 'publiable') return refus(etat, motifDuRefus(etat, apres));
    }
    apres.isPublished = publie;
    enregistre = apres;
    return { statut: 200, corps: versLeFront() };
  }

  /**
   * Un contrôle neuf du texte enregistré. Une case atteste les verdicts du
   * contrôle d'alors : celles qu'il fait tomber (sa partie jugée autrement),
   * et celles qui ne comptaient déjà plus, sont EFFACÉES
   * (`relecture_apres_un_controle` de l'API, revue du front du tour 5) ; un
   * contrôle suivant qui redonne les verdicts d'avant ne les fait pas revivre.
   * Un article publié ne se contrôle qu'avec `{"confirmer": true}` (409
   * `article_en_ligne` sinon, sans appel au modèle) ; chaque contrôle a son
   * propre `fait_le`.
   */
  function controler(corps?: unknown): ReponseSimulee {
    if (sourcesValables(enregistre.sources).length === 0) return refus('sources_absentes', SANS_SOURCES_POUR_LE_CONTROLE);
    if (enregistre.isPublished === true && !(estObjet(corps) && corps.confirmer === true)) {
      return { statut: 409, corps: { detail: ARTICLE_EN_LIGNE, code: 'article_en_ligne' } };
    }
    const phrases = options.phrasesDuControle?.(enregistre) ?? ((enregistre.controle_ia as Objet | null)?.phrases ?? PHRASES);
    const faitLe = `2026-10-30T10:${String(10 + controles++).padStart(2, '0')}:00+00:00`;
    const avant = enregistre;
    const apres: Objet = {
      ...avant,
      controle_ia: { fait_le: faitLe, modele: 'ministral-14b-latest', empreinte: empreinteDuTexte(avant), phrases },
    };
    const relecture = (estObjet(avant.relecture) ? avant.relecture : {}) as Objet;
    if (estObjet(relecture.parties)) {
      const cochees = relecture.parties;
      apres.relecture = {
        ...relecture,
        parties: Object.fromEntries(
          PARTIES.map((p) => {
            const cochee = cochees[p] ?? null;
            return [p, cochee === attestation(avant, p) && cochee === attestation(apres, p) ? cochee : null];
          }),
        ),
      };
    }
    // Une confirmation ne reste que si elle comptait avec l'ancien contrôle ET
    // compte avec le nouveau : la même phrase, jugée de même (avenant du tour 7).
    const confirmees = confirmationsEnregistrees(avant);
    if (Object.keys(confirmees).length > 0) {
      apres.relecture = {
        ...((apres.relecture ?? relecture) as Objet),
        phrases_confirmees: Object.fromEntries(
          Object.entries(confirmees).filter(
            ([id, atteste]) => atteste !== null && atteste === attestationDeLaPhrase(avant, id) && atteste === attestationDeLaPhrase(apres, id),
          ),
        ),
      };
    }
    enregistre = apres;
    return { statut: 200, corps: versLeFront() };
  }

  /**
   * Les sources refaites par la recherche de la génération
   * (`reconstruire_les_sources`). Les cases n'y sont pas touchées non plus :
   * de nouvelles sources, ou un contrôle effacé, font qu'aucune n'atteste plus
   * l'état d'après.
   */
  function reconstruire(): ReponseSimulee {
    const sources = sourcesValables(options.sourcesReconstruites ?? SOURCES);
    if (sources.length === 0) {
      return refus(
        'sans_source',
        "Aucun texte publié de la base ne traite clairement le sujet de cet article (son titre et son contexte) : les sources n'ont pas été reconstruites, rien n'a changé. Reformulez le titre ou le contexte avec les mots de la loi (par exemple « bail », « licenciement », « succession »), puis recommencez.",
      );
    }
    const portees = new Set(sources.map((s) => cleDArticle(s.law_id, s.article_id, s.article_number, s.suite)));
    const avant = enregistre;
    const gardees: Objet[] = [];
    const avertissements: string[] = [];
    citationsDe(avant).forEach((c, i) => {
      const nom = nomDeLaCitation(c, i + 1);
      if (c.verifie !== true) {
        avertissements.push(
          `${nom} : écrite avant la vérification par le serveur, elle ne renvoie à aucun article lu dans la base. Retirée : citez un article parmi les sources.`,
        );
      } else if (!portees.has(cleDArticle(c.law_id, c.article_id, c.article_number, c.suite))) {
        avertissements.push(
          `${nom} : aucune des sources reconstruites ne porte cet article. Retirée : citez un article parmi les sources, ou ajoutez-le à nouveau par son numéro.`,
        );
      } else {
        gardees.push(c);
      }
    });
    const changees = JSON.stringify(sourcesCanon(avant.sources)) !== JSON.stringify(sourcesCanon(sources));
    let controle = (avant.controle_ia ?? null) as Objet | null;
    if (changees && controle !== null) {
      // Ses numéros d'extraits renvoyaient aux anciennes sources.
      controle = null;
      avertissements.push("Les sources ont changé : le contrôle IA d'avant, fait sur les anciennes, est effacé. Relancez-le, puis relisez chaque partie.");
    }
    if (avant.isPublished === true) {
      avertissements.push("L'article repasse en brouillon : il ne revient en ligne que par « Publier », une fois cité, contrôlé et relu.");
    }
    enregistre = {
      ...avant,
      sources,
      botAnalysis: { ...(avant.botAnalysis as Objet), citations: gardees },
      controle_ia: controle,
      isPublished: false,
    };
    const post = versLeFront();
    return { statut: 200, corps: { post, sources: post.sources, avertissements: [...avertissements, ...avertissementsDuBillet(enregistre)] } };
  }

  function repondre(methode: string, chemin: string, corps?: unknown): ReponseSimulee {
    envois.push({ methode, chemin, corps });
    const id = enregistre.id;
    if (methode === 'PUT' && chemin === `/blog/${id}`) return modifier((corps ?? {}) as Objet);
    if (methode === 'POST' && chemin === `/blog/${id}/controle`) return controler(corps);
    if (methode === 'POST' && chemin === `/blog/${id}/sources`) return reconstruire();
    if (methode === 'GET' && chemin === `/blog/admin/${id}`) return { statut: 200, corps: versLeFront() };
    if (methode === 'GET' && chemin === '/blog/admin/all') return { statut: 200, corps: [versLeFront()] };
    // Les routes publiques (avenant du tour 7) : rien de la relecture.
    if (methode === 'GET' && chemin === '/blog') {
      const publique = versLePublic();
      return { statut: 200, corps: publique ? [publique] : [] };
    }
    if (methode === 'GET' && chemin === `/blog/${encodeURIComponent(String(enregistre.slug))}`) {
      const publique = versLePublic();
      return publique ? { statut: 200, corps: publique } : { statut: 404, corps: { detail: 'Article introuvable.', code: 'introuvable' } };
    }
    return { statut: 404, corps: { detail: 'Not Found' } };
  }

  return { repondre, article: versLeFront, publique: versLePublic, envois };
}
