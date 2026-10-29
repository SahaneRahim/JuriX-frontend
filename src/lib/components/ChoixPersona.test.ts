import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/persona-compte', () => ({
  changerPersona: vi.fn(),
  refuserPourCetteSession: vi.fn(),
}));

import { tick } from 'svelte';
import { ecrireSessionChat } from '$lib/chat-session';
import { changerPersona } from '$lib/persona-compte';
import {
  annonceDuChat,
  choixPersonaOuvert,
  conversationDuChatEnCours,
  fermerChoixPersona,
  ouvrirChoixPersona,
  personaStore,
} from '$lib/stores/persona';
import ChoixPersona from './ChoixPersona.svelte';

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont
// besoin (`transition:fade`). Une animation inerte suffit ici.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

/**
 * La boîte n'a plus qu'un mode, « changement » : elle ne s'ouvre plus
 * d'elle-même à l'arrivée (P5), la question du profil se pose dans le chat.
 */
describe('ChoixPersona', () => {
  beforeEach(() => {
    vi.mocked(changerPersona).mockClear();
    fermerChoixPersona();
    conversationDuChatEnCours.set(false);
    localStorage.clear();
    personaStore._reinitialiser();
  });
  afterEach(() => cleanup());

  it('est une boite de dialogue modale, titree par un h2, en mode changement', () => {
    ouvrirChoixPersona();
    const { getByRole, getByTestId } = render(ChoixPersona);

    const boite = getByRole('dialog');
    expect(boite.getAttribute('aria-modal')).toBe('true');
    expect(getByRole('heading', { level: 2 })).toBeTruthy();
    // Lu par les tests de bout en bout.
    expect(getByTestId('persona-dialog').getAttribute('data-mode')).toBe('changement');
  });

  it('propose les 4 profils, le profil general et la croix', () => {
    ouvrirChoixPersona();
    const { getByTestId } = render(ChoixPersona);

    for (const slug of ['citoyen', 'etudiant', 'avocat', 'entrepreneur']) {
      expect(getByTestId(`persona-choice-${slug}`)).toBeTruthy();
    }
    expect(getByTestId('persona-skip')).toBeTruthy();
    expect(getByTestId('persona-dialog-close')).toBeTruthy();
  });

  it('Echap ferme sans rien changer', async () => {
    choixPersonaOuvert.set(true);
    render(ChoixPersona);

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(changerPersona).not.toHaveBeenCalled();
    expect(get(choixPersonaOuvert)).toBe(false);
  });

  it('une carte choisit son profil et ferme la boite', async () => {
    ouvrirChoixPersona();
    const { getByTestId } = render(ChoixPersona);

    await fireEvent.click(getByTestId('persona-choice-avocat'));

    expect(changerPersona).toHaveBeenCalledWith('avocat');
    expect(get(choixPersonaOuvert)).toBe(false);
  });

  it('le profil general se choisit comme les autres', async () => {
    ouvrirChoixPersona();
    const { getByTestId } = render(ChoixPersona);

    await fireEvent.click(getByTestId('persona-skip'));

    expect(changerPersona).toHaveBeenCalledWith(null);
  });

  it('les autres touches ne sont jamais interceptees', async () => {
    ouvrirChoixPersona();
    render(ChoixPersona);

    await fireEvent.keyDown(window, { key: 'a' });

    expect(get(choixPersonaOuvert)).toBe(true);
  });

  describe('le fond', () => {
    function fond() {
      return document.querySelector('[role="presentation"]') as HTMLElement;
    }

    it('un clic simple sur le fond ferme', async () => {
      ouvrirChoixPersona();
      render(ChoixPersona);

      await fireEvent.pointerDown(fond());
      await fireEvent.click(fond(), { detail: 1 });

      expect(get(choixPersonaOuvert)).toBe(false);
    });

    it('le second clic d un double-clic sur le bouton d ouverture ne ferme pas', async () => {
      ouvrirChoixPersona();
      render(ChoixPersona);

      await fireEvent.pointerDown(fond());
      await fireEvent.click(fond(), { detail: 2 });

      expect(get(choixPersonaOuvert)).toBe(true);
    });

    it('un glisser commence sur une carte et relache sur le fond ne ferme pas', async () => {
      ouvrirChoixPersona();
      const { getByTestId } = render(ChoixPersona);

      await fireEvent.pointerDown(getByTestId('persona-choice-avocat'));
      await fireEvent.click(fond(), { detail: 1 });

      expect(get(choixPersonaOuvert)).toBe(true);
    });
  });

  it('depuis le chat, « Actuel » est le profil de la conversation affichee', () => {
    // Profil choisi citoyen, conversation avocat rouverte.
    personaStore.choisir('citoyen');
    ouvrirChoixPersona('avocat');
    const { getByTestId } = render(ChoixPersona);

    expect(getByTestId('persona-choice-avocat').getAttribute('aria-current')).toBe('true');
    expect(getByTestId('persona-choice-citoyen').getAttribute('aria-current')).toBeNull();
    expect(document.activeElement).toBe(getByTestId('persona-choice-avocat'));
  });

  it('« Actuel » est un badge du guide, dans sa casse, et non des capitales de 10 px', () => {
    personaStore.choisir('citoyen');
    ouvrirChoixPersona();
    const { getByTestId } = render(ChoixPersona);

    const badge = [...getByTestId('persona-choice-citoyen').querySelectorAll('span')].find(
      (s) => s.textContent?.trim() === 'Actuel',
    );
    expect(badge).toBeTruthy();
    // Guide § 4.8 : text-xs font-medium, casse d'origine (Q5 A).
    expect(badge?.classList.contains('text-xs')).toBe(true);
    expect(badge?.classList.contains('font-medium')).toBe(true);
    for (const classe of ['uppercase', 'text-[10px]', 'font-bold']) expect(badge?.classList.contains(classe), classe).toBe(false);
    // Un seul profil actuel.
    expect(getByTestId('persona-dialog').textContent?.match(/Actuel/g)).toHaveLength(1);
  });

  /**
   * Ouverte, la boîte rend toute la page inerte (src/routes/+layout.svelte),
   * région d'annonce du chat comprise : la fin d'une réponse arrivée pendant
   * ce temps n'était jamais dite. Le chat écrit dans `annonceDuChat`.
   */
  it('la region d annonce du chat est DANS la boite, vide a l ouverture', async () => {
    annonceDuChat.set('Phrase d une boite precedente.');
    ouvrirChoixPersona();
    const { getByRole, getByTestId } = render(ChoixPersona);

    const region = getByTestId('persona-dialog-announce');
    expect(getByRole('dialog').contains(region)).toBe(true);
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent?.trim()).toBe('');

    annonceDuChat.set('Réponse terminée.');
    await tick();

    expect(region.textContent?.trim()).toBe('Réponse terminée.');
    fermerChoixPersona();
    expect(get(annonceDuChat)).toBe('');
  });

  it('le profil general est marque actuel et recoit le focus', () => {
    personaStore.refuser();
    ouvrirChoixPersona();
    const { getByTestId } = render(ChoixPersona);

    expect(getByTestId('persona-skip').getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(getByTestId('persona-skip'));
  });

  describe('une conversation a perdre (P4)', () => {
    it('sans conversation, rien a dire', () => {
      ouvrirChoixPersona();
      const { queryByTestId } = render(ChoixPersona);

      expect(queryByTestId('persona-new-conversation')).toBeNull();
    });

    it('conversation affichee dans le chat : un autre profil en ouvre une nouvelle', () => {
      conversationDuChatEnCours.set(true);
      ouvrirChoixPersona();
      const { getByTestId } = render(ChoixPersona);

      expect(getByTestId('persona-new-conversation')).toBeTruthy();
    });

    it('conversation gardee par le navigateur, depuis une autre page : meme avertissement', async () => {
      ecrireSessionChat('sid-1', 'citoyen');
      ouvrirChoixPersona();
      const { findByTestId } = render(ChoixPersona);

      expect(await findByTestId('persona-new-conversation')).toBeTruthy();
    });
  });
});
