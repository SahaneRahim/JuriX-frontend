/**
 * Doublures de l'API, sessions simulées et jeux de données des specs de mise
 * en page.
 *
 * POURQUOI CE FICHIER EXISTE. Ces doublures vivaient dans
 * navigation/responsif.spec.ts. Les specs du noir et blanc
 * (navigation/monochrome.spec.ts) et du redimensionnement
 * (navigation/redimensionnement.spec.ts) ouvrent les mêmes pages, avec les
 * mêmes réponses simulées : une copie aurait divergé de l'original à la
 * première retouche. Et une spec ne peut pas en importer une autre — ses
 * tests seraient déclarés une seconde fois dans le fichier qui l'importe.
 *
 * Rien n'y atteint le modèle : le chat, la recherche, la comparaison et
 * l'administration sont interceptés (`page.route`) ; seules les pages rendues
 * par le serveur lisent la vraie API, que `page.route` ne voit pas.
 */

import { devices, expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type {
  AnalyticsOverview,
  AnalyticsSearch,
  AnalyticsUsage,
  Category,
  ComparisonResponse,
  ConversationDetail,
  ConversationSummary,
  Law,
  LawStatus,
  LawType,
  SearchResponse,
  SearchResult,
  SourceRef,
  User,
} from '../../src/lib/types';

export const API = process.env.VITE_API_URL ?? 'http://localhost:8000';
export const EXIGER_BACKEND = process.env.E2E_EXIGER_BACKEND === '1';

/** Un téléphone s'annonce comme tel : ce qui lit l'agent doit y voir un Android. */
export const AGENT_MOBILE = devices['Pixel 7'].userAgent;

// ---------------------------------------------------------------------------
// Attendre que la page ne bouge plus
// ---------------------------------------------------------------------------

/**
 * Attend que la page ne bouge plus avant de la mesurer : réseau calme (le
 * JavaScript et les données sont là), police chargée (Inter change la
 * largeur des textes), transitions finies (les `fly` et
 * `fade` de Svelte passent par l'API Web Animations). Les animations infinies
 * — la pastille qui pulse, les points qui sautent — n'ont pas de fin : elles
 * sont écartées. Le délai borne le tout, une animation en pause ne finissant
 * jamais.
 */
export async function attendreLeRepos(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finies = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
      );
    await Promise.race([
      Promise.all(finies.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((fin) => setTimeout(fin, 3_000)),
    ]);
  });
}

// ---------------------------------------------------------------------------
// La vraie API, et les sessions simulées
// ---------------------------------------------------------------------------

/**
 * Condition qui demande l'API et ses données : sautée sans elles, échouée avec
 * E2E_EXIGER_BACKEND=1, comme dans link-integrity.spec.ts. Sans ce réglage,
 * une suite verte ne prouverait rien des pages rendues par le serveur.
 */
export function exiger(condition: unknown, raison: string): asserts condition {
  if (EXIGER_BACKEND) expect(Boolean(condition), `${raison} (E2E_EXIGER_BACKEND=1)`).toBe(true);
  test.skip(!condition, raison);
}

/**
 * Une liste lue dans la vraie API, vide si elle ne répond pas. Les
 * identifiants viennent de là, jamais du code : un jeu figé pourrit à la
 * première réingestion du corpus. Un hôte éteint fait REJETER la requête, d'où
 * le `catch`.
 */
export async function lireListe<T>(request: APIRequestContext, chemin: string): Promise<T[]> {
  const reponse = await request.get(`${API}/api/v1${chemin}`, { failOnStatusCode: false }).catch(() => null);
  if (!reponse?.ok()) return [];
  const corps = await reponse.json().catch(() => null);
  const liste = corps?.items ?? corps?.laws ?? corps;
  return Array.isArray(liste) ? (liste as T[]) : [];
}

/**
 * Ouvre une page rendue par le serveur. API éteinte, ces pages répondent 503
 * avec la page d'erreur du site : la mesurer reviendrait à tester une autre
 * page.
 */
export async function ouvrirAuServeur(page: Page, chemin: string): Promise<void> {
  const statut = (await page.goto(chemin))?.status() ?? 0;
  exiger(statut !== 503, `${chemin} : API indisponible (503)`);
  expect(statut, `${chemin} : statut`).toBeLessThan(400);
}

