import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « Questions fréquentes · citoyens » (refonte A, E3b) : trois liens vers
 * l'assistant, qui partent une fois à l'arrivée (H1), selon le profil et la
 * langue.
 */

vi.mock('$app/environment', () => ({ browser: true, building: false, dev: false, version: 'test' }));

import { language } from '$lib/stores/language';
import { SUGGESTIONS, SUGGESTIONS_A_L_ACCUEIL, questionAffichee } from '$lib/suggestions';
import QuestionsFrequentes, { lienDeQuestion } from './QuestionsFrequentes.svelte';

const liens = (container: HTMLElement) => [...container.querySelectorAll<HTMLAnchorElement>('ul a')];
const adresse = (question: string) => `/chat?q=${encodeURIComponent(question)}&envoyer=1`;

beforeEach(() => language.set({ current: 'fr' }));
afterEach(() => {
  cleanup();
  language.set({ current: 'fr' });
});

describe('QuestionsFrequentes', () => {
  it('trois liens, ceux du profil général, qui envoient la question à l’assistant (H1)', () => {
    const { container } = render(QuestionsFrequentes, { props: { persona: null } });
    expect(liens(container)).toHaveLength(SUGGESTIONS_A_L_ACCUEIL);
    expect(liens(container).map((a) => a.getAttribute('href'))).toEqual(SUGGESTIONS.fr.general.slice(0, 3).map(adresse));
    // À l'écran, l'espace fine insécable ; dans l'adresse, la question validée, telle quelle.
    expect(liens(container).map((a) => a.textContent?.trim())).toEqual(
      SUGGESTIONS.fr.general.slice(0, 3).map(questionAffichee),
    );
    // Blancs ASCII seuls réduits : l'espace insécable avant « · » est vérifiée.
    expect(container.querySelector('h2')?.textContent?.replace(/[ \t\n\r\f]+/g, ' ').trim()).toBe(
      'Questions fréquentes · profil général',
    );
  });

  it('écartent les robots : un lien qui envoie dépenserait un appel au modèle à chaque passage', () => {
    const { container } = render(QuestionsFrequentes, { props: { persona: null } });
    for (const lien of liens(container)) expect(lien.getAttribute('rel')).toBe('nofollow');
  });

  it('suivent le profil, et le titre le dit au pluriel', () => {
    const { container } = render(QuestionsFrequentes, { props: { persona: 'avocat' } });
    expect(liens(container).map((a) => a.getAttribute('href'))).toEqual(SUGGESTIONS.fr.avocat.slice(0, 3).map(adresse));
    expect(container.querySelector('h2 strong')?.textContent).toBe('avocats et juristes');
  });

  it('suivent la langue', async () => {
    const { container } = render(QuestionsFrequentes, { props: { persona: 'étudiant' } });
    language.set({ current: 'en' });
    await tick();
    expect(liens(container).map((a) => a.textContent?.trim())).toEqual(SUGGESTIONS.en['étudiant'].slice(0, 3));
    expect(container.querySelector('h2 strong')?.textContent).toBe('law students');
  });

  it('rejouent leur cascade au changement de profil, pas au premier affichage', async () => {
    const { container, rerender } = render(QuestionsFrequentes, { props: { persona: null } });
    expect(container.querySelectorAll('li.mv-monter')).toHaveLength(0);
    await rerender({ persona: 'entrepreneur' });
    await tick();
    const lignes = [...container.querySelectorAll<HTMLLIElement>('li')];
    expect(lignes.every((li) => li.classList.contains('mv-monter'))).toBe(true);
    // 70 ms d'écart, la première sans délai (A2 § 4).
    expect(lignes.map((li) => li.style.getPropertyValue('--d'))).toEqual(['0ms', '70ms', '140ms']);
    expect(liens(container)[0].getAttribute('href')).toBe(adresse(SUGGESTIONS.fr.entrepreneur[0]));
  });

  it('encodent la question dans l’adresse, accents et espaces compris', () => {
    expect(lienDeQuestion('Quels sont mes droits en garde à vue ?')).toBe(
      '/chat?q=Quels%20sont%20mes%20droits%20en%20garde%20%C3%A0%20vue%20%3F&envoyer=1',
    );
  });
});
