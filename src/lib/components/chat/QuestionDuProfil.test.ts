import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});

import EtatDeLaReponse from './EtatDeLaReponse.svelte';
import QuestionDuProfil from './QuestionDuProfil.svelte';

describe('QuestionDuProfil (P5)', () => {
  afterEach(() => cleanup());

  it('quatre profils en boutons dans le fil, et de quoi continuer sans profil', async () => {
    const surChoix = vi.fn();
    const { getByRole, getByTestId } = render(QuestionDuProfil, { props: { idMessage: 3, surChoix } });

    const groupe = getByRole('group');
    expect(document.getElementById(groupe.getAttribute('aria-labelledby')!)?.textContent).toContain('qui êtes-vous ?');
    expect(groupe.querySelectorAll('button')).toHaveLength(4);
    // Ce n'est pas une fenêtre : rien de modal dans le fil.
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    await fireEvent.click(getByTestId('chat-profile-avocat'));
    expect(surChoix).toHaveBeenCalledWith('avocat');

    await fireEvent.click(getByTestId('chat-profile-skip'));
    expect(surChoix).toHaveBeenCalledWith(null);
  });

  it('une fois répondu, la réponse remplace les boutons et garde le focus', async () => {
    const { getByTestId, queryByTestId, rerender } = render(QuestionDuProfil, {
      props: { idMessage: 3, surChoix: vi.fn() },
    });
    const bouton = getByTestId('chat-profile-etudiant');
    bouton.focus();
    await fireEvent.click(bouton);

    await rerender({ idMessage: 3, surChoix: vi.fn(), choix: 'étudiant' });

    expect(queryByTestId('chat-profile-etudiant')).toBeNull();
    const reponse = getByTestId('chat-profile-chosen');
    expect(reponse.textContent).toContain('Profil choisi : Étudiant en droit.');
    await waitFor(() => expect(document.activeElement).toBe(reponse));
  });

  /**
   * Un profil choisi dans un autre onglet, ou lu sur le compte, répond à la
   * question sans passer par ses boutons. Le focus, posé sur le premier profil
   * par l'envoi au clavier, disparaissait avec eux : la tabulation suivante
   * repartait du haut de la page.
   */
  it('une réponse venue d’ailleurs : le focus laissé sur un bouton passe à la réponse', async () => {
    const surChoix = vi.fn();
    const { getByTestId, rerender } = render(QuestionDuProfil, { props: { idMessage: 3, surChoix } });
    getByTestId('chat-profile-citoyen').focus();

    await rerender({ idMessage: 3, surChoix, choix: 'avocat' });

    const reponse = getByTestId('chat-profile-chosen');
    await waitFor(() => expect(document.activeElement).toBe(reponse));
    expect(surChoix).not.toHaveBeenCalled();
  });

  it('une réponse venue d’ailleurs, le focus hors de la question : il reste où il est', async () => {
    const ailleurs = document.body.appendChild(document.createElement('textarea'));
    try {
      const { getByTestId, rerender } = render(QuestionDuProfil, { props: { idMessage: 3, surChoix: vi.fn() } });
      ailleurs.focus();

      await rerender({ idMessage: 3, surChoix: vi.fn(), choix: 'avocat' });

      expect(getByTestId('chat-profile-chosen')).toBeTruthy();
      await tick();
      expect(document.activeElement).toBe(ailleurs);
    } finally {
      ailleurs.remove();
    }
  });

  it('sans profil : la réponse le dit', () => {
    const { getByTestId } = render(QuestionDuProfil, { props: { idMessage: 3, surChoix: vi.fn(), choix: null } });

    expect(getByTestId('chat-profile-chosen').textContent).toContain('Réponse en profil général.');
  });
});

describe('EtatDeLaReponse (P4)', () => {
  afterEach(() => cleanup());

  it('les étapes passées cochées et dites terminées, l’étape en cours animée', () => {
    const { getByTestId } = render(EtatDeLaReponse, {
      props: {
        etapes: [
          { libelle: 'Recherche dans les textes…', faite: true },
          { libelle: '6 articles trouvés : Code du travail, Décret n° 94/199…', faite: true },
          { libelle: 'Rédaction de la réponse…', faite: false },
        ],
      },
    });

    const etapes = getByTestId('chat-progress').querySelectorAll('li');
    expect(etapes).toHaveLength(3);
    expect(etapes[0].querySelector('svg')?.getAttribute('data-icone')).toBe('check');
    expect(etapes[0].textContent).toContain('(terminé)');
    const enCours = etapes[2].querySelector('svg');
    expect(enCours?.getAttribute('data-icone')).toBe('loader-circle');
    expect(enCours?.getAttribute('class')).toContain('motion-safe:animate-spin');
    expect(etapes[2].className).toContain('font-medium');
    // Plus de points qui sautent.
    expect(getByTestId('chat-progress').querySelector('.animate-bounce, [class*="animate-bounce"]')).toBeNull();
  });
});
