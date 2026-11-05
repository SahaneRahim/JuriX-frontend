import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * L'exemple tapé du champ de l'accueil (refonte A, décision H9).
 *
 * POURQUOI CES TESTS. La frappe est faite de minuteries : une boucle qui ne
 * s'arrête pas, une minuterie qui survit à la page ou une frappe qui tourne en
 * mouvement réduit ne se voient pas en revue. Les minuteries sont simulées
 * (`vi.useFakeTimers`), et le mouvement réduit l'est par `svelte/motion`, le
 * mécanisme du site.
 */

const mouvement = vi.hoisted(() => ({ current: false }));
vi.mock('svelte/motion', () => ({ prefersReducedMotion: mouvement }));

import ExempleTape, { delaiDeLettre } from './ExempleTape.svelte';

const LIBELLE = 'Exemple :';
const A = 'Quelles indemnités ?';
const B = 'Garde à vue ?';
const C = 'Escroquerie ?';

/** Le texte affiché, préfixe compris. */
const affiche = (container: HTMLElement) =>
  container.querySelector('[data-testid="accueil-exemple"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const curseur = (container: HTMLElement) => container.querySelector('.mv-curseur');

/** Avance les minuteries puis laisse Svelte mettre la page à jour. */
async function attendre(ms: number) {
  vi.advanceTimersByTime(ms);
  await tick();
}

beforeEach(() => {
  vi.useFakeTimers();
  mouvement.current = false;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ExempleTape', () => {
  it('montre d’emblée le premier exemple, entier, derrière « Exemple : »', async () => {
    const { container } = render(ExempleTape, { props: { exemples: [A, B, C], libelle: LIBELLE } });
    await tick();
    expect(affiche(container)).toBe(`${LIBELLE} ${A}`);
    expect(container.querySelector('[data-testid="accueil-exemple"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('une seule boucle : garde l’exemple, l’efface, tape le suivant, et s’arrête sur le dernier', async () => {
    const { container } = render(ExempleTape, { props: { exemples: [A, B, C], libelle: LIBELLE } });
    await tick();
    expect(curseur(container)).not.toBeNull();

    // 2,2 s plein, puis l'effacement, trois lettres par pas de 16 ms.
    await attendre(2200);
    expect(affiche(container)).toBe(`${LIBELLE} ${A}`);
    await attendre(16);
    expect(affiche(container)).toBe(`${LIBELLE} ${A.slice(0, A.length - 3)}`);

    // Assez de temps pour tout : effacer A, taper B, le garder, l'effacer, taper C.
    await attendre(60_000);
    expect(affiche(container)).toBe(`${LIBELLE} ${C}`);
    // Fini : plus de curseur, plus aucune minuterie qui tourne.
    expect(curseur(container)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('tape lettre à lettre, de 38 à 72 ms par lettre, sans effacer le préfixe', async () => {
    const { container } = render(ExempleTape, { props: { exemples: [A, B], libelle: LIBELLE } });
    await tick();
    // A est effacé (2,2 s plein, puis 7 pas de 16 ms pour 20 lettres), 420 ms
    // de pause, puis la première lettre de B.
    await attendre(2200 + 7 * 16 + 420);
    expect(affiche(container)).toBe(`${LIBELLE} ${B.slice(0, 1)}`);
    await attendre(delaiDeLettre(1));
    expect(affiche(container)).toBe(`${LIBELLE} ${B.slice(0, 2)}`);
    for (let rang = 1; rang <= 200; rang++) {
      expect(delaiDeLettre(rang)).toBeGreaterThanOrEqual(38);
      expect(delaiDeLettre(rang)).toBeLessThanOrEqual(72);
    }
  });

  it('repart à zéro quand la liste change (profil ou mode)', async () => {
    const { container, rerender } = render(ExempleTape, { props: { exemples: [A, B], libelle: LIBELLE } });
    await tick();
    await attendre(3000);
    await rerender({ exemples: [C, B] });
    await tick();
    // Rien de tapé : le préfixe seul, puis C lettre à lettre après 500 ms.
    expect(affiche(container)).toBe(LIBELLE);
    await attendre(500);
    expect(affiche(container)).toBe(`${LIBELLE} ${C.slice(0, 1)}`);
  });

  it('ne repart pas quand la nouvelle liste s’ouvre sur l’exemple déjà affiché', async () => {
    // Au montage, le profil du navigateur remplace le profil général du
    // serveur : « Quelles indemnités… » ouvre les deux listes.
    const { container, rerender } = render(ExempleTape, { props: { exemples: [A, B], libelle: LIBELLE } });
    await tick();
    await rerender({ exemples: [A, C] });
    await tick();
    expect(affiche(container)).toBe(`${LIBELLE} ${A}`);
    await attendre(60_000);
    expect(affiche(container)).toBe(`${LIBELLE} ${C}`);
  });

  it('ne tape rien quand le champ a le focus ou n’est pas vide, et repart à zéro quand il redevient vide', async () => {
    const { container, rerender } = render(ExempleTape, { props: { exemples: [A, B], libelle: LIBELLE } });
    await tick();
    await rerender({ actif: false });
    await tick();
    const fige = affiche(container);
    await attendre(60_000);
    expect(affiche(container)).toBe(fige);
    expect(vi.getTimerCount()).toBe(0);

    // Le champ quitté vide : la frappe repart de la première lettre du premier exemple.
    await rerender({ actif: true });
    await tick();
    expect(affiche(container)).toBe(LIBELLE);
    await attendre(500);
    expect(affiche(container)).toBe(`${LIBELLE} ${A.slice(0, 1)}`);
  });

  it('en mouvement réduit : le premier exemple, entier, sans curseur ni minuterie, même si la liste change', async () => {
    mouvement.current = true;
    const { container, rerender } = render(ExempleTape, { props: { exemples: [A, B], libelle: LIBELLE } });
    await tick();
    await attendre(60_000);
    expect(affiche(container)).toBe(`${LIBELLE} ${A}`);
    expect(curseur(container)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    await rerender({ exemples: [C, B] });
    await tick();
    expect(affiche(container)).toBe(`${LIBELLE} ${C}`);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('le mouvement réduit activé pendant la frappe l’arrête au pas suivant', async () => {
    const { container } = render(ExempleTape, { props: { exemples: [A, B], libelle: LIBELLE } });
    await tick();
    expect(curseur(container)).not.toBeNull();
    mouvement.current = true;
    await attendre(2200);
    expect(affiche(container)).toBe(`${LIBELLE} ${A}`);
    expect(curseur(container)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ne laisse aucune minuterie derrière lui', async () => {
    const { unmount } = render(ExempleTape, { props: { exemples: [A, B, C], libelle: LIBELLE } });
    await tick();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
