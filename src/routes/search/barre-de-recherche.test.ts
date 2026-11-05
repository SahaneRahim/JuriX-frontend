import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchBar from '$lib/components/SearchBar.svelte';

/**
 * Le champ de /search (SearchBar) : son texte indicatif tient dans la largeur
 * du champ, de 320 px au bureau. À 390 px, « Rechercher une loi, un décret,
 * un article... » était coupé net sous la loupe (« un décr »), sans points de
 * suspension.
 *
 * Refonte A (E4b) : /search a quitté le grand modèle pour le modèle COMPACT
 * (décision R8). Le texte indicatif suit la même règle dans les deux ; la
 * place gardée pour les boutons, elle, n'est plus la même : le grand modèle
 * pose ses boutons PAR-DESSUS le champ, qui leur réserve une marge ; le
 * compact les met À CÔTÉ de lui, dans le flux.
 */

const LONGUE = 'Rechercher une loi, un décret, un article...';
const COURTE = 'Rechercher un texte…';

describe.each(['compacte', 'large'] as const)('SearchBar (%s) : texte indicatif', (size) => {
  const matchMediaDuSetup = window.matchMedia;

  afterEach(() => {
    window.matchMedia = matchMediaDuSetup;
  });

  it('la phrase courte sous 640 px, et au rendu serveur', () => {
    // Le setup des tests répond « ne correspond pas » à toute media query : un téléphone.
    const { container } = render(SearchBar, { props: { size, placeholder: LONGUE, placeholderCourt: COURTE } });
    expect(container.querySelector('input[name="q"]')!.getAttribute('placeholder')).toBe(COURTE);
  });

  it('la phrase entière à partir de 640 px', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 640px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(SearchBar, { props: { size, placeholder: LONGUE, placeholderCourt: COURTE } });
    await tick();
    expect(container.querySelector('input[name="q"]')!.getAttribute('placeholder')).toBe(LONGUE);
  });

  it('sans phrase courte, la phrase entière partout', () => {
    const { container } = render(SearchBar, { props: { size, placeholder: LONGUE } });
    expect(container.querySelector('input[name="q"]')!.getAttribute('placeholder')).toBe(LONGUE);
  });
});

describe('SearchBar : la place des boutons', () => {
  it('grand modèle, champ vide : la marge droite ne réserve que le bouton d’envoi', async () => {
    const { container } = render(SearchBar, { props: { size: 'large', value: '' } });
    const input = container.querySelector('input')!;
    expect(input.classList.contains('pr-14')).toBe(true);
    expect(container.querySelectorAll('button')).toHaveLength(1);

    await fireEvent.input(input, { target: { value: 'bail' } });
    // « Effacer » apparaît : la marge lui fait place.
    expect(container.querySelectorAll('button')).toHaveLength(2);
    expect(input.classList.contains('pr-14')).toBe(false);
    expect(input.classList.contains('pr-[6.5rem]')).toBe(true);
  });

  it('modèle compact (/search) : la saisie ne passe sous aucun bouton, « effacer » se pose à côté d’elle', async () => {
    const { container } = render(SearchBar, { props: { size: 'compacte', value: '' } });
    const input = container.querySelector('input[name="q"]') as HTMLInputElement;
    // Champ vide : seul le bouton d'envoi, et aucune marge réservée pour
    // des boutons posés dessus (le texte indicatif a toute la largeur).
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect([...input.classList].some((c) => /^(sm:|md:)?pr-/.test(c))).toBe(false);

    await fireEvent.input(input, { target: { value: 'bail' } });
    const boutons = [...container.querySelectorAll('button')];
    expect(boutons).toHaveLength(2);
    const effacer = boutons.find((b) => b.getAttribute('type') === 'button')!;
    // Dans le même rang flexible que la saisie, et non en surimpression.
    expect(effacer.parentElement).toBe(input.parentElement);
    for (const bouton of boutons) {
      for (let n: HTMLElement | null = bouton; n && n.tagName !== 'FORM'; n = n.parentElement) {
        expect(n.classList.contains('absolute'), `${n.tagName}.${n.className}`).toBe(false);
      }
    }
  });
});