/** Un JWT dont seule la charge compte : la signature n'est jamais vérifiée côté client. */
export function jetonValide(): string {
  const charge = { sub: 'rahim@jurix.cm', exp: Math.floor(Date.now() / 1000) + 86_400 };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}.signature-non-verifiee`;
}

/** L'utilisateur tel que le garde src/lib/stores/auth.ts dans `jurix-auth-user`. */
export interface Compte {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  name?: string;
}

export const MEMBRE: Compte = { id: 7, email: 'rahim@jurix.cm', role: 'user', name: 'Rahim Sahane' };
// Superadmin : il voit les boutons de suppression des comptes, la ligne la
// plus large du tableau.
export const SUPERADMIN: Compte = { id: 1, email: 'admin@jurix.cm', role: 'superadmin', name: 'Administration JuriX' };

/**
 * Une session ouverte, posée avant le chargement. Le jeton doit être un vrai
 * triplet base64 à `exp` lointain : `jetonExpire()` jugerait périmé un jeton
 * bidon, et la page repartirait anonyme.
 */
export async function connecter(page: Page, compte: Compte): Promise<void> {
  await page.addInitScript(
    ({ jeton, compte }) => {
      localStorage.setItem('jurix-auth-token', jeton);
      localStorage.setItem('jurix-auth-user', JSON.stringify(compte));
    },
    { jeton: jetonValide(), compte },
  );
}

// ---------------------------------------------------------------------------
// Doublures de l'API
// ---------------------------------------------------------------------------

/** Une réponse simulée : du JSON, ou un flux d'événements (le chat). */
export type Simulee = { json: unknown; statut?: number } | { flux: Record<string, unknown>[] };

/**
 * Intercepte TOUTE l'API de la page. `repondre` donne la réponse d'un appel ;
 * un appel qu'elle ne connaît pas reçoit un 404, noté dans le rapport, au lieu
 * de partir vers le vrai backend : un jeton factice y serait refusé (et un 401
 * déconnecte, voir src/lib/api.ts), et le chat y dépenserait du quota.
 */
export async function intercepterLApi(
  page: Page,
  repondre: (methode: string, chemin: string, url: URL) => Simulee | undefined,
): Promise<void> {
  await page.route('**/api/v1/**', (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    // « /laws/ » et « /laws » sont le même appel pour ces doublures.
    const chemin = url.pathname.replace(/^.*?\/api\/v1/, '').replace(/\/+$/, '') || '/';
    const reponse = repondre(requete.method(), chemin, url);

    if (!reponse) {
      try {
        test.info().annotations.push({ type: 'appel non simulé', description: `${requete.method()} ${chemin}` });
      } catch {
        // Requête tardive, après la fin du test : plus de rapport où l'écrire.
      }
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Non simulé par tests/e2e/doublures.ts' }),
      });
    }
    if ('flux' in reponse) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: reponse.flux.map((evenement) => `data: ${JSON.stringify(evenement)}\n\n`).join(''),
      });
    }
    return route.fulfill({
      status: reponse.statut ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(reponse.json),
    });
  });
}

/**
 * Des titres de la longueur de ceux du corpus : un texte camerounais porte son
 * numéro, sa date et son objet entiers. Les références à barres obliques ne
 * contiennent aucune espace où couper.
 */
export const TEXTES: { titre: string; reference: string; type: LawType }[] = [
  { titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail', reference: 'PRC-4722', type: 'loi' },
  {
    titre:
      'Décret N°2018/9387/CAB/PM du 30 décembre 2018 fixant les modalités d’application de certaines dispositions du Code du travail relatives au licenciement pour motif économique',
    reference: 'N°2018/9387/CAB/PM',
    type: 'décret',
  },
  {
    titre:
      'Ordonnance N°2020/001 du 15 juin 2020 modifiant et complétant certaines dispositions de la loi de finances de la République du Cameroun pour l’exercice 2020',
    reference: 'ORD-2020-001',
    type: 'ordonnance',
  },
  {
    titre:
      'Arrêté conjoint N°00000127/MINFI/MINCOMMERCE du 4 mars 2021 fixant les modalités de contrôle des prix des produits de grande consommation',
    reference: 'N°00000127/MINFI/MINCOMMERCE',
    type: 'arrêté',
  },
  {
    titre: 'Acte uniforme relatif au droit des sociétés commerciales et du groupement d’intérêt économique',
    reference: 'AUDSCGIE-2014',
    type: 'acte uniforme',
  },
  { titre: 'Loi N°2016/007 du 12 juillet 2016 portant Code pénal', reference: 'PRC-4810', type: 'loi' },
];

/** Une référence de dossier comme en citent les réponses : 70 caractères d'un bloc. */
export const REFERENCE_SANS_ESPACE = 'DRH/CONTENTIEUX/2024/0001879/LICENCIEMENT-ECONOMIQUE-COLLECTIF-DOUALA';

export const CATEGORIES: Category[] = [
  'Droit du travail et de la sécurité sociale',
  'Droit des affaires et des sociétés commerciales (OHADA)',
  'Finances publiques, fiscalité et douanes',
  'Droit foncier, domanial et de l’urbanisme',
  'Mines, énergie, eau et ressources naturelles',
  'Droit pénal et procédure pénale',
].map((name, i) => ({
  id: 30 + i,
  name,
  description: 'Textes en vigueur, du plus récent au plus ancien, avec leurs modifications successives.',
  icon: null,
  created_at: '2026-01-01T00:00:00',
  law_count: 40 - i * 5,
}));

// --- Chat ------------------------------------------------------------------

export const QUESTION = 'Quelles indemnités en cas de licenciement économique ?';
export const DEBUT_REPONSE = 'Réponse directe';
export const FIN_REPONSE = 'Réponse simulée par responsif.spec.ts, pour éprouver la mise en page.';
export const SESSION_DU_CHAT = 'sid-responsif';

/**
 * Une réponse longue, dans le markdown que demande le prompt système : titres,
 * liste numérotée, TABLEAU (le plus large des blocs), une URL et une référence
 * sans espace, que seul `overflow-wrap: anywhere` peut couper.
 */
export const REPONSE_LONGUE = [
  `**${DEBUT_REPONSE}**`,
  'Un salarié licencié pour motif économique après deux ans d’ancienneté a droit à une indemnité de licenciement, ' +
    `sauf faute lourde. Le dossier de l’employeur porte une référence de ce genre : ${REFERENCE_SANS_ESPACE}.`,
  '**Ce que disent les textes**',
  [
    '1. Le Code du travail pose le principe de l’indemnité et du préavis.',
    '2. Le décret N°2018/9387/CAB/PM en précise le calcul, par tranche d’ancienneté.',
    '3. Une convention collective peut prévoir mieux que le minimum légal.',
  ].join('\n'),
  [
    '| Ancienneté | Taux par année de service (exemple) | Base de calcul | Texte |',
    '|---|---|---|---|',
    '| De 2 à 5 ans | 20 % | Salaire mensuel moyen des douze derniers mois | Décret N°2018/9387/CAB/PM, article 3 |',
    '| De 6 à 10 ans | 25 % | Salaire mensuel moyen des douze derniers mois | Décret N°2018/9387/CAB/PM, article 3 |',
    '| Plus de 10 ans | 30 % | Salaire mensuel moyen, primes et indemnités comprises | Convention collective nationale du commerce, article 22 |',
  ].join('\n'),
  '**Pour aller plus loin**',
  [
    '- Le texte intégral : https://documents.example.org/textes/decret_2018_9387_cab_pm_modalites_application_code_du_travail_version_consolidee.pdf',
    '- L’inspection du travail de votre ressort peut vérifier le calcul.',
  ].join('\n'),
  FIN_REPONSE,
].join('\n\n');

/** Une source du chat, telle que la porte le dernier événement du flux (`Citation` côté backend). */
export interface SourceDuChat {
  law_id: number;
  law_reference: string;
  law_title: string;
  article_number: string | null;
  article_id: number | null;
  excerpt: string;
  relevance_score: number;
}

export const SOURCES_DU_CHAT: SourceDuChat[] = [
  {
    law_id: 101,
    law_reference: 'PRC-4722',
    law_title: TEXTES[0].titre,
    article_number: '37',
    article_id: 9001,
    excerpt:
      'En cas de licenciement, le travailleur a droit à une indemnité distincte du préavis, calculée sur son ancienneté dans l’entreprise.',
    relevance_score: 0.93,
  },
  {
    law_id: 102,
    law_reference: TEXTES[1].reference,
    law_title: TEXTES[1].titre,
    article_number: '3',
    article_id: 9002,
    excerpt:
      'L’indemnité est calculée par tranche d’ancienneté, sur la base du salaire mensuel moyen des douze derniers mois.',
    relevance_score: 0.88,
  },
  {
    law_id: 103,
    law_reference: 'CCN-COMMERCE/2019/REVISION-GENERALE-DES-CLASSIFICATIONS-PROFESSIONNELLES',
    law_title: 'Convention collective nationale du commerce',
    article_number: null,
    article_id: null,
    excerpt:
      'Les parties signataires conviennent de dispositions plus favorables que le minimum légal pour les salariés comptant plus de dix ans d’ancienneté.',
    relevance_score: 0.71,
  },
];

/**
 * La réponse en flux, comme `/rag/ask/stream` : un morceau par paragraphe,
 * puis le dernier événement, qui porte les sources et la session. Le flux ne
 * porte pas de suggestions (`RAGStreamChunk`) : celles qu'affiche le chat sont
 * les puces du profil, sous le message d'accueil, mesurées avec le reste.
 */
export function evenementsDuChat(): Record<string, unknown>[] {
  return [
    ...REPONSE_LONGUE.split(/(?<=\n\n)/).map((chunk) => ({ chunk, done: false })),
    {
      chunk: '',
      done: true,
      sources: SOURCES_DU_CHAT,
      intent: 'juridique',
      confidence: 0.82,
      session_id: SESSION_DU_CHAT,
      persona: 'citoyen',
    },
  ];
}

/** Des titres longs : la liste les tronque, le tiroir ne doit pas s'élargir pour eux. */
export const TITRES_DE_CONVERSATION = [
  'Licenciement pour motif économique dans une entreprise de plus de cinquante salariés : préavis, indemnités et recours',
  'Bail commercial OHADA : renouvellement, révision du loyer et indemnité d’éviction',
  'Création d’une SARL unipersonnelle à Douala',
  'Succession sans testament : droits du conjoint survivant et des enfants',
];

export const CONVERSATIONS: ConversationSummary[] = Array.from({ length: 12 }, (_, i): ConversationSummary => ({
  session_id: `sid-${i + 1}`,
  // Une conversation sans titre : la liste affiche un repli.
  title: i === 3 ? null : TITRES_DE_CONVERSATION[i % TITRES_DE_CONVERSATION.length],
  persona: 'citoyen',
  language: 'fr',
  created_at: `2026-10-${String(20 - i).padStart(2, '0')}T09:00:00`,
  updated_at: `2026-10-${String(20 - i).padStart(2, '0')}T09:30:00`,
}));

export const REPONSE_ROUVERTE = 'Sauf faute lourde, le licenciement ouvre droit à un préavis et à une indemnité.';

export const CONVERSATION_ROUVERTE: ConversationDetail = {
  ...CONVERSATIONS[0],
  messages: [
    { id: 1, role: 'user', content: 'Mon employeur peut-il me licencier sans préavis ?', created_at: '2026-10-20T09:00:00' },
    { id: 2, role: 'assistant', content: REPONSE_ROUVERTE, created_at: '2026-10-20T09:00:05' },
  ],
};

/** Le chat, sans jamais atteindre le modèle : même une question réelle reste ici. */
export async function simulerLeChat(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/rag/ask/stream') return { flux: evenementsDuChat() };
    if (chemin === '/rag/conversations') return { json: CONVERSATIONS };
    if (chemin === `/rag/conversations/${CONVERSATION_ROUVERTE.session_id}`) return { json: CONVERSATION_ROUVERTE };
    // La synchronisation du profil au démarrage, pour un compte connecté.
    if (chemin === '/auth/me') return { json: { persona: 'citoyen' } };
    return undefined;
  });
}

// --- Recherche -------------------------------------------------------------

export const RESULTATS: SearchResult[] = Array.from({ length: 20 }, (_, i): SearchResult => {
  const texte = TEXTES[i % TEXTES.length];
  const categorie = CATEGORIES[i % CATEGORIES.length];
  return {
    law_id: 700 + i,
    reference: texte.reference,
    title: texte.titre,
    type: texte.type,
    language: 'fr',
    status: 'published',
    category_id: categorie.id,
    category_name: categorie.name,
    publication_date: '1992-08-14',
    relevance_score: 0.95 - i * 0.02,
    match_scope: i % 2 === 0 ? 'body' : 'title',
    // Les articles trouvés s'ajoutent à la carte : la plus haute, et la plus chargée.
    matched_articles:
      i % 3 === 0
        ? [
            {
              article_id: 9100 + i,
              number: '37',
              title: 'Indemnité de licenciement',
              content_snippet:
                'Le contrat de <mark>travail</mark> à durée indéterminée peut cesser par la volonté de l’une des parties, sous réserve du préavis.',
              relevance_score: 0.81,
            },
            {
              article_id: 9200 + i,
              number: '45-1 (nouveau)',
              title: null,
              content_snippet: `Dossier ${REFERENCE_SANS_ESPACE} transmis à l’inspection du <mark>travail</mark>.`,
              relevance_score: 0.62,
            },
          ]
        : [],
    highlights: {
      content: `Toute rupture du contrat de <mark>travail</mark> ouvre droit au préavis, sauf faute lourde. Référence : ${REFERENCE_SANS_ESPACE}.`,
    },
    content: 'Toute rupture du contrat de travail ouvre droit au préavis, sauf faute lourde du travailleur.',
  };
});

/** Bien plus d'une page : la pagination se montre, avec tous ses numéros. */
export const REPONSE_RECHERCHE: SearchResponse = {
  query: 'travail',
  mode: 'hybrid',
  results: RESULTATS,
  total: 137,
  search_time_ms: 312,
  filters_applied: null,
  direct_navigation: false,
  target_law_id: null,
  target_article: null,
};

/** La recherche hybride appelle un modèle d'embeddings : simulée, elle ne coûte rien. */
export async function simulerLaRecherche(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/search') return { json: REPONSE_RECHERCHE };
    if (chemin === '/search/suggest') return { json: { suggestions: [] } };
    if (chemin === '/categories') return { json: CATEGORIES };
    return undefined;
  });
}

// --- Comparaison -----------------------------------------------------------

export const ARTICLE_LONG =
  'Le contrat de travail à durée indéterminée peut cesser par la volonté de l’une des parties. Cette résiliation ' +
  'est subordonnée à un préavis donné par la partie qui prend l’initiative de la rupture, dont la durée tient ' +
  'compte de l’ancienneté du travailleur et de sa catégorie professionnelle. Pendant le préavis, le travailleur ' +
  'dispose d’un jour de liberté par semaine pour chercher un autre emploi.';

/** Une source de cellule : la puce porte la RÉFÉRENCE du texte, parfois sans espace. */
export function sourceComparee(i: number, numero: string): SourceRef {
  const texte = TEXTES[i % TEXTES.length];
  return {
    article_id: 9300 + i,
    law_id: 800 + i,
    law_title: texte.titre,
    reference: texte.reference,
    number: numero,
    article_title: null,
    page_number: 3 + i,
    content: ARTICLE_LONG,
  };
}

export const COMPARAISON: ComparisonResponse = {
  subject_a: 'licenciement pour motif économique',
  subject_b: 'licenciement pour faute lourde',
  language: 'fr',
  rows: [
    {
      criterion: 'Préavis',
      a: {
        value: 'Dû, selon l’ancienneté et la catégorie professionnelle du travailleur.',
        sources: [sourceComparee(0, '34'), sourceComparee(3, '4')],
      },
      b: { value: 'Non dû : la faute lourde prive le travailleur du préavis.', sources: [sourceComparee(0, '36')] },
    },
    {
      criterion: 'Indemnité de licenciement',
      a: {
        value: 'Due après deux ans d’ancienneté, calculée par tranche.',
        sources: [sourceComparee(1, '3'), sourceComparee(3, '4')],
      },
      b: { value: 'Non due.', sources: [sourceComparee(0, '37')] },
    },
    {
      criterion: 'Consultation des délégués du personnel et information de l’inspection du travail',
      a: {
        value: 'Obligatoire avant tout licenciement collectif, avec un ordre des départs.',
        sources: [sourceComparee(2, '40-2 (nouveau)')],
      },
      b: { value: 'Non trouvé dans les textes consultés', sources: [] },
    },
    {
      criterion: 'Recours',
      a: { value: 'Devant l’inspection du travail, puis le tribunal compétent.', sources: [sourceComparee(5, '139')] },
      b: { value: 'Devant le tribunal, qui apprécie la gravité de la faute.', sources: [sourceComparee(5, '139')] },
    },
  ],
  key_differences: [
    'La faute lourde prive à la fois du préavis et de l’indemnité de licenciement.',
    'Le licenciement économique impose une procédure collective, avec consultation et ordre des départs.',
  ],
  blind_spots: ['Le sort des congés payés acquis ne figure pas dans les textes consultés.'],
  articles_a: [sourceComparee(0, '34'), sourceComparee(1, '3')],
  articles_b: [sourceComparee(0, '36')],
  // Une citation sans article : l'avertissement s'affiche, avec le reste.
  unmatched_citations: ['9999'],
  retrieval_time_ms: 140,
  generation_time_ms: 5200,
};

/** La comparaison appelle le modèle : simulée, comme dans comparaison.spec.ts. */
export async function simulerLaComparaison(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => (chemin === '/compare' ? { json: COMPARAISON } : undefined));
}

// --- Administration --------------------------------------------------------

export const STATUTS: LawStatus[] = ['published', 'processing', 'published', 'refused', 'pending', 'draft'];

/** Vingt documents : plus d'une page de quinze (TAILLE_PAGE_ADMIN), la pagination se montre. */
export const LOIS: Law[] = Array.from({ length: 20 }, (_, i): Law => {
  const texte = TEXTES[i % TEXTES.length];
  return {
    id: 500 + i,
    reference: texte.reference,
    title: texte.titre,
    type: texte.type,
    content: 'Article premier.- La présente loi s’applique à tout travailleur exerçant son activité au Cameroun.',
    language: i % 5 === 4 ? 'en' : 'fr',
    category_id: CATEGORIES[i % CATEGORIES.length].id,
    status: STATUTS[i % STATUTS.length],
    publication_date: '2018-12-30',
    detected_language: 'fr',
    language_confidence: 0.98,
    suggested_categories: null,
    category_confidence: null,
    file_id: null,
    original_filename: 'decret_2018_9387_cab_pm_modalites_application_code_du_travail_version_consolidee.pdf',
    article_count: 12 + i,
    created_at: `2026-10-${String(21 - i).padStart(2, '0')}T08:30:00`,
    updated_at: null,
    category: null,
  };
});

/** Vingt comptes, dont des adresses et des identifiants très longs. */
export const UTILISATEURS: User[] = Array.from({ length: 20 }, (_, i): User => ({
  id: i + 1,
  email:
    i === 0
      ? SUPERADMIN.email
      : i % 4 === 1
        ? `agent${i}.direction-des-affaires-juridiques-et-du-contentieux@minjustice.example.cm`
        : `lecteur${i}@jurix.cm`,
  username: i === 0 ? 'admin' : i % 5 === 2 ? `marie_claire_essomba_tchoungui_${i}` : `lecteur${i}`,
  full_name: i % 3 === 0 ? null : 'Marie-Claire Essomba Tchoungui',
  role: i === 0 ? 'superadmin' : i % 6 === 0 ? 'admin' : 'user',
  is_active: i % 7 !== 3,
  is_verified: true,
  created_at: '2026-09-01T10:00:00',
  last_login_at: i % 4 === 3 ? null : '2026-10-20T18:45:00',
}));

export const VUE_D_ENSEMBLE: AnalyticsOverview = {
  total_laws: 1284,
  by_language: { fr: 1150, en: 134 },
  by_status: { published: 1200, processing: 4, refused: 80 },
  recent_laws: 37,
};

export const USAGE: AnalyticsUsage = {
  window_days: 7,
  conversations: 412,
  questions_asked: 1290,
  answers_generated: 1275,
  searches: 3480,
  active_users: 87,
  median_answer_time_ms: 4200,
  personas_usage: { citoyen: 180, avocat: 90, 'étudiant': 70, entrepreneur: 42, general: 30 },
};

export const STATS_RECHERCHE: AnalyticsSearch = {
  window_days: 7,
  total_searches: 3480,
  median_response_time_ms: 310,
  p95_response_time_ms: 1250,
  max_response_time_ms: 4800,
  cache_hit_rate_percent: 42,
  modes_usage: { hybrid: 3000, text: 400, semantic: 80 },
};

/**
 * Le suivi du téléversement par lots (`/batch-upload/status`) : un texte de
 * chaque statut, dont un en échec avec son message, et une progression.
 */
export const SUIVI_DES_LOTS = {
  laws: LOIS.slice(0, 6).map((loi, i) => ({
    id: loi.id,
    title: loi.title,
    reference: loi.reference,
    status: loi.status,
    processing_progress: loi.status === 'processing' ? 45 : null,
    processing_error: loi.status === 'refused' ? 'Extraction impossible : page 3 illisible' : null,
    created_at: loi.created_at,
    processing_started_at: i % 2 === 0 ? loi.created_at : null,
  })),
};

/**
 * Les articles du blog vus par l'administration (`/blog/admin/all`) : un
 * publié et un brouillon, pour que les deux badges de statut s'affichent.
 */
export const ARTICLES_DU_BLOG_ADMIN = [
  {
    id: 1,
    slug: 'licenciement-economique-droits-du-salarie',
    title: 'Licenciement économique : ce que la loi garantit au salarié',
    category: 'Travail',
    publishedAt: '2026-10-26',
    readingTime: '4 min',
    context: 'Plusieurs entreprises de Douala annoncent des suppressions de postes.',
    botAnalysis: {
      summary: 'Le salarié licencié pour motif économique a droit à un préavis et à une indemnité.',
      keyPoints: ['Préavis selon l’ancienneté', 'Indemnité après deux ans'],
      citations: [],
      citizenImpact: 'Vérifiez le calcul de votre indemnité.',
    },
    suggestedQuestion: 'Quelles indemnités en cas de licenciement économique ?',
    tags: ['travail', 'licenciement'],
    isPublished: true,
  },
  {
    id: 2,
    slug: 'bail-commercial-ohada-renouvellement',
    title: 'Bail commercial OHADA : renouvellement et indemnité d’éviction',
    category: 'Affaires',
    publishedAt: '2026-10-20',
    readingTime: '5 min',
    context: 'Des commerçants du marché central contestent le refus de renouvellement de leur bail.',
    botAnalysis: {
      summary: 'Le preneur qui exploite depuis deux ans a droit au renouvellement.',
      keyPoints: ['Droit au renouvellement après deux ans'],
      citations: [],
      citizenImpact: 'Gardez la preuve de votre exploitation.',
    },
    suggestedQuestion: 'Mon bailleur peut-il refuser de renouveler mon bail commercial ?',
    tags: ['ohada', 'bail'],
    isPublished: false,
  },
];

/**
 * L'administration, en superadmin. Tous ses appels sont simulés : rendue dans
 * le navigateur (admin/+layout.ts), elle n'a rien à demander au serveur.
 */
export async function simulerLAdministration(page: Page): Promise<void> {
  await connecter(page, SUPERADMIN);
  // Le suivi en direct des lots (batch-upload) ouvre un WebSocket, que
  // `page.route` ne voit pas : une prise simulée, muette, au lieu du vrai
  // backend, qui refuserait le jeton factice.
  await page.routeWebSocket(/\/batch-upload\/ws\//, () => {});
  await intercepterLApi(page, (methode, chemin, url) => {
    if (methode !== 'GET') return undefined;
    switch (chemin) {
      case '/auth/me':
        return { json: { ...SUPERADMIN, persona: 'citoyen' } };
      case '/analytics/overview':
        return { json: VUE_D_ENSEMBLE };
      case '/analytics/usage':
        return { json: USAGE };
      case '/analytics/search':
        return { json: STATS_RECHERCHE };
      case '/laws':
        // Le tableau de bord demande les 4 derniers, la page des documents tout.
        return { json: LOIS.slice(0, Number(url.searchParams.get('limit')) || LOIS.length) };
      case '/categories':
        return { json: CATEGORIES };
      case '/admin/users':
        return { json: UTILISATEURS };
      case '/batch-upload/status':
        return { json: SUIVI_DES_LOTS };
      case '/blog/admin/all':
        return { json: ARTICLES_DU_BLOG_ADMIN };
      default:
        return undefined;
    }
  });
}

// ---------------------------------------------------------------------------
// Repères communs
// ---------------------------------------------------------------------------

/** La saisie du chat, par son nom accessible : `input` hier, `textarea` qui grandit selon le plan. */
export const saisieDuChat = (page: Page): Locator => page.getByRole('textbox', { name: 'Votre question' });
export const boutonDEnvoi = (page: Page): Locator => page.getByRole('button', { name: 'Envoyer', exact: true });

/** Le premier exemplaire visible : sous md, des cartes peuvent remplacer un tableau, avec le même texte. */
export const visible = (cible: Locator): Locator => cible.filter({ visible: true }).first();
