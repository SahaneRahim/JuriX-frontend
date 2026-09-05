import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SearchBar from './SearchBar.svelte';

/**
 * SearchBar est le SEUL composant qui appelle /search/suggest. Il n'etait
 * importe nulle part : l'endpoint reparait cote serveur, l'utilisateur ne
 * voyait toujours aucune suggestion. Ces tests fixent son contrat maintenant
 * qu'il est monte dans /search.
 */

const SUGGESTIONS = [
  { id: 1, title: 'Décret portant nomination du Directeur', reference: 'PRC-1' },
  { id: 2, title: 'Décret portant nomination des membres', reference: 'PRC-2' },
];

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ suggestions: SUGGESTIONS })
      }))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ne demande rien tant que la saisie est trop courte', async () => {
    const { container } = render(SearchBar, { props: { placeholder: 'Rechercher' } });
    const input = container.querySelector('input')!;

    await fireEvent.input(input, { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("n'emet qu'un seul appel malgre plusieurs frappes (anti-rebond)", async () => {
    const { container } = render(SearchBar, {});
    const input = container.querySelector('input')!;

    await fireEvent.input(input, { target: { value: 'nom' } });
    await fireEvent.input(input, { target: { value: 'nomi' } });
    await fireEvent.input(input, { target: { value: 'nomin' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(fetch).toHaveBeenCalledTimes(1);
    // `vi.mocked` rend le mock typé : une faute sur `.mock.calls` serait signalée,
    // ce qu'un `as any` empêchait.
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/search/suggest?q=nomin');
  });

  it('affiche les suggestions renvoyees', async () => {
    const { container, findByText } = render(SearchBar, {});
    const input = container.querySelector('input')!;

    await fireEvent.input(input, { target: { value: 'nomination' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(await findByText(/Directeur/)).toBeTruthy();
    expect(await findByText(/membres/)).toBeTruthy();
  });

  it('emet search sur Entree', async () => {
    const onSearch = vi.fn();
    const { container } = render(SearchBar, {
      props: { value: 'nomination' },
      events: { search: onSearch }
    });
    const input = container.querySelector('input')!;

    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSearch).toHaveBeenCalled();
  });

  it('une erreur reseau ne casse pas la saisie', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('hors ligne'); }));
    const { container } = render(SearchBar, {});
    const input = container.querySelector('input')!;

    await fireEvent.input(input, { target: { value: 'nomination' } });
    await vi.advanceTimersByTimeAsync(500);

    // Le compte portait sur des <li> — que ce composant NE REND PAS : les
    // suggestions sont des <div role="option">. L'assertion valait donc
    // 0 === 0 quoi qu'il arrive, et serait restee verte si l'erreur reseau
    // avait affiche la liste complete. On compte ce qui existe.
    expect(container.querySelectorAll('[role="option"]').length).toBe(0);
    expect(input.value).toBe('nomination');
  });

  it('la liste apparait bien quand la requete aboutit', async () => {
    // Contre-epreuve du test precedent : sans elle, un selecteur errone
    // rendrait les deux tests verts pour la mauvaise raison.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ suggestions: [{ id: 1, title: 'Decret de nomination', reference: 'PRC-1' }] }),
    })));
    const { container } = render(SearchBar, {});
    const input = container.querySelector('input')!;

    await fireEvent.input(input, { target: { value: 'nomination' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(container.querySelectorAll('[role="option"]').length).toBe(1);
  });
});
