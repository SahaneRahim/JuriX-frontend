// @vitest-environment node
import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELAI_API_MS } from '$lib/config';

/**
 * Les `load` des pages publiques face à une API en panne : 503, avec sa cause
 * au journal, au rendu serveur comme en navigation dans le navigateur.
 *
 * Ces pages sont mises en cache par Vercel (ISR), leurs `__data.json`
 * compris : une page en 200 portant « Impossible de charger » y serait gardée
 * et servie à tous pendant toute l'expiration, à la place de la bonne version.
 * Un 503 n'est jamais gardé, et Vercel continue de servir la version
 * précédente. Le message et le bouton de reprise propres à chaque page ont
 * donc laissé la place à la page d'erreur du site (503, lien « Réessayer »),
 * en navigation aussi : src/hooks.server.ts fait passer le statut de l'erreur
 * dans la réponse HTTP des requêtes de données (voir hooks.server.test.ts).
 *
 * Seul un test unitaire peut le vérifier : en e2e, `page.route` n'intercepte
 * que les appels du navigateur, alors que ceux des `load` serveur partent du
 * serveur Node, même pendant une navigation.
 */

import { load as chargerAccueil } from '../routes/(main)/+page.server';
import { load as chargerCategorie } from '../routes/categories/[id]/+page.server';
import { load as chargerListe } from '../routes/laws/+page.server';
import { load as chargerFiche } from '../routes/laws/[id]/+page.server';

type Appel = (entree: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const PANNES: [string, Appel][] = [
  ['réseau coupé', () => Promise.reject(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }))],
  ['erreur 500', async () => new Response('boum', { status: 500 })],
  ['délai dépassé', () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))],
  ['corps illisible (un proxy répond à la place de l’API)', async () => new Response('<html>', { status: 200 })],
];

interface Page {
  nom: string;
  chemin: string;
  charger: (fetch: Appel, navigation: boolean) => Promise<unknown>;
}

// `navigation` : true pour une requête de données (`__data.json`, navigation
// dans le navigateur), false au rendu serveur d'une page.
const PAGES: Page[] = [
  {
    nom: 'accueil',
    chemin: '/',
    charger: async (fetch, navigation) => chargerAccueil({ fetch, isDataRequest: navigation } as never),
  },
  {
    nom: 'fiche',
    chemin: '/laws/12',
    charger: async (fetch, navigation) =>
      chargerFiche({ fetch, params: { id: '12' }, isDataRequest: navigation } as never),
  },
  {
    nom: 'liste',
    chemin: '/laws',
    charger: async (fetch, navigation) =>
      chargerListe({ fetch, url: new URL('http://site/laws'), isDataRequest: navigation } as never),
  },
  {
    nom: 'catégorie',
    chemin: '/categories/3',
    charger: async (fetch, navigation) =>
      chargerCategorie({
        fetch,
        params: { id: '3' },
        url: new URL('http://site/categories/3'),
        isDataRequest: navigation,
      } as never),
  },
];

const MODES: [string, boolean][] = [
  ['au rendu serveur', false],
  ['en navigation (requête de données)', true],
];

