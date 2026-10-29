/**
 * Tests de $lib/api-publique : les appels de la refonte UX et leur repli sur
 * l'ancienne API, qui reste en ligne tant que `feat/ux-api` n'est pas déployée.
 *
 * Les réponses imitent les exemples RÉELS du contrat (data/ux-impl/
 * contrat-api.md) et la forme de l'API déployée : tableau nu de `GET /laws/`,
 * 404 « Not Found » d'une route inconnue, recherche sans `facets`.
 */

import { describe, expect, it, vi } from 'vitest';
import { API_URL } from '$lib/config';
import {
  adresseDeLArticle,
  affinageNettoye,
  ajouteLe,
  changementsDuMorceau,
  corpsDeRecherche,
  dateDeLActe,
  lireApercuDArticle,
  lireChiffresDuCorpus,
  listerTextes,
  modificationsActuelles,
  naturesDuStatut,
  nombreDeTextesDeLHistorique,
  phraseDuStatutEnBref,
  rechercherTextes,
  sansMarqueursDePage,
  statutJuridiqueDe,
} from '$lib/api-publique';
import type { AffinageDeRecherche, Changement, StatutJuridique, TexteLie } from '$lib/types';

/** Un `fetch` qui rend `corps` (objet : JSON) avec `statut`, et garde ses appels. */
function fetchQuiRend(corps: unknown, statut = 200) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    typeof corps === 'string'
      ? new Response(corps, { status: statut, headers: { 'content-type': 'text/html' } })
      : new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } }),
  );
}

const ROUTE_INCONNUE = { detail: 'Not Found' };

const CORPUS = {
  textes: 2275,
  articles: 27157,
  textes_par_nature: [{ nature: 'décret', textes: 1702 }],
  texte_le_plus_recent: null,
  dernier_ajout_le: '2026-10-14',
  liens_releves_le: '2026-10-14',
  sources: [{ code: 'prc', libelle: { fr: 'prc.cm', en: 'prc.cm' }, textes: 2275 }],
  libelle_sources: { fr: 'textes officiels camerounais, OHADA et CIMA', en: 'official texts of Cameroon, OHADA and CIMA' },
  calcule_le: '2026-10-28T16:34:58.286131Z',
};

