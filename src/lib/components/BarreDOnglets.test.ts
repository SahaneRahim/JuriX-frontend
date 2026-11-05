import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { Writable } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * La barre d'onglets du bas (refonte A, E3d, décision H6) : où elle paraît,
 * et quel onglet est courant.
 */

vi.mock('$app/environment', () => ({ browser: true, building: false, dev: false, version: 'test' }));
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('http://site/'), route: { id: null }, params: {}, data: {}, error: null }) };
});

const { page } = await import('$app/stores');
const { default: BarreDOnglets } = await import('./BarreDOnglets.svelte');

async function surLaPage(chemin: string) {
  (page as unknown as Writable<unknown>).set({
    url: new URL(chemin, 'http://site'),
    route: { id: null },
    params: {},
    data: {},
    error: null,
  });
  const rendu = render(BarreDOnglets);
  await tick();
  return rendu;
}

const barre = () => document.querySelector<HTMLElement>('[data-testid="barre-onglets"]');

afterEach(() => cleanup());

describe('BarreDOnglets', () => {
  it('trois onglets nommés, l’accueil courant sur /', async () => {
    const { getByRole } = await surLaPage('/');
    const navigation = getByRole('navigation', { name: 'Navigation' });
    const onglets = [...navigation.querySelectorAll('a')];
    expect(onglets.map((a) => [a.getAttribute('href'), a.textContent?.trim()])).toEqual([
      ['/', 'Accueil'],
      ['/chat', 'Assistant IA'],
      ['/laws', 'Parcourir'],
    ]);
    expect(onglets.map((a) => a.getAttribute('aria-current'))).toEqual(['page', null, null]);
  });

  it('« Parcourir » courant sur un texte et sur un domaine', async () => {
    for (const chemin of ['/laws', '/laws/42', '/categories/13']) {
      await surLaPage(chemin);
      expect(barre()?.querySelector('[aria-current="page"]')?.getAttribute('href'), chemin).toBe('/laws');
      cleanup();
    }
  });

  it('aucun onglet courant ailleurs : pas de trait', async () => {
    await surLaPage('/about');
    expect(barre()?.querySelector('[aria-current]')).toBeNull();
    expect(barre()?.querySelector('span[aria-hidden="true"]')?.classList).toContain('opacity-0');
  });

  it('absente sur /chat, dans l’administration et sur les pages de compte', async () => {
    for (const chemin of ['/chat', '/admin', '/admin/users', '/login', '/signup', '/forgot-password', '/reset-password/jeton', '/verify-email']) {
      await surLaPage(chemin);
      expect(barre(), chemin).toBeNull();
      cleanup();
    }
  });

  it('présente sur la page d’erreur d’une adresse inconnue, au téléphone seulement (sous md, hors écran court)', async () => {
    await surLaPage('/page-qui-n-existe-pas');
    expect(barre()).not.toBeNull();
    expect(barre()?.className).toMatch(/\bmd:hidden\b/);
    expect(barre()?.className).toMatch(/\bcourt:hidden\b/);
    expect(barre()?.className).toMatch(/\bprint:hidden\b/);
    expect(barre()?.className).toMatch(/\bfixed\b/);
  });
});