function journal() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(PAGES)('$nom', (page) => {
  describe.each(MODES)('%s', (_mode, navigation) => {
    it.each(PANNES)('%s : 503, cause au journal', async (_panne, appel) => {
      const espion = journal();
      await expect(page.charger(vi.fn(appel), navigation)).rejects.toSatisfy((e) => isHttpError(e, 503));
      expect(espion).toHaveBeenCalledOnce();
      expect(String(espion.mock.calls[0][0])).toMatch(`[503] ${page.chemin} : API indisponible (`);
    });
  });

  it('borne chaque appel à l’API par le délai de $lib/config', async () => {
    journal();
    const minuterie = vi.spyOn(AbortSignal, 'timeout');
    const fetch = vi.fn<Appel>(async () => new Response('boum', { status: 500 }));
    await page.charger(fetch, true).catch(() => undefined);
    expect(fetch).toHaveBeenCalled();
    for (const [, init] of fetch.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(minuterie).toHaveBeenCalledWith(DELAI_API_MS);
  });
});

/** Une catégorie telle que la rend `GET /categories` (CategoryResponse). */
const categorie = (id: number, name = `Catégorie ${id}`) => ({
  id,
  name,
  description: null,
  icon: '⚖️',
  created_at: '2026-10-15T00:30:00',
  law_count: 16,
});

describe('ce qui n’est pas une panne', () => {
  it.each([false, true])('une fiche absente reste une 404 (requête de données : %s)', async (navigation) => {
    const espion = journal();
    const fetch = vi.fn<Appel>(async () => new Response('{}', { status: 404 }));
    await expect(
      chargerFiche({ fetch, params: { id: '12' }, isDataRequest: navigation } as never),
    ).rejects.toSatisfy((e) => isHttpError(e, 404));
    expect(espion).not.toHaveBeenCalled();
  });

  it.each([
    ['sa liste de documents répond', async () => Response.json([])],
    ['sa liste de documents est en panne', async () => new Response('boum', { status: 500 })],
  ])('une catégorie absente de /categories reste une 404 (%s)', async (_cas, lois: Appel) => {
    const espion = journal();
    const fetch = vi.fn<Appel>(async (entree, init) =>
      String(entree).includes('/laws/') ? lois(entree, init) : Response.json([categorie(1), categorie(2)]),
    );
    await expect(
      chargerCategorie({
        fetch,
        params: { id: '3' },
        url: new URL('http://site/categories/3'),
        isDataRequest: false,
      } as never),
    ).rejects.toSatisfy((e) => isHttpError(e, 404));
    expect(espion).not.toHaveBeenCalled();
  });

  it.each(['012', '1e3', 'abc', '99999999999'])('l’identifiant %s donne 404 sans appeler l’API', async (id) => {
    const fetch = vi.fn<Appel>();
    await expect(chargerFiche({ fetch, params: { id } } as never)).rejects.toSatisfy((e) => isHttpError(e, 404));
    await expect(
      chargerCategorie({
        fetch,
        params: { id },
        url: new URL(`http://site/categories/${id}`),
        isDataRequest: false,
      } as never),
    ).rejects.toSatisfy((e) => isHttpError(e, 404));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('une catégorie et une page hors bornes ne partent pas vers l’API', async () => {
    // 99999999999 dépasse un entier 32 bits (500 de l'API), 1e21 donnerait un
    // `skip` en notation exponentielle (422) : servis en 503, une adresse
    // malformée passait pour une panne.
    const fetch = vi.fn<Appel>(async () => Response.json([]));
    await chargerListe({
      fetch,
      url: new URL('http://site/laws?category=99999999999&page=1e21'),
      isDataRequest: false,
    } as never);
    const appelLois = new URL(String(fetch.mock.calls.find(([e]) => String(e).includes('/laws/'))?.[0]));
    expect(appelLois.searchParams.has('category_id')).toBe(false);
    expect(Number(appelLois.searchParams.get('skip'))).toBeLessThanOrEqual(2_147_483_647);
    expect(appelLois.searchParams.get('skip')).toMatch(/^\d+$/);
  });
});

describe('jamais de page amputée (elle serait mise en cache)', () => {
  it.each(MODES)('/laws : les catégories seules en panne donnent 503 (%s)', async (_mode, navigation) => {
    const espion = journal();
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/laws/') ? Response.json([]) : new Response('boum', { status: 502 }),
    );
    await expect(
      chargerListe({ fetch, url: new URL('http://site/laws'), isDataRequest: navigation } as never),
    ).rejects.toSatisfy((e) => isHttpError(e, 503));
    expect(String(espion.mock.calls[0][0])).toMatch('[503] /laws : API indisponible (HTTP 502)');
  });

  it.each(MODES)('/categories/<id> : la catégorie sans ses documents donne 503 (%s)', async (_mode, navigation) => {
    // Sans cache, la navigation gardait l'en-tête et signalait la liste seule.
    // Mise en cache, cette page sans documents serait servie à tous.
    journal();
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/laws/')
        ? new Response('boum', { status: 500 })
        : Response.json([categorie(3, 'Droit pénal')]),
    );
    await expect(
      chargerCategorie({
        fetch,
        params: { id: '3' },
        url: new URL('http://site/categories/3'),
        isDataRequest: navigation,
      } as never),
    ).rejects.toSatisfy((e) => isHttpError(e, 503));
  });
});

describe('ce que les pages envoient au navigateur', () => {
  const texte = 'Article premier. '.repeat(500);
  const loi = (id: number) => ({
    id,
    title: `Loi ${id}`,
    reference: `N° ${id}`,
    publication_date: '2016-07-12',
    article_count: 3,
    type: 'loi',
    content: texte,
    language: 'fr',
    category_id: 3,
    status: 'active',
    detected_language: 'fr',
    created_at: '2026-10-15T00:30:00',
  });

  it('/laws : seulement les champs affichés, et 20 lignes avec la suite signalée', async () => {
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/laws/')
        ? Response.json(Array.from({ length: 21 }, (_, i) => loi(i + 1)))
        : Response.json([]),
    );
    const donnees = (await chargerListe({
      fetch,
      url: new URL('http://site/laws'),
      isDataRequest: false,
    } as never)) as { laws: object[]; hasMore: boolean };
    expect(donnees.hasMore).toBe(true);
    expect(donnees.laws).toHaveLength(20);
    expect(Object.keys(donnees.laws[0]).sort()).toEqual(
      ['article_count', 'id', 'publication_date', 'reference', 'title', 'type'].sort(),
    );
  });

  it('/categories/<id> : un extrait au lieu du texte entier', async () => {
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/laws/') ? Response.json([loi(1)]) : Response.json([categorie(3, 'Droit pénal')]),
    );
    const donnees = (await chargerCategorie({
      fetch,
      params: { id: '3' },
      url: new URL('http://site/categories/3'),
      isDataRequest: false,
    } as never)) as { documents: { content: string }[] };
    expect(Object.keys(donnees.documents[0]).sort()).toEqual(['content', 'id', 'publication_date', 'title']);
    expect(donnees.documents[0].content.length).toBeLessThanOrEqual(301);
  });

  it('/categories/<id> : l’en-tête vient de la liste /categories, jamais de /categories/{id}', async () => {
    // Le détail fait charger par l'ORM toutes les lois de la catégorie et
    // leurs articles (1,9 à 7,4 s) pour les mêmes champs que la liste.
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/laws/')
        ? Response.json([])
        : Response.json([categorie(2), categorie(3, 'Droit pénal'), categorie(4)]),
    );
    const donnees = (await chargerCategorie({
      fetch,
      params: { id: '3' },
      url: new URL('http://site/categories/3?lang=fr'),
      isDataRequest: false,
    } as never)) as { categorie: object; lang: string };
    const appels = fetch.mock.calls.map(([entree]) => new URL(String(entree)));
    expect(appels.map((u) => u.pathname)).not.toContainEqual(expect.stringMatching(/\/categories\/\d/));
    const liste = appels.find((u) => u.pathname.endsWith('/categories'));
    // Complète : une catégorie absente de la liste répond 404.
    expect(liste?.searchParams.get('limit')).toBe('1000');
    expect(donnees.categorie).toEqual(categorie(3, 'Droit pénal'));
    expect(donnees.lang).toBe('fr');
  });

  it('/laws/<id> : le sommaire réduit au numéro et à la page du PDF', async () => {
    const article = (n: number) => ({ id: n, number: String(n), title: 'Titre', section: 'Livre I', page_number: n, kind: 'article' });
    const fetch = vi.fn<Appel>(async () => Response.json({ ...loi(12), articles: [article(1), article(2)] }));
    const donnees = (await chargerFiche({ fetch, params: { id: '12' }, isDataRequest: false } as never)) as {
      law: { content: string; articles: object[] };
      erreur: string;
    };
    expect(donnees.law.articles).toEqual([
      { number: '1', page_number: 1 },
      { number: '2', page_number: 2 },
    ]);
    expect(donnees.law.content).toBe(texte);
    expect(donnees.erreur).toBe('');
  });
});
