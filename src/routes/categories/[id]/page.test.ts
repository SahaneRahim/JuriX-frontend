import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LigneAffichee } from '$lib/components/listes/lots';
import { corpsDeRecherche } from '$lib/api-publique';
import { demandeAffinee, lireParametres } from '../../search/parametres';
import Page from './+page.svelte';

/**
 * La page d'un domaine : sa recherche cherche DANS le domaine (P8), et sa
 * liste par lots revient entière au retour arrière (P11).
 */

vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return { page: readable({ url: new URL('http://localhost/categories/17'), state: {}, params: { id: '17' } }) };
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
    categorie: {
      id: 17,
      name: 'Santé Publique et Sécurité Sanitaire',
      description: null,
      icon: null,
      created_at: '2026-04-17T00:00:00Z',
      law_count: 16,
    },
    lignes: lot(n),
    page: n,
    parPage: 20,
    total: 60,
    suivante: n < 3,
    tri: 'date_desc' as const,
    lang: 'all' as const,
    erreur: '',
  };
}

describe('/categories/<id> : chercher dans le domaine', () => {
  it('le formulaire envoie le domaine en périmètre, que /search passe en filters (SQL)', () => {
    const { container } = render(Page, { props: { data: donnees(1) } });
    const formulaire = container.querySelector('form[role="search"]') as HTMLFormElement;
    const champ = formulaire.querySelector('input[name="q"]') as HTMLInputElement;
    champ.value = 'nomination';

    const envoyes = new URLSearchParams(new FormData(formulaire) as unknown as Record<string, string>);
    // `?q=nomination&perimetre=17` : la requête d'abord, l'ordre des liens de /search.
    expect([...envoyes.keys()]).toEqual(['q', 'perimetre']);
    expect(envoyes.getAll('categorie')).toEqual([]);

    const parametres = lireParametres(envoyes);
    expect(parametres).toMatchObject({ q: 'nomination', perimetre: [17], categories: [] });
    // Et la recherche porte sur les textes du domaine, pas sur les vingt
    // premiers de tout le corpus réduits au domaine (`refine`).
    const corps = corpsDeRecherche(demandeAffinee(parametres, 2026));
    expect(corps.filters).toEqual({ category_ids: [17], status: 'published' });
    expect(corps.refine).toBeUndefined();
  });
});

describe('/categories/<id> : le snapshot de la page', () => {
  it('garde les lots affichés et les rend au retour arrière', async () => {
    const defilement = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const premiere = render(Page, { props: { data: donnees(1) } });
    await premiere.rerender({ data: donnees(2) });
    const garde = JSON.parse(JSON.stringify(premiere.component.snapshot.capture()));
    premiere.unmount();

    const retour = render(Page, { props: { data: donnees(2) } });
    expect(retour.container.querySelectorAll('ul[role="list"] > li')).toHaveLength(20);
    retour.component.snapshot.restore(garde);
    await tick();
    await tick();
    expect(retour.container.querySelectorAll('ul[role="list"] > li')).toHaveLength(40);
    defilement.mockRestore();
  });
});
