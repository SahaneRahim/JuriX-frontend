import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/persona-compte', () => ({
  changerPersona: vi.fn(),
  refuserPourCetteSession: vi.fn(),
}));

import { changerPersona, refuserPourCetteSession } from '$lib/persona-compte';
import { choixPersonaOuvert } from '$lib/stores/persona';
import ChoixPersona from './ChoixPersona.svelte';

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont
// besoin (`transition:fade`). Une animation inerte suffit ici.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

describe('ChoixPersona', () => {
  beforeEach(() => {
    vi.mocked(changerPersona).mockClear();
    vi.mocked(refuserPourCetteSession).mockClear();
    choixPersonaOuvert.set(false);
  });
  afterEach(() => cleanup());

  it('est une boite de dialogue modale, titree par un h2', () => {
    const { getByRole } = render(ChoixPersona, { props: { mode: 'accueil' } });

    const boite = getByRole('dialog');
    expect(boite.getAttribute('aria-modal')).toBe('true');
    expect(getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('propose les 4 profils et la sortie sans reponse', () => {
    const { getByTestId } = render(ChoixPersona, { props: { mode: 'accueil' } });

    for (const slug of ['citoyen', 'etudiant', 'avocat', 'entrepreneur']) {
      expect(getByTestId(`persona-choice-${slug}`)).toBeTruthy();
    }
    expect(getByTestId('persona-skip')).toBeTruthy();
  });

  it('en accueil, le focus va au titre : aucune carte n a l air choisie', () => {
    const { getByRole } = render(ChoixPersona, { props: { mode: 'accueil' } });

    expect(document.activeElement).toBe(getByRole('heading', { level: 2 }));
  });

  it('en accueil, Echap vaut « Ne pas repondre »', async () => {
    render(ChoixPersona, { props: { mode: 'accueil' } });

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(refuserPourCetteSession).toHaveBeenCalledTimes(1);
  });

  it('en changement, Echap ferme sans rien changer', async () => {
    choixPersonaOuvert.set(true);
    render(ChoixPersona, { props: { mode: 'changement' } });

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(refuserPourCetteSession).not.toHaveBeenCalled();
    expect(changerPersona).not.toHaveBeenCalled();
    expect(get(choixPersonaOuvert)).toBe(false);
  });

  it('une carte choisit son profil', async () => {
    const { getByTestId } = render(ChoixPersona, { props: { mode: 'accueil' } });

    await fireEvent.click(getByTestId('persona-choice-avocat'));

    expect(changerPersona).toHaveBeenCalledWith('avocat');
  });

  it('les autres touches ne sont jamais interceptees', async () => {
    render(ChoixPersona, { props: { mode: 'accueil' } });

    await fireEvent.keyDown(window, { key: 'a' });

    expect(refuserPourCetteSession).not.toHaveBeenCalled();
  });
});
