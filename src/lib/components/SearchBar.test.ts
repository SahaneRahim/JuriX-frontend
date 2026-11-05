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

  it.each(['normal', 'large', 'compacte'] as const)(
    'pendant une recherche (%s), la balance pèse à la place de la loupe, et le bouton reste actif : Entrée envoie la requête corrigée',
    (size) => {
      // Désactivé pendant `loading`, il bloquait l'envoi implicite par Entrée :
      // la requête corrigée pendant la recherche ne partait pas. Refonte A
      // (E4b) : l'attente se dit à UN seul endroit, la balance qui remplace la
      // loupe ; le bouton ne tourne plus.
      const { container } = render(SearchBar, { props: { value: 'bail commercial', loading: true, size } });
      const envoi = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      const balances = container.querySelectorAll('svg[data-etat="attente"]');
      expect(balances).toHaveLength(1);
      // Décorative : la ligne d'état de la page dit « Recherche en cours… ».
      expect(balances[0].getAttribute('aria-hidden')).toBe('true');
      expect(balances[0].getAttribute('role')).toBeNull();
      expect(envoi.contains(balances[0])).toBe(false);
      expect(container.querySelector('[data-icone="loader-circle"]')).toBeNull();
      expect(envoi.disabled).toBe(false);
      expect(envoi.getAttribute('aria-label')).toBeTruthy();
    },
  );

  it.each(['normal', 'large', 'compacte'] as const)('sans recherche en cours (%s), la loupe, et aucune balance', (size) => {
    const { container } = render(SearchBar, { props: { value: 'bail', size } });
    expect(container.querySelector('svg[data-etat="attente"]')).toBeNull();
    const envoi = container.querySelector('button[type="submit"]')!;
    const loupes = [...container.querySelectorAll('[data-icone="search"]')].filter((i) => !envoi.contains(i));
    expect(loupes.length).toBeGreaterThan(0);
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

/**
 * Le champ compact de /search (refonte A, décisions R4 et R8) : une valeur de
 * plus pour `size`, la bascule « Assistant IA | Recherche », la même
 * soumission et les mêmes noms accessibles que les autres modèles.
 */
describe('SearchBar, taille compacte', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ suggestions: SUGGESTIONS }) })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('« Assistant IA » est un LIEN vers /chat?q=…, qui suit la saisie, sans préchargement au survol', async () => {
    const { container, getByRole } = render(SearchBar, { props: { size: 'compacte', value: 'licenciement' } });
    const groupe = getByRole('group', { name: 'Mode' });
    const assistant = groupe.querySelector('a') as HTMLAnchorElement;
    expect(assistant.textContent?.trim()).toBe('Assistant IA');
    // Au rendu : la requête de l'adresse, que la page lui passe (marche sans JavaScript).
    expect(assistant.getAttribute('href')).toBe('/chat?q=licenciement');
    // Le site précharge au survol : la bascule, seulement à l'appui.
    expect(assistant.getAttribute('data-sveltekit-preload-data')).toBe('tap');

    const champ = container.querySelector('input[name="q"]') as HTMLInputElement;
    await fireEvent.input(champ, { target: { value: '  licenciement économique ' } });
    expect(assistant.getAttribute('href')).toBe(`/chat?q=${encodeURIComponent('licenciement économique')}`);

    // Sans question, l'assistant seul.
    await fireEvent.input(champ, { target: { value: '   ' } });
    expect(assistant.getAttribute('href')).toBe('/chat');
  });

  it('« Recherche » est la page courante : un <span aria-current="page">, ni bouton ni aria-pressed', () => {
    const { getByRole } = render(SearchBar, { props: { size: 'compacte', value: 'bail' } });
    const groupe = getByRole('group', { name: 'Mode' });
    const courant = groupe.querySelector('[aria-current="page"]') as HTMLElement;
    expect(courant.tagName).toBe('SPAN');
    expect(courant.textContent?.trim()).toBe('Recherche');
    expect(groupe.querySelector('button')).toBeNull();
    expect(groupe.querySelector('[aria-pressed]')).toBeNull();
    // Les deux libellés seulement : le lien et la page courante.
    expect([...groupe.children].map((e) => e.tagName)).toEqual(['A', 'SPAN']);
  });

  it('une adresse d’assistant donnée par la page l’emporte', () => {
    const { getByRole } = render(SearchBar, {
      props: { size: 'compacte', value: 'bail', assistantHref: '/chat?q=autre' },
    });
    expect(getByRole('group', { name: 'Mode' }).querySelector('a')?.getAttribute('href')).toBe('/chat?q=autre');
  });

  it('le même formulaire GET, et les noms accessibles « Rechercher » (R4)', () => {
    const { container, getByRole } = render(SearchBar, {
      props: { size: 'compacte', value: 'bail', champs: [['nature', 'loi']] },
    });
    const formulaire = container.querySelector('form')!;
    expect(formulaire.getAttribute('method')).toBe('get');
    expect(formulaire.getAttribute('action')).toBe('/search');
    expect(formulaire.getAttribute('role')).toBe('search');
    expect(new FormData(formulaire).getAll('q')).toEqual(['bail']);
    expect(new FormData(formulaire).getAll('nature')).toEqual(['loi']);
    // La bascule n'envoie rien avec le formulaire.
    expect([...new FormData(formulaire).keys()].sort()).toEqual(['nature', 'q']);

    expect(getByRole('combobox', { name: 'Rechercher' })).toBe(container.querySelector('input[name="q"]'));
    const envoi = getByRole('button', { name: 'Rechercher' }) as HTMLButtonElement;
    expect(envoi.getAttribute('type')).toBe('submit');
    expect(envoi.disabled).toBe(false);
    // La flèche de la maquette, et rien d'autre dans le bouton.
    expect(envoi.querySelector('[data-icone="arrow-up"]')).not.toBeNull();
  });

  it('les suggestions de titres restent (R8)', async () => {
    const { container, findByText } = render(SearchBar, { props: { size: 'compacte' } });
    await fireEvent.input(container.querySelector('input')!, { target: { value: 'nomination' } });
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await findByText(/Directeur/)).toBeTruthy();
    expect(container.querySelector('input')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('la pile de feuilles est portée par un conteneur, la carte du champ par un élément intérieur, sans pile sur écran court', () => {
    const { container } = render(SearchBar, { props: { size: 'compacte' } });
    const champ = container.querySelector('input[name="q"]')!;
    // Le conteneur de la pile isole son empilement : ses feuilles (-z-10)
    // passent derrière la carte, et non devant son fond (PASSATION § 8, piège 3).
    const pile = container.querySelector('form > div.isolate') as HTMLElement;
    expect(pile).not.toBeNull();
    const carte = pile.firstElementChild as HTMLElement;
    expect(carte.contains(champ)).toBe(true);
    expect(pile.className).toMatch(/before:-z-10/);
    expect(pile.className).toMatch(/court:before:hidden/);
    expect(pile.className).toMatch(/court:after:hidden/);
  });
});
