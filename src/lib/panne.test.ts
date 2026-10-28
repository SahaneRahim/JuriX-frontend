// @vitest-environment node
import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { absenceConfirmee, decrirePanne, leverIndisponible, lireJson } from './panne';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('decrirePanne', () => {
  it('donne le statut HTTP', () => {
    expect(decrirePanne(new Response('', { status: 502 }))).toBe('HTTP 502');
  });

  it('remonte le code réseau rangé dans `cause` par Node', () => {
    const erreur = new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    expect(decrirePanne(erreur)).toBe('TypeError: fetch failed (ECONNREFUSED)');
  });

  it('remonte le message de `cause` quand il n’y a pas de code', () => {
    const erreur = new TypeError('fetch failed', { cause: new Error('bad port') });
    expect(decrirePanne(erreur)).toBe('TypeError: fetch failed (bad port)');
  });

  it('nomme un délai dépassé', () => {
    expect(decrirePanne(new DOMException('signal timed out', 'TimeoutError'))).toBe(
      'TimeoutError: signal timed out',
    );
  });
});

describe('lireJson', () => {
  const tenu = (r: Response): PromiseSettledResult<Response> => ({ status: 'fulfilled', value: r });

  it('lit le JSON d’une réponse correcte', async () => {
    expect(await lireJson(tenu(Response.json({ a: 1 })))).toEqual({ ok: true, valeur: { a: 1 } });
  });

  it('rend la cause d’un rejet, d’un statut d’erreur ou d’un corps illisible', async () => {
    const rejet = new TypeError('fetch failed');
    expect(await lireJson({ status: 'rejected', reason: rejet })).toEqual({ ok: false, cause: rejet });

    const erreur = new Response('', { status: 500 });
    expect(await lireJson(tenu(erreur))).toEqual({ ok: false, cause: erreur });

    const illisible = await lireJson(tenu(new Response('<html>proxy</html>', { status: 200 })));
    expect(illisible.ok).toBe(false);
  });
});

describe('leverIndisponible', () => {
  it('écrit la cause, puis lève un 503', () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {});
    let levee: unknown;
    try {
      leverIndisponible('/laws/12', new Response('', { status: 500 }));
    } catch (e) {
      levee = e;
    }
    expect(isHttpError(levee, 503)).toBe(true);
    expect(journal).toHaveBeenCalledWith('[503] /laws/12 : API indisponible (HTTP 500)');
  });
});

describe('absenceConfirmee', () => {
  it('reconnaît le 404 de l’API : du JSON avec son `detail`', async () => {
    const api = Response.json({ detail: 'Law with ID 12 not found' }, { status: 404 });
    expect(await absenceConfirmee(api)).toBe(true);
  });

  it('refuse tout autre 404, que l’ISR garderait', async () => {
    const railway = Response.json(
      { status: 'error', code: 404, message: 'Application not found' },
      { status: 404, headers: { 'x-railway-fallback': 'true' } },
    );
    expect(await absenceConfirmee(railway)).toBe(false);
    const html = new Response('<h1>404</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
    expect(await absenceConfirmee(html)).toBe(false);
    const tronque = new Response('{"detail":', { status: 404, headers: { 'content-type': 'application/json' } });
    expect(await absenceConfirmee(tronque)).toBe(false);
    expect(await absenceConfirmee(Response.json(null, { status: 404 }))).toBe(false);
    expect(await absenceConfirmee(Response.json({ detail: 404 }, { status: 404 }))).toBe(false);
    expect(await absenceConfirmee(Response.json({ detail: 'Not Found' }, { status: 404 }))).toBe(false);
  });

  it('ne lit pas le corps d’une réponse qui n’est pas un 404', async () => {
    const correcte = Response.json({ detail: 'x' });
    expect(await absenceConfirmee(correcte)).toBe(false);
    expect(correcte.bodyUsed).toBe(false);
    expect(await absenceConfirmee(Response.json({ detail: 'Erreur' }, { status: 500 }))).toBe(false);
  });
});
