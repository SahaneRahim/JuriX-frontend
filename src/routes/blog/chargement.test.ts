import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOG_POSTS } from '$lib/data/blog';
import { ARTICLE_ANCIEN, ARTICLE_ANCIEN_PUBLIC, ECRIT_PAR_LE_MODELE } from '$lib/data/blog-anciens-de-test';
import { load as chargerLaListe } from './+page.server';
import { load as chargerLArticle } from './[slug]/+page.server';

/**
 * Les chargements du blog, au serveur (revue du 29/10) :
 * - un délai (DELAI_API_MS) sur chaque appel : une API figée retenait la page
 *   45 s ;
 * - une panne de l'API sur un article de l'API : 503, plus « introuvable » ;
 * - un brouillon n'est jamais servi, ni un article qui n'est pas
 *   « publiable » (contrat du 30/10 : publié avant la vérification, contrôle
 *   à relancer, relecture incomplète…) ;
 * - la réponse publique du tour 7, sans `controle_ia`, `relecture` ni
 *   `etat_publication` : les pages n'en ont pas besoin ;
 * - les trois articles de la rédaction toujours listés, et servis pendant une
 *   panne ;
 * - l'API sans route /blog (la production du 29/10) : tout continue de marcher.
 */

const json = (corps: unknown, statut = 200, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json', ...entetes } });

/** Une citation construite par le serveur et vérifiée (contrat du 30/10). */
const CITATION_VERIFIEE = {
  law_id: 2236,
  article_id: 501,
  article_number: '299',
  reference: 'Code pénal (loi n° 2016/007)',
  title: 'Violation de domicile',
  excerpt: 'Est puni d’un emprisonnement de dix (10) jours à un (01) an…',
  url: '/laws/2236?article=299',
  verifie: true,
};

const ARTICLE_API = {
  id: 9,
  slug: 'coupure-eau-locataire',
  title: 'Coupure d’eau : ce que peut le bailleur',
  category: 'Immobilier',
  publishedAt: '2026-10-29',
  readingTime: '4 min',
  context: 'Un locataire de Yaoundé…',
  botAnalysis: { summary: 'Non.', keyPoints: [{ point: 'objet' }, 'Texte'], citations: [null, CITATION_VERIFIEE], citizenImpact: 'Agir.' },
  suggestedQuestion: 'Que faire ?',
  tags: [],
  isPublished: true,
  etat_publication: 'publiable',
};

type Fetch = typeof fetch;
const appelsDe = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map(([url, init]) => ({ url: String(url), init }));

async function statutDeLErreur(promesse: Promise<unknown>): Promise<number | null> {
  try {
    await promesse;
    return null;
  } catch (e) {
    return (e as { status?: number }).status ?? -1;
  }
}

const lireListe = (fetch: Fetch) => chargerLaListe({ fetch } as never) as Promise<{ posts: { slug: string }[] }>;
const lireArticle = (fetch: Fetch, slug: string) =>
  chargerLArticle({ fetch, params: { slug } } as never) as Promise<{ post: { slug: string; title: string; botAnalysis: { keyPoints: string[] } } }>;

afterEach(() => vi.restoreAllMocks());

describe('/blog (liste)', () => {
  it('API sans route /blog (production du 29/10) : liste vide', async () => {
    const fetch = vi.fn(async () => json({ detail: 'Not Found' }, 404));
    const { posts } = await lireListe(fetch as unknown as Fetch);
    expect(posts).toEqual([]);
  });

  it('chaque appel porte un délai (DELAI_API_MS)', async () => {
    const fetch = vi.fn(async () => json([]));
    await lireListe(fetch as unknown as Fetch);
    const [{ url, init }] = appelsDe(fetch);
    expect(url).toMatch(/\/api\/v1\/blog$/);
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('les articles de l’API seuls : ceux écrits à la main sont cachés du public (décision du propriétaire)', async () => {
    const fetch = vi.fn(async () => json([ARTICLE_API, { ...ARTICLE_API, slug: 'brouillon', isPublished: false }]));
    const { posts } = await lireListe(fetch as unknown as Fetch);
    expect(posts.map((p) => p.slug)).toEqual(['coupure-eau-locataire']);
  });

  it('API en panne, figée ou illisible : liste vide, sans erreur', async () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const reponse of [
      () => Promise.reject(new TypeError('fetch failed')),
      () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
      () => Promise.resolve(json({ detail: 'boom' }, 500)),
      () => Promise.resolve(new Response('<html>proxy</html>', { status: 200 })),
    ]) {
      const { posts } = await lireListe(vi.fn(reponse) as unknown as Fetch);
      expect(posts).toEqual([]);
    }
    // La panne laisse une trace dans le journal.
    expect(avertir).toHaveBeenCalled();
  });
});

describe('/blog/[slug] (article)', () => {
  const STATIQUE = BLOG_POSTS[0].slug;

  it('article de l’API publié : servi, normalisé (point clé objet, citation null)', async () => {
    const fetch = vi.fn(async () => json(ARTICLE_API));
    const { post } = await lireArticle(fetch as unknown as Fetch, 'coupure-eau-locataire');
    expect(post.title).toBe(ARTICLE_API.title);
    expect(post.botAnalysis.keyPoints).toEqual(['Texte']);
    expect((post as unknown as { botAnalysis: { citations: unknown[] } }).botAnalysis.citations).toHaveLength(1);
    const [{ init }] = appelsDe(fetch);
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('le slug de l’adresse est encodé dans l’appel à l’API', async () => {
    const fetch = vi.fn(async () => json({ detail: 'Article introuvable' }, 404));
    await statutDeLErreur(lireArticle(fetch as unknown as Fetch, 'a b?c#d'));
    expect(appelsDe(fetch)[0].url).toMatch(/\/blog\/a%20b%3Fc%23d$/);
  });

  it('un brouillon n’est jamais servi, même si l’API le renvoie', async () => {
    const fetch = vi.fn(async () => json({ ...ARTICLE_API, isPublished: false }));
    expect(await statutDeLErreur(lireArticle(fetch as unknown as Fetch, 'coupure-eau-locataire'))).toBe(404);
  });

  it('absence dite par l’API : 404 (article inconnu, ou API sans route /blog)', async () => {
    for (const detail of ['Article \'x\' introuvable', 'Not Found']) {
      const fetch = vi.fn(async () => json({ detail }, 404));
      expect(await statutDeLErreur(lireArticle(fetch as unknown as Fetch, 'inconnu')), detail).toBe(404);
    }
  });

  it('panne de l’API sur un article de l’API : 503, et non « introuvable »', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const reponse of [
      () => Promise.reject(new TypeError('fetch failed')),
      () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
      () => Promise.resolve(json({ detail: 'boom' }, 500)),
      () => Promise.resolve(json({ detail: 'boom' }, 503)),
      // Le 404 de Railway (domaine du service retiré) n'est pas une absence.
      () => Promise.resolve(json({ status: 'error' }, 404, { 'x-railway-fallback': 'true' })),
      () => Promise.resolve(new Response('Not Found', { status: 404, headers: { 'content-type': 'text/html' } })),
      // Un 200 qui n'est pas un article lisible.
      () => Promise.resolve(new Response('<html>', { status: 200 })),
      () => Promise.resolve(json({ inattendu: true })),
    ]) {
      expect(await statutDeLErreur(lireArticle(vi.fn(reponse) as unknown as Fetch, 'article-de-l-api'))).toBe(503);
    }
  });

  it('un article écrit à la main n’est plus servi : 404 sans lui dans l’API, 503 en panne', async () => {
    const absent = vi.fn(async () => json({ detail: 'Article introuvable' }, 404));
    expect(await statutDeLErreur(lireArticle(absent as unknown as Fetch, STATIQUE))).toBe(404);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const panne = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
    expect(await statutDeLErreur(lireArticle(panne as unknown as Fetch, STATIQUE))).toBe(503);
  });

  it('une adresse trop longue pour la base ne coûte aucun appel', async () => {
    const fetch = vi.fn(async () => json(ARTICLE_API));
    expect(await statutDeLErreur(lireArticle(fetch as unknown as Fetch, 'x'.repeat(300)))).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('article publié avant la vérification : caché du public (décision du propriétaire du 30/10)', () => {
  // La ligne 1 de jurix_dev, publiée le 26/10. La route publique du contrat
  // du 30/10 ne la sert plus ; si une API la renvoyait encore (avec ses
  // extraits, comme celle du 29/10, ou réduite), son adresse répond 404 et
  // elle n'est pas listée : sa prose, écrite de mémoire par le modèle, ne
  // doit atteindre aucun lecteur. Rien d'elle ne part vers le navigateur.
  it.each([
    ['API du 29/10 (sans état de publication)', ARTICLE_ANCIEN],
    ['citations réduites, sans état', ARTICLE_ANCIEN_PUBLIC],
    ['état « citations non vérifiées »', { ...ARTICLE_ANCIEN_PUBLIC, etat_publication: 'citations_non_verifiees' }],
    // Une API qui se tromperait d'état : les citations non vérifiées suffisent.
    ['état « publiable » par erreur', { ...ARTICLE_ANCIEN_PUBLIC, etat_publication: 'publiable' }],
  ])('%s : 404 à son adresse, absent de la liste', async (_nom, ligne) => {
    expect(await statutDeLErreur(lireArticle(vi.fn(async () => json(ligne)) as unknown as Fetch, ligne.slug))).toBe(404);
    const liste = await lireListe(vi.fn(async () => json([ligne])) as unknown as Fetch);
    expect(liste.posts.map((p) => p.slug)).not.toContain(ligne.slug);
    const donnees = JSON.stringify(liste);
    for (const ecrit of [...ECRIT_PAR_LE_MODELE, ligne.botAnalysis.summary, ligne.context]) expect(donnees, ecrit).not.toContain(ecrit);
    expect(liste.posts).toEqual([]);
  });
});

describe('article de l’API qui n’est pas « publiable » : jamais servi (contrat du 30/10)', () => {
  it.each([
    ['relecture incomplète', 'relecture_incomplete'],
    ['contrôle IA à relancer', 'controle_a_relancer'],
    ['phrase contredite', 'phrases_contredites'],
    ['phrase de règle à confirmer (tour 7)', 'phrases_a_confirmer'],
    ['état illisible', 'publie'],
  ])('%s : 404, absent de la liste', async (_nom, etat) => {
    const ligne = { ...ARTICLE_API, etat_publication: etat };
    expect(await statutDeLErreur(lireArticle(vi.fn(async () => json(ligne)) as unknown as Fetch, ligne.slug))).toBe(404);
    const { posts } = await lireListe(vi.fn(async () => json([ligne])) as unknown as Fetch);
    expect(posts.map((p) => p.slug)).not.toContain(ligne.slug);
  });

  it('sans aucune citation, même dit « publiable » : 404, absent de la liste (règle du correctif public du 04/11)', async () => {
    // Le correctif du propriétaire (dépôt du backend, 5bdcb4f) ne sert qu'un
    // article qui a au moins une citation, toutes vérifiées : le front tient
    // la même règle, quoi que dise l'état du serveur.
    for (const citations of [[], [null]]) {
      const ligne = { ...ARTICLE_API, botAnalysis: { ...ARTICLE_API.botAnalysis, citations } };
      expect(await statutDeLErreur(lireArticle(vi.fn(async () => json(ligne)) as unknown as Fetch, ligne.slug))).toBe(404);
      const { posts } = await lireListe(vi.fn(async () => json([ligne])) as unknown as Fetch);
      expect(posts.map((p) => p.slug)).not.toContain(ligne.slug);
    }
  });

  it('à l’adresse d’un article écrit à la main, non publiable : 404', async () => {
    const ligne = { ...ARTICLE_API, slug: BLOG_POSTS[0].slug, etat_publication: 'relecture_incomplete' };
    expect(await statutDeLErreur(lireArticle(vi.fn(async () => json(ligne)) as unknown as Fetch, ligne.slug))).toBe(404);
  });

  it('la réponse publique du tour 7, sans rien de la relecture : servie, à son adresse et dans la liste', async () => {
    // Avenant du tour 7 : `GET /blog` et `GET /blog/{slug}` ne rendent plus
    // `controle_ia`, `relecture` ni `etat_publication` ; la route publique ne
    // sert que des articles publiés ET publiables. Les pages n'en dépendent pas.
    const { etat_publication: _etat, ...ligne } = ARTICLE_API;
    const { post } = await lireArticle(vi.fn(async () => json(ligne)) as unknown as Fetch, ligne.slug);
    expect(post.title).toBe(ARTICLE_API.title);
    const { posts } = await lireListe(vi.fn(async () => json([ligne])) as unknown as Fetch);
    expect(posts.map((p) => p.slug)).toContain(ligne.slug);
    // Toujours pas sans citations vérifiées, ni en brouillon.
    const brouillon = { ...ligne, isPublished: false };
    expect(await statutDeLErreur(lireArticle(vi.fn(async () => json(brouillon)) as unknown as Fetch, ligne.slug))).toBe(404);
    const sansCitation = { ...ligne, botAnalysis: { ...ligne.botAnalysis, citations: [] } };
    expect(await statutDeLErreur(lireArticle(vi.fn(async () => json(sansCitation)) as unknown as Fetch, ligne.slug))).toBe(404);
  });

  it('publiable : servi, sans renvoi « (extrait N) » dans ses données', async () => {
    const ligne = {
      ...ARTICLE_API,
      botAnalysis: { ...ARTICLE_API.botAnalysis, summary: 'Non, sans décision de justice (extrait 2).', keyPoints: ['Texte (extraits 5 et 9).'] },
    };
    const { post } = await lireArticle(vi.fn(async () => json(ligne)) as unknown as Fetch, ligne.slug);
    expect(JSON.stringify(post)).not.toMatch(/extraits? \d/);
    expect(post.botAnalysis.keyPoints).toEqual(['Texte.']);
  });
});
