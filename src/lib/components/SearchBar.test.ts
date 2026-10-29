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

  it('est un vrai formulaire GET vers /search, avec un champ q (P8)', () => {
    // Sans JavaScript, c'est le navigateur qui l'envoie : la méthode, l'adresse
    // et le nom du champ sont tout ce qui fait partir la recherche.
    const { container } = render(SearchBar, {
      props: { value: 'bail', champs: [['categorie', '13'], ['tri', 'recent']] }
    });
    const formulaire = container.querySelector('form')!;
    expect(formulaire.getAttribute('method')).toBe('get');
    expect(formulaire.getAttribute('action')).toBe('/search');
    expect(formulaire.getAttribute('role')).toBe('search');
    expect(new FormData(formulaire).getAll('q')).toEqual(['bail']);
    expect(new FormData(formulaire).getAll('categorie')).toEqual(['13']);
    expect(new FormData(formulaire).getAll('tri')).toEqual(['recent']);
    // Entrée et la touche « Rechercher » du clavier envoient par ce bouton :
    // jamais inactif au rendu, sinon l'envoi par Entrée serait bloqué lui aussi.
    const envoi = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(envoi.disabled).toBe(false);
    expect(envoi.getAttribute('aria-label')).toBeTruthy();
  });

  it('pendant une recherche, la roue tourne mais le bouton reste actif : Entrée envoie la requête corrigée', () => {
    // Désactivé pendant `loading`, il bloquait l'envoi implicite par Entrée :
    // la requête corrigée pendant la recherche ne partait pas.
    const { container } = render(SearchBar, { props: { value: 'bail commercial', loading: true } });
    const envoi = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(container.querySelector('[data-icone="loader-circle"]')).not.toBeNull();
    expect(envoi.disabled).toBe(false);
    expect(envoi.getAttribute('aria-label')).toBeTruthy();
  });

  it('emet search a l’envoi du formulaire', async () => {
    const onSearch = vi.fn();
    const { container } = render(SearchBar, {
      props: { value: 'nomination' },
      events: { search: onSearch }
    });

    await fireEvent.submit(container.querySelector('form')!);

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch.mock.calls[0][0].detail).toEqual({ query: 'nomination' });
  });

  it('une requete vide ne part pas quand le JavaScript tourne', async () => {
    const onSearch = vi.fn();
    const { container } = render(SearchBar, { props: { value: '   ' }, events: { search: onSearch } });
    const formulaire = container.querySelector('form')!;
    const envoi = new Event('submit', { cancelable: true, bubbles: true });

    formulaire.dispatchEvent(envoi);

    expect(envoi.defaultPrevented).toBe(true);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('Entree sans suggestion choisie laisse le navigateur envoyer le formulaire', async () => {
    const { container } = render(SearchBar, { props: { value: 'nomination' } });
    const input = container.querySelector('input[name="q"]')!;
    const touche = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });

    input.dispatchEvent(touche);

    expect(touche.defaultPrevented).toBe(false);
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
