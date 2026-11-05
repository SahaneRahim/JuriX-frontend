import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});

import EtatDeLaReponse from './EtatDeLaReponse.svelte';

/**
 * L'attente d'une réponse (P4), refaite pour la refonte A (E6, étape 1) : la
 * balance pèse sur l'étape en cours, la coche se trace à la fin d'une étape,
 * sans bulle, sous l'étiquette « JuriX », et sans région d'annonce (la page en
 * a une seule, `chat-announce`). Le test de P4 (étapes cochées, dites
 * terminées, l'étape en cours seule animée) vivait dans
 * QuestionDuProfil.test.ts : il est ici, avec la balance à la place de la roue.
 */

const TROIS_ETAPES = [
  { libelle: 'Recherche dans les textes…', faite: true },
  { libelle: '6 articles trouvés : Code du travail, Décret n° 94/199…', faite: true },
  { libelle: 'Rédaction de la réponse…', faite: false },
];

describe('EtatDeLaReponse (P4, refonte A)', () => {
  afterEach(() => cleanup());

  it('les étapes passées cochées et dites terminées, l’étape en cours animée', () => {
    const { getByTestId } = render(EtatDeLaReponse, { props: { etapes: TROIS_ETAPES } });

    const etapes = getByTestId('chat-progress').querySelectorAll('li');
    expect(etapes).toHaveLength(3);
    expect(etapes[0].querySelector('svg')?.getAttribute('data-icone')).toBe('check');
    expect(etapes[0].textContent).toContain('(terminé)');
    // L'étape en cours : la balance qui pèse, et non plus la roue.
    const enCours = etapes[2].querySelector('svg');
    expect(enCours?.getAttribute('data-icone')).toBe('scale');
    expect(enCours?.getAttribute('class')).toContain('mv-balance--attente');
    expect(etapes[2].className).toContain('font-medium');
    // Une seule chose bouge : l'étape en cours. Plus de points qui sautent,
    // plus de roue.
    const progres = getByTestId('chat-progress');
    expect(progres.querySelectorAll('.mv-balance--attente')).toHaveLength(1);
    expect(progres.querySelector('.animate-bounce, [class*="animate-bounce"], [class*="animate-spin"]')).toBeNull();
    expect(progres.querySelector('[data-icone="loader-circle"]')).toBeNull();
  });

  it('une étape finie : sa coche se trace (mv-dessiner), décorative', () => {
    const { getByTestId } = render(EtatDeLaReponse, { props: { etapes: TROIS_ETAPES } });

    const coches = getByTestId('chat-progress').querySelectorAll('svg[data-icone="check"]');
    expect(coches).toHaveLength(2);
    for (const coche of coches) {
      expect(coche.getAttribute('class')).toContain('mv-dessiner');
      expect(coche.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('l’étape qui se termine perd sa balance pour une coche, qui naît à ce moment-là', async () => {
    const { getByTestId, rerender } = render(EtatDeLaReponse, {
      props: { etapes: [{ libelle: 'Recherche dans les textes…', faite: false }] },
    });
    const ligne = getByTestId('chat-progress').querySelector('li')!;
    expect(ligne.querySelector('svg')?.getAttribute('data-icone')).toBe('scale');

    await rerender({
      etapes: [
        { libelle: 'Recherche dans les textes…', faite: true },
        { libelle: 'Rédaction de la réponse…', faite: false },
      ],
    });

    // La même ligne, dont l'icône a changé : la coche est un nœud neuf, son
    // tracé part de zéro (CSS ne rejoue une animation qu'à la naissance).
    const lignes = getByTestId('chat-progress').querySelectorAll('li');
    expect(lignes[0]).toBe(ligne);
    expect(lignes[0].querySelector('svg')?.getAttribute('class')).toContain('mv-dessiner');
    expect(lignes[1].querySelector('svg')?.getAttribute('class')).toContain('mv-balance--attente');
  });

  it('sans bulle : l’étiquette « JuriX », sa balance au repos ; aucune région d’annonce', () => {
    const { getByTestId } = render(EtatDeLaReponse, {
      props: { etapes: [{ libelle: 'Préparation de la réponse…', faite: false }] },
    });
    const progres = getByTestId('chat-progress');

    const etiquette = progres.querySelector('p');
    expect(etiquette?.textContent?.trim()).toBe('JuriX');
    expect(etiquette?.querySelector('svg')?.getAttribute('class')).toContain('mv-balance--repos');
    // Ni bulle bordée ni avatar : la place de l'avatar reste vide (alignement
    // sur la réponse, qui garde le sien jusqu'à l'étape 6).
    expect(progres.querySelector('[class*="rounded-2xl"], [class*="border"]')).toBeNull();
    expect(progres.querySelector('[data-icone="bot"]')).toBeNull();
    // La page dit les étapes par SA région : pas de seconde ici (piège 12).
    expect(progres.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    expect(progres.getAttribute('role')).toBeNull();
    // Les balances sont décoratives, sans rôle.
    for (const balance of progres.querySelectorAll('svg[data-icone="scale"]')) {
      expect(balance.getAttribute('aria-hidden')).toBe('true');
      expect(balance.getAttribute('role')).toBeNull();
    }
  });
});
