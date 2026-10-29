// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { load } from './+page.server';
import type { DonneesDeRecherche } from './resultats';

/**
 * Le `load` de /search face aux deux API : ce qu'il leur demande, et combien
 * de fois. Une recherche lancée depuis la page d'un domaine (`perimetre=17`)
 * doit chercher DANS le domaine (`filters`, en SQL), et non garder les textes
 * du domaine parmi ceux trouvés dans tout le corpus (`refine`).
 */

interface Appel {
  methode: string;
  url: URL;
  corps: Record<string, unknown> | null;
}

/** Une réponse de la nouvelle API (effectifs présents), réduite à l'essentiel. */
function reponseAffinee(total: number, candidats: number, categories: { id: number; name: string; count: number }[]) {
  return {
    query: 'q',
    mode: 'hybrid',
    total,
    candidates: candidats,
    sort: 'pertinence',
    facets: { types: total ? [{ value: 'décret', count: total }] : [], categories, years: [] },
    results: [],
  };
}

/** L'ancienne API : ni `facets`, ni `candidates`, ni `sort`. */
const REPONSE_CLASSIQUE = { query: 'q', mode: 'hybrid', total: 3, results: [] };

const CATEGORIES = [
  { id: 17, name: 'Santé Publique et Sécurité Sanitaire' },
  { id: 4, name: 'Droit du Travail et Sécurité Sociale' },
];

/**
 * Une API simulée : chaque recherche reçoit la réponse suivante de
 * `recherches` ; `GET /categories` la liste des domaines ; `GET /corpus` un
 * 404, comme l'ancienne API.
 */
function api(recherches: unknown[]) {
  const appels: Appel[] = [];
  const fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entree));
    const methode = init?.method ?? 'GET';
    appels.push({ methode, url, corps: init?.body ? JSON.parse(String(init.body)) : null });
    if (methode === 'POST' && url.pathname.endsWith('/search/')) {
      return new Response(JSON.stringify(recherches.shift()), { status: 200 });
    }
    if (url.pathname.endsWith('/categories')) return new Response(JSON.stringify(CATEGORIES), { status: 200 });
    return new Response('{"detail":"Not Found"}', { status: 404 });
  };
  return { fetch, appels, recherches: () => appels.filter((a) => a.methode === 'POST') };
}

async function charger(adresse: string, fetch: typeof globalThis.fetch): Promise<DonneesDeRecherche> {
  return (await load({ fetch, url: new URL(adresse, 'http://site') } as never)) as DonneesDeRecherche;
}

describe('/search : le load', () => {
  it('page d’un domaine, nouvelle API : le domaine délimite l’ensemble (filters), une seule demande', async () => {
    const simulee = api([reponseAffinee(10, 10, [{ id: 17, name: CATEGORIES[0].name, count: 10 }])]);
    const donnees = await charger('/search?q=nomination&perimetre=17', simulee.fetch);

    const [recherche, ...autres] = simulee.recherches();
    expect(autres).toHaveLength(0);
    expect(recherche.corps?.filters).toEqual({ category_ids: [17], status: 'published' });
    expect(recherche.corps?.refine).toBeUndefined();

    expect(donnees.total).toBe(10);
    // La colonne le montre coché, parmi les quatorze domaines.
    expect(donnees.domaines.find((d) => d.id === 17)).toMatchObject({ n: 10, coche: true });
  });

  it('une case cochée dans la colonne reste un affinage (refine), sans filters de domaine', async () => {
    const simulee = api([reponseAffinee(1, 25, [{ id: 4, name: CATEGORIES[1].name, count: 1 }])]);
    await charger('/search?q=indemnit%C3%A9&categorie=4', simulee.fetch);

    const [recherche] = simulee.recherches();
    expect(recherche.corps?.filters).toEqual({ status: 'published' });
    expect(recherche.corps?.refine).toEqual({ category_ids: [4] });
  });

  it('ancienne API, page d’un domaine : la première réponse est déjà filtrée, pas de seconde demande', async () => {
    const simulee = api([REPONSE_CLASSIQUE]);
    const donnees = await charger('/search?q=nomination&perimetre=17', simulee.fetch);

    expect(simulee.recherches()).toHaveLength(1);
    expect(simulee.recherches()[0].corps?.filters).toEqual({ category_ids: [17], status: 'published' });
    expect(donnees).toMatchObject({ etat: 'resultats', affinee: false, total: 3 });
    // Le rappel des filtres nomme le domaine.
    expect(donnees.nomsDesDomaines).toEqual({ 17: CATEGORIES[0].name });
  });

  it('ancienne API, filtres de refine : une seconde demande les passe en filters, périmètre compris', async () => {
    const simulee = api([REPONSE_CLASSIQUE, REPONSE_CLASSIQUE]);
    await charger('/search?q=nomination&perimetre=17&nature=loi', simulee.fetch);

    const demandes = simulee.recherches();
    expect(demandes).toHaveLength(2);
    expect(demandes[1].corps?.filters).toEqual({ types: ['loi'], category_ids: [17], status: 'published' });
  });

  it('rien dans le domaine : pas de chiffres du corpus, qui diraient « rien nulle part »', async () => {
    const simulee = api([reponseAffinee(0, 0, [])]);
    const donnees = await charger('/search?q=introuvable&perimetre=17', simulee.fetch);

    expect(simulee.appels.some((a) => a.url.pathname.endsWith('/corpus'))).toBe(false);
    expect(donnees).toMatchObject({ total: 0, candidats: 0, corpus: null });
    // Sans colonne (rien trouvé), le rappel des filtres doit pouvoir nommer le domaine.
    expect(donnees.nomsDesDomaines).toEqual({ 17: CATEGORIES[0].name });
  });

  it('rien du tout, sans périmètre : les chiffres du corpus sont demandés', async () => {
    const simulee = api([reponseAffinee(0, 0, [])]);
    await charger('/search?q=introuvable', simulee.fetch);
    expect(simulee.appels.some((a) => a.url.pathname.endsWith('/corpus'))).toBe(true);
  });
});
