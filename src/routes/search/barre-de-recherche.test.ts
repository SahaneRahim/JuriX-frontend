import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchBar from '$lib/components/SearchBar.svelte';

/**
 * Le champ de /search (SearchBar, grand modèle) : son texte indicatif tient
 * dans la largeur du champ, de 320 px au bureau. À 390 px, « Rechercher une
 * loi, un décret, un article... » était coupé net sous la loupe (« un
 * décr »), sans points de suspension.
 */

const LONGUE = 'Rechercher une loi, un décret, un article...';
const COURTE = 'Rechercher un texte…';

describe('SearchBar sur /search : texte indicatif', () => {
  const matchMediaDuSetup = window.matchMedia;

  afterEach(() => {
    window.matchMedia = matchMediaDuSetup;
  });

  it('la phrase courte sous 640 px, et au rendu serveur', () => {
    // Le setup des tests répond « ne correspond pas » à toute media query : un téléphone.
    const { container } = render(SearchBar, { props: { size: 'large', placeholder: LONGUE, placeholderCourt: COURTE } });
    expect(container.querySelector('input')!.getAttribute('placeholder')).toBe(COURTE);
  });

  it('la phrase entière à partir de 640 px', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 640px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(SearchBar, { props: { size: 'large', placeholder: LONGUE, placeholderCourt: COURTE } });
    await tick();
    expect(container.querySelector('input')!.getAttribute('placeholder')).toBe(LONGUE);
  });

  it('sans phrase courte, la phrase entière partout', () => {
    const { container } = render(SearchBar, { props: { size: 'large', placeholder: LONGUE } });
    expect(container.querySelector('input')!.getAttribute('placeholder')).toBe(LONGUE);
  });

  it('champ vide : la marge droite ne réserve que le bouton d’envoi', async () => {
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
});
