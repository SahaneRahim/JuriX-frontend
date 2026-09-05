/**
 * Tests de `apiFetch`.
 *
 * Ce module porte l'authentification de toute l'application — en-tête
 * `Authorization` et déconnexion sur 401 — et n'avait aucun test. C'est
 * précisément la garde sur laquelle s'appuie le layout d'administration
 * (`src/routes/admin/+layout.svelte`) : celui-ci ne redirige que parce que
 * `apiFetch` appelle `authStore.logout()`. Six appels admin contournaient
 * `apiFetch` et laissaient donc l'écran affiché et vide sur session expirée.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...a: unknown[]) => goto(...a) }));
vi.mock('$app/environment', () => ({ browser: true }));

import { API_URL, apiFetch } from './api';
import { authStore } from './stores/auth';

describe('apiFetch', () => {
  beforeEach(() => {
    goto.mockClear();
    localStorage.clear();
    authStore.logout();
  });

  it('prefixe le chemin par API_URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/laws/?limit=1');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/laws/?limit=1`);
  });

  it("joint le jeton quand une session existe", async () => {
    authStore.login({ id: 1, email: 'a@b.cm', role: 'admin' }, 'jeton-test');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/admin/users');

    const entetes = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(entetes.Authorization).toBe('Bearer jeton-test');
  });

  it("n'invente pas d'en-tête sans session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/categories');

    const entetes = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(entetes.Authorization).toBeUndefined();
  });

  it('déconnecte et renvoie vers /login sur 401', async () => {
    authStore.login({ id: 1, email: 'a@b.cm', role: 'admin' }, 'jeton-expire');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    await apiFetch('/admin/users');

    // C'est ce logout, et lui seul, qui déclenche la garde réactive du layout
    // d'administration. Sans lui, l'écran reste affiché avec des données vides.
    let etat: { isAuthenticated: boolean } | undefined;
    authStore.subscribe((s) => (etat = s))();
    expect(etat?.isAuthenticated).toBe(false);
    expect(goto).toHaveBeenCalledWith('/login', { replaceState: true });
  });

  it("laisse passer les autres codes d'erreur sans déconnecter", async () => {
    authStore.login({ id: 1, email: 'a@b.cm', role: 'admin' }, 'jeton-valide');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    const reponse = await apiFetch('/analytics/overview');

    // Un 500 n'est pas un problème de session : déconnecter l'utilisateur
    // parce que le serveur a un défaut serait une régression.
    expect(reponse.status).toBe(500);
    expect(goto).not.toHaveBeenCalled();
    let etat: { isAuthenticated: boolean } | undefined;
    authStore.subscribe((s) => (etat = s))();
    expect(etat?.isAuthenticated).toBe(true);
  });

  it('rend la Response telle quelle, sans lever', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"a":1}', { status: 200 })));

    const reponse = await apiFetch('/categories');

    // Le contrat compte : `apiFetch` ne lève PAS sur 4xx. Chaque appelant doit
    // contrôler `response.ok` — c'est l'oubli de ce contrôle qui aurait fait
    // passer un 409 « email déjà utilisé » pour une création réussie.
    expect(reponse.ok).toBe(true);
    await expect(reponse.json()).resolves.toEqual({ a: 1 });
  });
});