describe('lireChiffresDuCorpus', () => {
  it('lit GET /corpus', async () => {
    const f = fetchQuiRend(CORPUS);
    expect(await lireChiffresDuCorpus({ fetch: f })).toEqual(CORPUS);
    expect(f.mock.calls[0][0]).toBe(`${API_URL}/corpus`);
    // Borné par le délai de $lib/config.
    expect(f.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('rend null sur l’ancienne API, une panne ou une autre forme, sans lever', async () => {
    expect(await lireChiffresDuCorpus({ fetch: fetchQuiRend(ROUTE_INCONNUE, 404) })).toBeNull();
    expect(await lireChiffresDuCorpus({ fetch: fetchQuiRend({ detail: 'x' }, 503) })).toBeNull();
    expect(await lireChiffresDuCorpus({ fetch: fetchQuiRend('<html>proxy</html>') })).toBeNull();
    expect(await lireChiffresDuCorpus({ fetch: fetchQuiRend({ textes: '2275' }) })).toBeNull();
    const rejet = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await lireChiffresDuCorpus({ fetch: rejet })).toBeNull();
  });
});

const APERCU = {
  law_id: 2143,
  texte: { id: 2143, reference: 'PRC-6283', nature: 'loi', numero: '96/06', titre: 'Loi N°96/06', date_signature: '1996-01-18', annee: 1996, date_publication_jo: null, consultable: true },
  numero: '6',
  titre: null,
  section: 'TITRE PREMIER',
  page: 8,
  article_ids: [75144, 75145],
  contenu: '(1) Le Président de la République est élu…',
  tronque: false,
  englobant: false,
  homonymes: [],
  statut: { releve_le: '2026-10-14', etat_du_texte: 'modifie', version_en_base: null, changements: [] },
};

describe('lireApercuDArticle', () => {
  it('encode le numéro et transmet article_id', async () => {
    const f = fetchQuiRend(APERCU);
    expect(await lireApercuDArticle(2143, '6', 75144, { fetch: f })).toEqual(APERCU);
    expect(f.mock.calls[0][0]).toBe(`${API_URL}/laws/2143/articles/6?article_id=75144`);

    await lireApercuDArticle(12, ' L 7 bis ', null, { fetch: f });
    expect(f.mock.calls[1][0]).toBe(`${API_URL}/laws/12/articles/L%207%20bis`);
    await lireApercuDArticle(12, 'TRENTE-TROISIÈME', 0, { fetch: f });
    expect(f.mock.calls[2][0]).toBe(`${API_URL}/laws/12/articles/TRENTE-TROISI%C3%88ME`);
  });

  it('rend null sur un 404 (article absent, ou route inconnue de l’ancienne API) et sur une autre forme', async () => {
    expect(await lireApercuDArticle(2143, '999', null, { fetch: fetchQuiRend({ detail: 'Article 999 introuvable' }, 404) })).toBeNull();
    expect(await lireApercuDArticle(2143, '6', null, { fetch: fetchQuiRend(ROUTE_INCONNUE, 404) })).toBeNull();
    expect(await lireApercuDArticle(2143, '6', null, { fetch: fetchQuiRend({ contenu: 'x' }) })).toBeNull();
  });

  it('ne demande rien pour un numéro que l’API refuserait', async () => {
    const f = fetchQuiRend(APERCU);
    expect(await lireApercuDArticle(2143, '  ', null, { fetch: f })).toBeNull();
    expect(await lireApercuDArticle(2143, 'x'.repeat(65), null, { fetch: f })).toBeNull();
    expect(await lireApercuDArticle(0, '6', null, { fetch: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('donne l’adresse de repli, celle de « Lire dans le texte intégral »', () => {
    expect(adresseDeLArticle(2274, '35')).toBe('/laws/2274?article=35');
    expect(adresseDeLArticle(2274, 'L 7 bis')).toBe('/laws/2274?article=L%207%20bis');
    expect(adresseDeLArticle(2274, null)).toBe('/laws/2274');
    expect(adresseDeLArticle(2274, ' ')).toBe('/laws/2274');
  });
});

const LIGNE_NOUVELLE = {
  id: 1087,
  reference: 'PRC-10759',
  title: 'Décret N°2026/285 du 31 août 2026 portant nomination…',
  type: 'décret',
  language: 'fr',
  status: 'published',
  category_id: 13,
  category_name: 'Fonction Publique',
  publication_date: '2026-08-31',
  article_count: 3,
  objet: 'Nomination des Officiers Magistrats',
  numero: '2026/285',
  date_signature: '2026-08-31',
  annee: 2026,
  date_publication_jo: null,
  statut: null,
};

/** Une ligne de l'API déployée : texte compris, sans repères. */
function ligneAncienne(id: number) {
  return { id, reference: `PRC-${id}`, title: `Texte ${id}`, type: 'décret', content: '', language: 'fr', category_id: 13, status: 'published', publication_date: '2020-05-04', article_count: 2, created_at: '2026-10-03T00:00:00', updated_at: null, category: null };
}

describe('listerTextes', () => {
  it('envoie les paramètres des deux modes dans une seule requête', async () => {
    const f = fetchQuiRend({ items: [], total: 0, page: 3, page_size: 20, pages: 0, sort: 'date_desc' });
    await listerTextes({ categorie: 13, langue: 'fr', page: 3 }, { fetch: f });
    const url = new URL(String(f.mock.calls[0][0]));
    expect(`${url.origin}${url.pathname}`).toBe(`${API_URL}/laws/`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '3',
      page_size: '20',
      sort: 'date_desc',
      skip: '40',
      limit: '21',
      content_max_chars: '0',
      category_id: '13',
      language: 'fr',
    });
  });

  it('lit la page légère de la nouvelle API, sans la cote ni le statut de publication', async () => {
    const f = fetchQuiRend({ items: [LIGNE_NOUVELLE], total: 1277, page: 2, page_size: 20, pages: 64, sort: 'date_desc' });
    const lecture = await listerTextes({ categorie: 13, page: 2 }, { fetch: f });
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.valeur).toMatchObject({ page: 2, parPage: 20, total: 1277, pages: 64, suivante: true, tri: 'date_desc' });
    const [ligne] = lecture.valeur.lignes;
    expect(ligne).toEqual({
      id: 1087,
      title: LIGNE_NOUVELLE.title,
      type: 'décret',
      language: 'fr',
      category_id: 13,
      category_name: 'Fonction Publique',
      publication_date: '2026-08-31',
      article_count: 3,
      objet: 'Nomination des Officiers Magistrats',
      numero: '2026/285',
      date_signature: '2026-08-31',
      annee: 2026,
      date_publication_jo: null,
      statut: null,
    });
  });

  it('dit la dernière page sans suite', async () => {
    const f = fetchQuiRend({ items: [], total: 1277, page: 999, page_size: 20, pages: 64, sort: 'date_desc' });
    const lecture = await listerTextes({ page: 999 }, { fetch: f });
    expect(lecture.ok && lecture.valeur.suivante).toBe(false);
  });

  it('se replie sur le tableau nu de l’ancienne API : ni total, ni tri annoncé', async () => {
    const vingtEtUn = Array.from({ length: 21 }, (_, i) => ligneAncienne(i + 1));
    const lecture = await listerTextes({ page: 1 }, { fetch: fetchQuiRend(vingtEtUn) });
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    expect(lecture.valeur).toMatchObject({ total: null, pages: null, tri: null, suivante: true, page: 1 });
    expect(lecture.valeur.lignes).toHaveLength(20);
    // Repères absents : la page sait qu'elle parle à l'ancienne API.
    expect('objet' in lecture.valeur.lignes[0]).toBe(false);
    expect('content' in lecture.valeur.lignes[0]).toBe(false);
    expect('reference' in lecture.valeur.lignes[0]).toBe(false);

    const cinq = await listerTextes({ page: 2 }, { fetch: fetchQuiRend(vingtEtUn.slice(0, 5)) });
    expect(cinq.ok && cinq.valeur.suivante).toBe(false);
  });

  it('borne les paramètres venus d’une adresse', async () => {
    const f = fetchQuiRend([]);
    await listerTextes({ page: Number('abc'), parPage: 500 }, { fetch: f });
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('100');
    await listerTextes({ page: 1e21, parPage: 0 }, { fetch: f });
    const url2 = new URL(String(f.mock.calls[1][0]));
    expect(url2.searchParams.get('page')).toBe('10000000');
    expect(url2.searchParams.get('page_size')).toBe('1');
  });

  it('rend la cause d’une panne ou d’une réponse étrangère, pour le 503 de la page', async () => {
    const panne = await listerTextes({}, { fetch: fetchQuiRend({ detail: 'x' }, 503) });
    expect(panne.ok).toBe(false);
    if (!panne.ok) expect((panne.cause as Response).status).toBe(503);
    expect((await listerTextes({}, { fetch: fetchQuiRend({ resultat: 1 }) })).ok).toBe(false);
  });
});

describe('corpsDeRecherche', () => {
  it('impose les textes publiés et laisse la recherche classique sans paramètre affiné', () => {
    expect(corpsDeRecherche({ query: 'bail' })).toEqual({
      query: 'bail',
      mode: 'hybrid',
      limit: 20,
      offset: 0,
      filters: { status: 'published' },
    });
    const avecStatut = corpsDeRecherche({ query: 'bail', filters: { status: 'draft' } as never });
    expect(avecStatut.filters?.status).toBe('published');
  });

  it('n’envoie tri, filtres et effectifs que s’ils disent quelque chose', () => {
    const corps = corpsDeRecherche({
      query: 'indemnité',
      sort: 'pertinence',
      facets: true,
      refine: { types: ['decret'], category_ids: [] },
      limit: 80,
      offset: -3,
    });
    expect(corps).toMatchObject({ sort: 'pertinence', facets: true, refine: { types: ['decret'] }, limit: 50, offset: 0 });
    expect(corpsDeRecherche({ query: 'x', refine: { types: [] }, facets: false })).not.toHaveProperty('refine');
    expect(corpsDeRecherche({ query: 'x', facets: false })).not.toHaveProperty('facets');
  });

  it('nettoie `refine` : clés connues seulement, bornes remises dans l’ordre', () => {
    // Une clé inconnue donnerait 422 (« nature » pour « types »).
    const brut = { nature: ['loi'], types: ['loi', ' '], year_from: 2020, year_to: 2010, date_from: '2024-13', date_to: '2024-12-31' };
    expect(affinageNettoye(brut as AffinageDeRecherche)).toEqual({
      types: ['loi'],
      year_from: 2010,
      year_to: 2020,
      date_to: '2024-12-31',
    });
    expect(affinageNettoye({ year_from: 1800, year_to: 2300 })).toBeUndefined();
    expect(affinageNettoye({ date_from: '2025-01-01', date_to: '2024-01-01' })).toEqual({
      date_from: '2024-01-01',
      date_to: '2025-01-01',
    });
  });
});

function resultat(champs: Record<string, unknown> = {}) {
  return {
    law_id: 2274,
    reference: 'LOI-1992-007',
    title: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    type: 'loi',
    language: 'fr',
    status: 'published',
    category_id: 4,
    category_name: 'Travail',
    publication_date: '1992-08-14',
    relevance_score: 1,
    match_scope: 'body',
    matched_articles: [{ article_id: 97420, number: '35.1', title: null, content_snippet: '<<PAGE:12>> a droit à une <mark>indemnité</mark>', relevance_score: 1 }],
    highlights: { content: 'entreprise <<PAGE: 3>>  une <mark>indemnité</mark>' },
    content: '<<PAGE:1>>(1) Pendant la durée du préavis',
    ...champs,
  };
}

const REPONSE_CLASSIQUE = {
  query: 'indemnité',
  mode: 'hybrid',
  total: 25,
  search_time_ms: 822,
  filters_applied: null,
  target_law_id: null,
  target_article: null,
  direct_navigation: false,
  results: [resultat()],
};

describe('rechercherTextes', () => {
  it('poste le corps et retire les marqueurs de page des extraits', async () => {
    const f = fetchQuiRend({ ...REPONSE_CLASSIQUE, sort: null, candidates: null, facets: null });
    const lecture = await rechercherTextes({ query: 'indemnité' }, { fetch: f });
    expect(f.mock.calls[0][0]).toBe(`${API_URL}/search/`);
    expect(f.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual(corpsDeRecherche({ query: 'indemnité' }));
    expect(lecture.ok).toBe(true);
    if (!lecture.ok) return;
    const [r] = lecture.valeur.reponse.results;
    expect(r.highlights.content).toBe('entreprise une <mark>indemnité</mark>');
    expect(r.content).toBe('(1) Pendant la durée du préavis');
    expect(r.matched_articles[0].content_snippet).toBe('a droit à une <mark>indemnité</mark>');
    // Parcours classique de la nouvelle API : rien d'affiné.
    expect(lecture.valeur.affinee).toBe(false);
  });

  it('reconnaît la recherche affinée à ses effectifs, et l’ancienne API à leur absence', async () => {
    const facets = { types: [{ value: 'décret', count: 12 }], categories: [], years: [] };
    const affinee = await rechercherTextes(
      { query: 'indemnité', facets: true },
      { fetch: fetchQuiRend({ ...REPONSE_CLASSIQUE, sort: 'pertinence', candidates: 25, facets }) },
    );
    expect(affinee.ok && affinee.valeur.affinee).toBe(true);
    if (affinee.ok) expect(affinee.valeur.reponse.facets).toEqual(facets);

    // L'API déployée ignore `facets` et ne rend pas la clé.
    const ancienne = await rechercherTextes({ query: 'indemnité', facets: true }, { fetch: fetchQuiRend(REPONSE_CLASSIQUE) });
    expect(ancienne.ok && ancienne.valeur.affinee).toBe(false);
  });

  it('rend la cause d’un échec (422, panne, réponse sans résultats)', async () => {
    const refus = await rechercherTextes({ query: 'x' }, { fetch: fetchQuiRend({ detail: [{ loc: ['body'] }] }, 422) });
    expect(refus.ok).toBe(false);
    expect((await rechercherTextes({ query: 'x' }, { fetch: fetchQuiRend({ total: 0 }) })).ok).toBe(false);
  });

  it('tolère un résultat sans extraits ni articles', async () => {
    const nu = { ...resultat(), highlights: undefined, matched_articles: undefined, content: null };
    const lecture = await rechercherTextes({ query: 'x' }, { fetch: fetchQuiRend({ ...REPONSE_CLASSIQUE, results: [nu] }) });
    expect(lecture.ok).toBe(true);
    if (lecture.ok) {
      expect(lecture.valeur.reponse.results[0]).toMatchObject({ highlights: {}, matched_articles: [], content: null });
    }
  });

  it('retire les marqueurs, espaces compris', () => {
    expect(sansMarqueursDePage('a <<PAGE:2>> b<<PAGE: 13>>\nc')).toBe('a bc');
  });
});

/* -------------------------------------------------------------------------- */
/* Lecture des champs                                                          */
/* -------------------------------------------------------------------------- */

function texte(champs: Partial<TexteLie> = {}): TexteLie {
  return { id: 1761, reference: 'PRC-10679', nature: 'loi', numero: '2026/002', titre: 'Loi N°2026/002', date_signature: '2026-04-14', annee: 2026, date_publication_jo: null, consultable: true, ...champs };
}

function changement(id: string, champs: Partial<Changement> = {}): Changement {
  return {
    id,
    sens: 'modifie_par',
    type: 'modifie',
    nature_modification: 'modifie',
    libelle: 'modifié',
    texte: texte(),
    etendue: 'articles',
    articles_cibles: [],
    section: null,
    articles_source: [],
    portee: null,
    depasse: false,
    depasse_par: null,
    integre_au_texte: false,
    ...champs,
  };
}

/** La Constitution (`GET /laws/2143`), d'après l'exemple réel du contrat §3.4. */
const LOI_2008 = texte({ id: 1500, reference: 'PRC-2008', numero: '2008/001', titre: 'Loi N°2008/001' });
const CONSTITUTION: StatutJuridique = {
  releve_le: '2026-10-14',
  etat: 'modifie',
  types: ['modifie', 'complete'],
  abroge: false,
  abroge_par: null,
  version_en_base: null,
  modifie_par: [
    changement('c1', { texte: LOI_2008, articles_cibles: ['14', '15', '51'] }),
    changement('c2', { texte: LOI_2008, type: 'complete', articles_cibles: ['67'] }),
    changement('c3', { texte: LOI_2008, articles_cibles: ['6', '53'], depasse: true }),
    changement('c4', { nature_modification: 'reecrit_en_entier', libelle: 'réécrit en entier', articles_cibles: ['6'] }),
    changement('c5', { articles_cibles: ['5', '7', '10', '53', '66'] }),
  ],
  modifie: [],
  par_article: { '6': ['c3', 'c4'] },
  par_morceau: { '75144': ['c3', 'c4'], '75145': ['c3', 'c4'], '75143': ['c5'] },
};

describe('statutJuridiqueDe', () => {
  it('ne lit qu’un statut présent et bien formé', () => {
    expect(statutJuridiqueDe({ statut_juridique: CONSTITUTION })).toBe(CONSTITUTION);
    // Ancienne API : la clé manque. Nouvelle API, calcul en échec : null.
    expect(statutJuridiqueDe({})).toBeNull();
    expect(statutJuridiqueDe({ statut_juridique: null })).toBeNull();
    expect(statutJuridiqueDe({ statut_juridique: { etat: 'modifie' } as never })).toBeNull();
  });
});

describe('dateDeLActe', () => {
  it('suit l’ordre du contrat sur la nouvelle API : signature, JO, année', () => {
    expect(dateDeLActe({ date_signature: '2021-12-28', annee: 2021, date_publication_jo: null, publication_date: '2021-12-28' })).toEqual({ genre: 'signature', date: '2021-12-28' });
    expect(dateDeLActe({ date_signature: null, annee: 2023, date_publication_jo: '2023-11-15', publication_date: '2023-11-15' })).toEqual({ genre: 'journal_officiel', date: '2023-11-15' });
    // « 1er janvier de remplissage » : seule l'année est sûre.
    expect(dateDeLActe({ date_signature: null, annee: 1974, date_publication_jo: null, publication_date: '1974-01-01' })).toEqual({ genre: 'annee', annee: 1974 });
    expect(dateDeLActe({ date_signature: null, annee: null, date_publication_jo: null })).toBeNull();
    // Un texte lié (sans `publication_date`), et `date_publication_jo` absente.
    expect(dateDeLActe(texte())).toEqual({ genre: 'signature', date: '2026-04-14' });
    expect(dateDeLActe({ date_signature: null, annee: 2019 })).toEqual({ genre: 'annee', annee: 2019 });
  });

  it('garde `publication_date` sur l’ancienne API, sauf un 1er janvier que l’intitulé ne confirme pas', () => {
    expect(dateDeLActe({ publication_date: '2021-12-28', title: 'Décret du 28 décembre 2021' })).toEqual({ genre: 'date', date: '2021-12-28' });
    expect(dateDeLActe({ publication_date: '2020-01-01', title: 'Loi de 2020 portant…' })).toEqual({ genre: 'annee', annee: 2020 });
    expect(dateDeLActe({ publication_date: '2020-01-01', title: 'Décret du 1er janvier 2020' })).toEqual({ genre: 'date', date: '2020-01-01' });
    expect(dateDeLActe({ publication_date: '2020-01-01' })).toEqual({ genre: 'annee', annee: 2020 });
    expect(dateDeLActe({ publication_date: null })).toBeNull();
    expect(dateDeLActe({ publication_date: 'inconnue' })).toBeNull();
  });
});

describe('ajouteLe', () => {
  it('lit `ajoute_le`, ou le jour de `created_at` sur l’ancienne API', () => {
    expect(ajouteLe({ ajoute_le: '2026-10-03', created_at: '2026-10-03T14:24:16.889003' })).toBe('2026-10-03');
    expect(ajouteLe({ created_at: '2026-10-03T14:24:16.889003' })).toBe('2026-10-03');
    expect(ajouteLe({ created_at: null })).toBeNull();
  });
});

describe('statut en bref', () => {
  const CODE_CIVIL = { abroge: false, textes: 12, natures: { complete: 1, abroge_partiellement: 11 }, date_dernier_texte: '2024-12-23' };

  it('range les natures dans l’ordre du contrat, sans clé inconnue ni effectif nul', () => {
    expect(naturesDuStatut(CODE_CIVIL)).toEqual([
      { nature: 'abroge_partiellement', textes: 11 },
      { nature: 'complete', textes: 1 },
    ]);
    const futur = { ...CODE_CIVIL, natures: { suspendu: 2, modifie: 0, remplace_partiellement: 1 } } as never;
    expect(naturesDuStatut(futur)).toEqual([{ nature: 'remplace_partiellement', textes: 1 }]);
    expect(naturesDuStatut(null)).toEqual([]);
    expect(naturesDuStatut(undefined)).toEqual([]);
  });

  const FR: Record<string, string> = {
    'statut.bref.abroge': 'abrogé par {n}',
    'statut.bref.remplace': 'remplacé par {n}',
    'statut.bref.abroge_partiellement': 'abrogé en partie par {n}',
    'statut.bref.remplace_partiellement': 'remplacé en partie par {n}',
    'statut.bref.modifie': 'modifié par {n}',
    'statut.bref.complete': 'complété par {n}',
    'statut.bref.texte': 'texte',
    'statut.bref.textes': 'textes',
    'statut.bref.et': 'et',
  };
  const traduire = (cle: string) => FR[cle] ?? cle;

  it('écrit la phrase de la maquette, le nom ne suivant que le premier nombre', () => {
    expect(phraseDuStatutEnBref(CODE_CIVIL, traduire)).toBe('Abrogé en partie par 11 textes et complété par 1');
    expect(phraseDuStatutEnBref({ ...CODE_CIVIL, natures: { abroge_partiellement: 1 } }, traduire)).toBe('Abrogé en partie par 1 texte');
    expect(
      phraseDuStatutEnBref({ ...CODE_CIVIL, natures: { remplace: 1, modifie: 2, complete: 3 } }, traduire),
    ).toBe('Remplacé par 1 texte, modifié par 2 et complété par 3');
    expect(phraseDuStatutEnBref(null, traduire)).toBe('');
  });
});

describe('statut d’un texte : morceaux, encadré, historique', () => {
  it('trouve les changements d’un morceau par `par_morceau`', () => {
    expect(changementsDuMorceau(CONSTITUTION, 75145).map((c) => c.id)).toEqual(['c3', 'c4']);
    expect(changementsDuMorceau(CONSTITUTION, 1)).toEqual([]);
  });

  it('nomme les textes modificatifs actuels, regroupés, sans les dépassés ni les intégrés', () => {
    const groupes = modificationsActuelles(CONSTITUTION);
    expect(groupes.map((g) => [g.texte.numero, g.changements.map((c) => c.id)])).toEqual([
      ['2008/001', ['c1', 'c2']],
      ['2026/002', ['c4', 'c5']],
    ]);
    const integre = { ...CONSTITUTION, modifie_par: [changement('c9', { integre_au_texte: true })] };
    expect(modificationsActuelles(integre)).toEqual([]);
  });

  it('compte les textes distincts de l’historique, dépassés compris', () => {
    expect(nombreDeTextesDeLHistorique(CONSTITUTION)).toBe(2);
    const horsCorpus = changement('c6', { sens: 'modifie', texte: texte({ id: null, reference: null, titre: 'Décret n° 77/245' }) });
    expect(nombreDeTextesDeLHistorique({ ...CONSTITUTION, modifie: [horsCorpus] })).toBe(3);
  });
});
