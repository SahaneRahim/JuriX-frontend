// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as accueil from '../routes/(main)/+page.server';
import * as categorie from '../routes/categories/[id]/+page.server';
import * as liste from '../routes/laws/+page.server';
import * as fiche from '../routes/laws/[id]/+page.server';
import * as chat from '../routes/(main)/chat/+page';

/**
 * Pages publiques mises en cache par Vercel (ISR, `config.isr` de
 * adapter-vercel).
 *
 * Une page en cache est servie à TOUS les visiteurs dont l'adresse a la même
 * clé : le chemin, plus les seuls paramètres de `allowQuery` (Vercel ne
 * transmet même pas les autres à la fonction). Deux erreurs rendraient une page
 * fausse sans que rien ne le montre :
 * - lire un paramètre hors de la clé : la version générée pour `?lang=en`
 *   serait servie pour `?lang=fr` ;
 * - lire quoi que ce soit du visiteur (cookie, en-tête, adresse, `locals`) :
 *   sa page serait servie aux autres. La session, la langue, le thème et le
 *   profil vivent dans le localStorage, lus dans le navigateur seulement.
 */

type Appel = (entree: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Une API qui répond à tout, pour que chaque `load` aille jusqu'au bout. */
const api: Appel = async (entree) => {
  const { pathname } = new URL(String(entree));
  if (pathname.endsWith('/categories')) return Response.json([{ id: 3, name: 'Droit pénal', law_count: 1 }]);
  if (/\/laws\/\d+$/.test(pathname)) return Response.json({ id: 12, title: 'Loi', content: 'Texte', articles: [] });
  return Response.json([]);
};

interface Route {
  chemin: string;
  module: { config: unknown; load: (evenement: never) => Promise<unknown> };
  attendu: { expiration: number; allowQuery?: string[] };
  /** Adresse d'essai : les paramètres de la clé, et d'autres qui n'en sont pas. */
  adresse: string;
  params: Record<string, string>;
  /** Les fichiers dont le rendu dépend de l'URL : la page et ses gabarits. */
  composants: string[];
  /**
   * Paramètres que les composants lisent, laissés HORS de la clé à dessein.
   * Vercel ne les transmet pas à la fonction : le rendu serveur, donc la
   * version en cache, est toujours celui SANS eux, le même pour toutes les
   * variantes ; le navigateur les applique ensuite (`$page.url` y est
   * l'adresse réelle). Le `load` ne doit pas les lire : ses données en
   * dépendraient, et celles d'une variante seraient servies aux autres.
   */
  appliquesDansLeNavigateur?: string[];
  source: string;
}

const ROUTES: Route[] = [
  {
    chemin: '/',
    module: accueil as never,
    attendu: { expiration: 600 },
    adresse: 'http://site/?utm_source=x&lang=en&page=2',
    params: {},
    composants: ['/src/routes/(main)/+page.svelte', '/src/routes/(main)/+layout.svelte', '/src/routes/+layout.svelte'],
    source: '/src/routes/(main)/+page.server.ts',
  },
  {
    chemin: '/laws',
    module: liste as never,
    attendu: { expiration: 600, allowQuery: ['page', 'category', 'lang'] },
    adresse: 'http://site/laws?page=2&category=3&lang=fr&utm_source=x&q=bail',
    params: {},
    composants: ['/src/routes/laws/+page.svelte', '/src/routes/+layout.svelte'],
    source: '/src/routes/laws/+page.server.ts',
  },
  {
    chemin: '/laws/[id]',
    module: fiche as never,
    // `article` hors de la clé : les mêmes données pour tous les articles d'un
    // texte, et une génération (1,3 Mo lus à l'API pour le code pénal) par
    // couple (texte, article) quand il en faisait partie.
    attendu: { expiration: 3600 },
    adresse: 'http://site/laws/12?article=5&utm_source=x&lang=en',
    params: { id: '12' },
    composants: ['/src/routes/laws/[id]/+page.svelte', '/src/routes/+layout.svelte'],
    appliquesDansLeNavigateur: ['article'],
    source: '/src/routes/laws/[id]/+page.server.ts',
  },
  {
    chemin: '/categories/[id]',
    module: categorie as never,
    attendu: { expiration: 600, allowQuery: ['lang'] },
    adresse: 'http://site/categories/3?lang=en&utm_source=x&page=2',
    params: { id: '3' },
    composants: ['/src/routes/categories/[id]/+page.svelte', '/src/routes/+layout.svelte'],
    source: '/src/routes/categories/[id]/+page.server.ts',
  },
];

const SOURCES = import.meta.glob(['/src/routes/**/*.{svelte,ts}', '/src/hooks.server.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Une URL qui note les paramètres lus. `get`, `getAll` et `has` notent leur
 * nom ; toute autre lecture de la requête (`search`, `href`, parcours de
 * `searchParams`) note « * » : la page dépendrait alors de TOUS les paramètres.
 */
function urlEspionnee(adresse: string): { url: URL; lus: Set<string> } {
  const vraie = new URL(adresse);
  const lus = new Set<string>();
  const parametres = new Proxy(vraie.searchParams, {
    get(cible, propriete) {
      if (propriete === 'get' || propriete === 'getAll' || propriete === 'has') {
        return (nom: string) => {
          lus.add(nom);
          return cible[propriete](nom);
        };
      }
      lus.add('*');
      const valeur = Reflect.get(cible, propriete, cible);
      return typeof valeur === 'function' ? valeur.bind(cible) : valeur;
    },
  });
  const url = new Proxy(vraie, {
    get(cible, propriete) {
      if (propriete === 'searchParams') return parametres;
      if (propriete === 'search' || propriete === 'href') lus.add('*');
      const valeur = Reflect.get(cible, propriete, cible);
      return typeof valeur === 'function' ? valeur.bind(cible) : valeur;
    },
  });
  return { url, lus };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(ROUTES)('$chemin', (route) => {
  const cle = route.attendu.allowQuery ?? [];

  it('est mise en cache, avec sa clé', () => {
    expect(route.module.config).toEqual({ isr: route.attendu });
  });

  it('son `load` ne lit que les paramètres de la clé', async () => {
    const { url, lus } = urlEspionnee(route.adresse);
    await route.module.load({ fetch: vi.fn(api), url, params: route.params } as never);
    expect([...lus].filter((nom) => !cle.includes(nom))).toEqual([]);
  });

  it('ses composants ne lisent que les paramètres de la clé', () => {
    // Lecture du texte : `searchParams.get("x")` rendu au serveur. Les
    // gestionnaires de clic qui recopient toute la requête vers une nouvelle
    // adresse (`new URLSearchParams($page.url.searchParams)`) ne changent pas
    // le rendu ; ils ne sont pas visés.
    const permis = [...cle, ...(route.appliquesDansLeNavigateur ?? [])];
    for (const fichier of route.composants) {
      const source = SOURCES[fichier];
      expect(source, fichier).toBeDefined();
      const lus = [...source.matchAll(/searchParams\s*\.\s*(?:get|getAll|has)\(\s*(["'`])([^"'`]+)\1/g)].map(
        (m) => m[2],
      );
      expect(
        lus.filter((nom) => !permis.includes(nom)),
        fichier,
      ).toEqual([]);
    }
  });

  it('son `load` ne reçoit rien du visiteur', () => {
    // Seuls `fetch` (vers l'API publique, sans cookie ni en-tête du
    // visiteur), `params` et `url` : ni `cookies`, ni `request`, ni `locals`,
    // ni `getClientAddress`, ni l'événement entier.
    const signature = /export const load: PageServerLoad = async \(\{([^}]*)\}\)/.exec(SOURCES[route.source]);
    expect(signature, `${route.source} : signature du load`).not.toBeNull();
    const recus = (signature?.[1] ?? '').split(',').map((nom) => nom.trim()).filter(Boolean);
    expect(recus.filter((nom) => !['fetch', 'params', 'url'].includes(nom))).toEqual([]);
  });
});

describe('/chat : la coquille en cache', () => {
  // Sans `load` : la page ne fait que se rendre, en version invitée, et ne lit
  // le visiteur (jeton, profil, `?q=`) que dans le navigateur.
  it('est mise en cache sans expiration ni clé', () => {
    expect(chat.config).toEqual({ isr: { expiration: false } });
    expect(chat.ssr).toBe(true);
  });

  it('n’a aucun `load`, ni universel ni serveur', () => {
    expect('load' in chat).toBe(false);
    expect(SOURCES['/src/routes/(main)/chat/+page.server.ts']).toBeUndefined();
  });

  it('ne lit que `?q=`, appliqué dans le navigateur', () => {
    // Hors de la clé, `?q=` n'atteint pas la fonction : la page le lit au
    // montage (question pré-remplie). Tout autre paramètre lu devrait, lui,
    // être examiné comme ceux des pages ci-dessus.
    const source = SOURCES['/src/routes/(main)/chat/+page.svelte'];
    const lus = [...source.matchAll(/searchParams\s*\.\s*(?:get|getAll|has)\(\s*(["'`])([^"'`]+)\1/g)].map(
      (m) => m[2],
    );
    expect(lus).toEqual(['q']);
    expect(SOURCES['/src/routes/(main)/+layout.svelte']).not.toMatch(/searchParams\s*\.\s*(?:get|getAll|has)\(/);
  });
});

describe('rien du visiteur au-dessus des pages en cache', () => {
  it('aucun gabarit serveur ne lit le visiteur', () => {
    // Aucun +layout.server.ts aujourd'hui : un gabarit serveur qui lirait un
    // cookie changerait TOUTES les pages qu'il couvre.
    for (const [fichier, source] of Object.entries(SOURCES)) {
      if (!/\/\+layout\.server\.ts$/.test(fichier)) continue;
      expect(source, fichier).not.toMatch(/\b(cookies|getClientAddress|locals|request)\b/);
    }
  });

  it('le hook du serveur ne lit ni cookie ni en-tête du visiteur', () => {
    // Les en-têtes lus par `handle` sont ceux de la RÉPONSE (`reponse.headers`).
    const hook = SOURCES['/src/hooks.server.ts'];
    expect(hook).toBeDefined();
    expect(hook).not.toMatch(/\bcookies\b|getClientAddress|request\.headers\.get\(|event\.request\.headers/);
  });
});
