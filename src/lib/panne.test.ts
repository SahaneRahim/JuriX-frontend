// @vitest-environment node
import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decrirePanne, leverIndisponible, lireJson } from './panne';

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
