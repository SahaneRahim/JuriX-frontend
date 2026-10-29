import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LigneAffichee } from '$lib/components/listes/lots';
import Page from './+page.svelte';

/**
 * /laws garde sa liste dans l'historique : SvelteKit appelle le `snapshot`
 * de la PAGE (pas celui d'un composant enfant) au départ d'une navigation, et
 * le rend au retour arrière. Sans lui, revenir d'un texte ne montrait que le
 * lot de l'adresse, et le défilement s'arrêtait sur le pied de page.
 */

vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return { page: readable({ url: new URL('http://localhost/laws?page=3'), state: {}, params: {} }) };
});
vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn(), goto: vi.fn() }));
vi.mock('$lib/components/SiteHeader.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/SiteFooter.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/MetaSeo.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/ChatFab.svelte', () => ({ default: () => {} }));

afterEach(() => cleanup());

function lot(n: number): LigneAffichee[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: 20 * (n - 1) + i + 1,
    title: `Décret ${20 * (n - 1) + i + 1}`,
    type: 'décret',
    publication_date: '2020-01-02',
    article_count: 2,
  }));
}

function donnees(n: number) {
  return {
    lignes: lot(n),
    page: n,
    parPage: 20,
    total: 1277,
    suivante: true,
    tri: 'date_desc' as const,
    categories: [],
    lang: 'all' as const,
    category: 'all',
    erreur: '',
  };
}

describe('/laws : le snapshot de la page', () => {
  it('garde les lots affichés et les rend au retour, à la ligne quittée', async () => {
    const defilement = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const premiere = render(Page, { props: { data: donnees(1) } });
    await premiere.rerender({ data: donnees(2) });
    await premiere.rerender({ data: donnees(3) });
    const garde = JSON.parse(JSON.stringify(premiere.component.snapshot.capture()));
    expect(garde?.lignes).toHaveLength(60);
    premiere.unmount();

    const retour = render(Page, { props: { data: donnees(3) } });
    expect(retour.container.querySelectorAll('ul[role="list"] > li')).toHaveLength(20);
    retour.component.snapshot.restore(garde);
    await tick();
    await tick();
    expect(retour.container.querySelectorAll('ul[role="list"] > li')).toHaveLength(60);
    expect(defilement).toHaveBeenCalled();
    defilement.mockRestore();
  });
});
