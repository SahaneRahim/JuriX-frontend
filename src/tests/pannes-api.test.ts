// @vitest-environment node
import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Les `load` des pages publiques face à une API en panne : 503 au rendu
 * serveur, avec sa cause au journal ; message et reprise dans le navigateur.
 *
 * Seul un test unitaire peut le vérifier : en e2e, `page.route` n'intercepte
 * que les appels du navigateur, alors que ceux des `load` serveur partent du
 * serveur Node, même pendant une navigation.
 */

// `browser` lu à chaque usage : la transformation de Vite fait de l'import un
// accès à la propriété du module, et le getter suit la variable.
let navigateur = false;
vi.mock('$app/environment', () => ({
  get browser() {
    return navigateur;
  },
  building: false,
  dev: false,
  version: 'test',
}));

import { load as chargerAccueil } from '../routes/(main)/+page';
import { load as chargerCategorie } from '../routes/categories/[id]/+page.server';
import { load as chargerListe } from '../routes/laws/+page.server';
import { load as chargerFiche } from '../routes/laws/[id]/+page';

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
  erreur: string;
  charger: (fetch: Appel, navigation: boolean) => Promise<unknown>;
}

// `navigation` : true pour une navigation dans le navigateur (`browser` pour un
// load universel, `isDataRequest` pour un load serveur), false au rendu serveur.
const PAGES: Page[] = [
  {
    nom: 'accueil',
    chemin: '/',
    erreur: 'categories.errorLoad',
    charger: async (fetch) => chargerAccueil({ fetch } as never),
  },
  {
    nom: 'fiche',
    chemin: '/laws/12',
    erreur: 'laws.errorLoad',
    charger: async (fetch) => chargerFiche({ fetch, params: { id: '12' } } as never),
  },
  {
    nom: 'liste',
    chemin: '/laws',
    erreur: 'laws.errorLoad',
    charger: async (fetch, navigation) =>
      chargerListe({ fetch, url: new URL('http://site/laws'), isDataRequest: navigation } as never),
  },
  {
    nom: 'catégorie',
    chemin: '/categories/3',
    erreur: 'categories.errorLoad',
    charger: async (fetch, navigation) =>
      chargerCategorie({
        fetch,
        params: { id: '3' },
        url: new URL('http://site/categories/3'),
        isDataRequest: navigation,
      } as never),
  },
];

function journal() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
  navigateur = false;
});

describe.each(PAGES)('$nom', (page) => {
  it.each(PANNES)('%s : 503 au rendu serveur, cause au journal', async (_panne, appel) => {
    navigateur = false;
    const espion = journal();
    await expect(page.charger(vi.fn(appel), false)).rejects.toSatisfy((e) => isHttpError(e, 503));
    expect(espion).toHaveBeenCalledOnce();
    expect(String(espion.mock.calls[0][0])).toMatch(`[503] ${page.chemin} : API indisponible (`);
  });

  it.each(PANNES)('%s : message et reprise dans le navigateur', async (_panne, appel) => {
    navigateur = true;
    const espion = journal();
    expect(await page.charger(vi.fn(appel), true)).toMatchObject({ erreur: page.erreur });
    expect(espion).not.toHaveBeenCalled();
  });

  it('borne chaque appel à l’API par un délai', async () => {
    navigateur = true;
    const fetch = vi.fn<Appel>(async () => new Response('boum', { status: 500 }));
    await page.charger(fetch, true);
    expect(fetch).toHaveBeenCalled();
    for (const [, init] of fetch.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('ce qui n’est pas une panne', () => {
  it.each([false, true])('une fiche absente reste une 404 (navigateur : %s)', async (dansLeNavigateur) => {
    navigateur = dansLeNavigateur;
    const espion = journal();
    const fetch = vi.fn<Appel>(async () => new Response('{}', { status: 404 }));
    await expect(chargerFiche({ fetch, params: { id: '12' } } as never)).rejects.toSatisfy((e) =>
      isHttpError(e, 404),
    );
    expect(espion).not.toHaveBeenCalled();
  });

  it('une catégorie absente reste une 404', async () => {
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/categories/') ? new Response('{}', { status: 404 }) : Response.json([]),
    );
    await expect(
      chargerCategorie({
        fetch,
        params: { id: '3' },
        url: new URL('http://site/categories/3'),
        isDataRequest: false,
      } as never),
    ).rejects.toSatisfy((e) => isHttpError(e, 404));
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

describe('ce que les listes envoient au navigateur', () => {
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
      String(entree).includes('/categories/')
        ? Response.json({ id: 3, name: 'Droit pénal' })
        : Response.json([loi(1)]),
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

  it('/categories/<id> dans le navigateur : la catégorie reste si seule sa liste manque', async () => {
    const fetch = vi.fn<Appel>(async (entree) =>
      String(entree).includes('/categories/')
        ? Response.json({ id: 3, name: 'Droit pénal' })
        : new Response('boum', { status: 500 }),
    );
    expect(
      await chargerCategorie({
        fetch,
        params: { id: '3' },
        url: new URL('http://site/categories/3'),
        isDataRequest: true,
      } as never),
    ).toMatchObject({ categorie: { name: 'Droit pénal' }, documents: [], erreur: 'categories.errorLoad' });
  });
});
