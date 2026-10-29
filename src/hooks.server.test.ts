// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Une VITE_API_URL ecrite a la main, avec majuscule, port par defaut et barre
// finale : $lib/config retire la barre, et handleFetch compare des origines
// analysees. Le module est importe apres le reglage de la variable, et l'URL
// des tests vient de API_URL : celle que les `load` demandent vraiment.
const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env }));

let handle: typeof import('./hooks.server').handle;
let handleFetch: typeof import('./hooks.server').handleFetch;
let handleError: typeof import('./hooks.server').handleError;
let API_URL: string;
let DELAI_API_MS: number;

beforeEach(async () => {
  vi.stubEnv('VITE_API_URL', 'https://JuriX.example:443/');
  vi.resetModules();
  ({ API_URL, DELAI_API_MS } = await import('$lib/config'));
  ({ handle, handleFetch, handleError } = await import('./hooks.server'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete env.API_INTERNE;
});

async function appeler(url: string, init?: RequestInit) {
  const fetch = vi.fn(async (_requete: RequestInfo | URL) => new Response('ok'));
  const request = new Request(url, init);
  await handleFetch({ request, fetch, event: {} as never });
  expect(fetch).toHaveBeenCalledOnce();
  return { recue: request, envoyee: fetch.mock.calls[0][0] as Request };
}

describe('handleFetch', () => {
  it("envoie les appels de l'API publique a l'adresse interne", async () => {
    env.API_INTERNE = 'http://api:8000/';
    expect(API_URL).toBe('https://JuriX.example:443/api/v1');
    const { envoyee } = await appeler(`${API_URL}/laws/12?skip=0&limit=21`);
    expect(envoyee.url).toBe('http://api:8000/api/v1/laws/12?skip=0&limit=21');
  });

  it('borne la requete reecrite par le delai de $lib/config', async () => {
    // Un delai deja ecoule : si la Request reecrite ne le porte pas, son signal
    // reste ouvert. Comparer les signaux ne prouverait rien, chaque Request
    // ayant le sien.
    env.API_INTERNE = 'http://api:8000';
    const minuterie = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort());
    const { envoyee } = await appeler(`${API_URL}/laws/12`);
    expect(minuterie).toHaveBeenCalledWith(DELAI_API_MS);
    expect(envoyee.signal.aborted).toBe(true);
  });

  it('garde ce delai sous les 10 s d’une fonction Vercel Hobby', () => {
    // 8 s ($lib/config) : au-dela de 10 s, Vercel coupe la fonction et sert sa
    // propre erreur (504) a la place du 503 du site et de son lien de reprise.
    expect(DELAI_API_MS).toBe(8000);
    expect(DELAI_API_MS).toBeLessThan(10_000);
  });

  it("transmet l'abandon de la requete d'origine", async () => {
    env.API_INTERNE = 'http://api:8000';
    const abandon = new AbortController();
    abandon.abort();
    const { envoyee } = await appeler(`${API_URL}/laws/12`, { signal: abandon.signal });
    expect(envoyee.signal.aborted).toBe(true);
  });

  it('garde la methode, les en-tetes et le corps', async () => {
    env.API_INTERNE = 'http://api:8000';
    const { envoyee } = await appeler(`${API_URL}/rag/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer x' },
      body: JSON.stringify({ question: 'q' }),
    });
    expect(envoyee.url).toBe('http://api:8000/api/v1/rag/ask');
    expect(envoyee.method).toBe('POST');
    expect(envoyee.headers.get('authorization')).toBe('Bearer x');
    expect(await envoyee.text()).toBe('{"question":"q"}');
  });

  it.each([
    ['une autre origine', 'https://ailleurs.example/api/v1/laws/1'],
    ['une page du site', 'https://jurix.example/robots.txt'],
    ['un chemin qui ressemble a /api/', 'https://jurix.example/apix/v1'],
  ])('laisse intacte %s', async (_cas, url) => {
    env.API_INTERNE = 'http://api:8000';
    const { recue, envoyee } = await appeler(url);
    expect(envoyee).toBe(recue);
  });

  it('ne change rien sans API_INTERNE (developpement, tests)', async () => {
    const { recue, envoyee } = await appeler(`${API_URL}/laws/1`);
    expect(envoyee).toBe(recue);
  });
});

describe('handleError', () => {
  function erreur(chemin: string, status: number) {
    const url = new URL(chemin, 'https://jurix.example');
    const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleError({
      error: new Error('boum'),
      event: { request: new Request(url), url } as never,
      status,
      message: 'Internal Error',
    });
    return espion.mock.calls.map((appel) => String(appel[0]));
  }

  it.each([
    ['/reset-password/JETON-SECRET', '[500] GET /reset-password/***'],
    ['/verify-email/JETON-SECRET', '[500] GET /verify-email/***'],
    ['/verify-email/JETON-SECRET/suite', '[500] GET /verify-email/***/suite'],
  ])('masque le jeton de %s', (chemin, attendu) => {
    expect(erreur(chemin, 500)).toEqual([attendu]);
  });

  it('journalise le chemin des autres erreurs', () => {
    expect(erreur('/laws/12', 500)).toEqual(['[500] GET /laws/12']);
  });

  it("n'ecrit rien pour une 404", () => {
    expect(erreur('/wp-login.php', 404)).toEqual([]);
  });
});

describe('handle : requêtes de données en erreur', () => {
  // Corps tels que SvelteKit les rend pour `__data.json` (render_data) : 200,
  // l'erreur d'un `load` rangée dans son nœud.
  function donnees(noeuds: unknown[]): Response {
    const corps = JSON.stringify({ type: 'data', nodes: noeuds });
    return new Response(corps, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'private, no-store',
        'content-length': String(new TextEncoder().encode(corps).byteLength),
      },
    });
  }

  async function traiter(reponse: Response, isDataRequest = true, chemin = '/laws/__data.json') {
    const url = new URL(chemin, 'https://jurix.example');
    return handle({
      event: { url, isDataRequest } as never,
      resolve: async () => reponse,
    });
  }

  it('fait passer un 503 du `load` dans le statut HTTP : Vercel ne le met pas en cache', async () => {
    const recue = await traiter(
      donnees([null, { type: 'error', error: { message: 'Service momentanément indisponible' }, status: 503 }]),
    );
    expect(recue.status).toBe(503);
    expect(recue.headers.get('content-type')).toBe('application/json');
    expect(recue.headers.get('cache-control')).toBe('private, no-store');
    // La longueur d'origine ne doit pas survivre au changement de corps.
    expect(recue.headers.get('content-length')).toBeNull();
    // Ce que le navigateur lit (SvelteKit, load_data) : le corps devient
    // l'erreur de la page, comme lorsqu'il la trouvait dans le nœud.
    expect(await recue.json()).toEqual({ message: 'Service momentanément indisponible' });
  });

  it('garde le statut de l’erreur : une fiche absente reste une 404', async () => {
    const recue = await traiter(
      donnees([null, { type: 'error', error: { message: 'Document introuvable' }, status: 404 }]),
    );
    expect(recue.status).toBe(404);
  });

  it('rend 500 pour une erreur inattendue, qui n’a pas de statut', async () => {
    const recue = await traiter(donnees([null, { type: 'error', error: { message: 'Internal Error' } }]));
    expect(recue.status).toBe(500);
    expect(await recue.json()).toEqual({ message: 'Internal Error' });
  });

  it('laisse intactes les données sans erreur', async () => {
    const reponse = donnees([null, { type: 'data', data: [{ erreur: 1 }, ''], uses: {} }]);
    const recue = await traiter(reponse);
    expect(recue).toBe(reponse);
    expect(recue.status).toBe(200);
  });

  it('ne lit pas une page HTML, ni une réponse en flux', async () => {
    const html = new Response('<p>"type":"error"</p>', { status: 200, headers: { 'content-type': 'text/html' } });
    expect(await traiter(html, false, '/laws')).toBe(html);
    const flux = new Response('{"type":"data","nodes":[{"type":"error"}]}', {
      status: 200,
      headers: { 'content-type': 'text/sveltekit-data' },
    });
    expect(await traiter(flux)).toBe(flux);
  });
});

describe('handle : noindex des pages privées', () => {
  const HTML = '<html><head><title>t</title></head><body></body></html>';

  /** La page telle que la rend SvelteKit, passée par `transformPageChunk` s'il y en a un. */
  async function servir(chemin: string) {
    const url = new URL(chemin, 'https://jurix.example');
    const reponse = await handle({
      event: { url, isDataRequest: false } as never,
      resolve: async (_event, options) => {
        const html = (await options?.transformPageChunk?.({ html: HTML, done: true })) ?? HTML;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      },
    });
    return { robots: reponse.headers.get('x-robots-tag'), html: await reponse.text() };
  }

  it('coquille de /admin : la balise et les polices ajoutées au HTML, plus l’en-tête', async () => {
    const { robots, html } = await servir('/admin/users');
    expect(robots).toBe('noindex, follow');
    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html).toMatch(/<link rel="preload" as="font"[^>]+inter-latin-wght-normal/);
  });

  it('/chat, rendu au serveur : l’en-tête seul, MetaSeo et SvelteKit posent le reste', async () => {
    // Traité en coquille, il recevait la balise robots et chaque police en double.
    const { robots, html } = await servir('/chat');
    expect(robots).toBe('noindex, follow');
    expect(html).toBe(HTML);
  });

  it('une page publique ne reçoit rien', async () => {
    for (const chemin of ['/', '/laws', '/chatbot']) {
      const { robots, html } = await servir(chemin);
      expect(robots, chemin).toBeNull();
      expect(html, chemin).toBe(HTML);
    }
  });
});

describe('handle : polices préchargées', () => {
  type Preload = (entree: { type: 'font' | 'css' | 'js' | 'asset'; path: string }) => boolean;

  /** Le filtre `preload` que `handle` remet à SvelteKit pour une page publique. */
  async function filtre(): Promise<Preload> {
    let preload: Preload | undefined;
    await handle({
      event: { url: new URL('https://jurix.example/'), isDataRequest: false } as never,
      resolve: async (_event, options) => {
        preload = options?.preload;
        return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
      },
    });
    if (!preload) throw new Error('handle ne passe plus de filtre `preload`');
    return preload;
  }

  it('précharge Inter, le JavaScript et la feuille de style, jamais Literata', async () => {
    const preload = await filtre();
    expect(preload({ type: 'font', path: '/_app/immutable/assets/inter-latin-wght-normal.DjQ2pHkf.woff2' })).toBe(true);
    expect(preload({ type: 'js', path: '/_app/immutable/entry/start.BxQ1.js' })).toBe(true);
    expect(preload({ type: 'css', path: '/_app/immutable/assets/0.Cq7.css' })).toBe(true);
    // Raisons dans src/app.css : 20 Kio disputés à Inter sur chaque page,
    // pour des titres qui ont leur repli ajusté.
    expect(preload({ type: 'font', path: '/_app/immutable/assets/literata-titre.B1x2Yz.woff2' })).toBe(false);
    expect(preload({ type: 'font', path: '/_app/immutable/assets/literata-texte.C3y4Wv.woff2' })).toBe(false);
    expect(preload({ type: 'font', path: '/_app/immutable/assets/geist-mono-latin-wght-normal.D5.woff2' })).toBe(false);
  });
});
