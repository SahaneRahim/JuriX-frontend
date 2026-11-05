import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « Ce que JuriX vous montre » (refonte A, décision H11).
 *
 * POURQUOI CES TESTS. Armées, les démonstrations sont invisibles : c'est le
 * piège « caché au repos, révélé par l'animation » (PASSATION § 8, n° 2). Le
 * serveur et le mouvement réduit gardent l'état final (accueil.serveur.test.ts,
 * ux-accueil.spec.ts) ; ici, tout ce qui pose l'état armé, et tout ce qui doit
 * le lever, y compris sur une section plus haute que l'écran.
 */

vi.mock('$app/environment', () => ({ browser: true, building: false, dev: false, version: 'test' }));
const mouvement = vi.hoisted(() => ({ current: false }));
vi.mock('svelte/motion', () => ({ prefersReducedMotion: mouvement }));

import PreuvesJuriX from './PreuvesJuriX.svelte';

/** L'observateur simulé : le test lui fait rapporter ce qu'il veut. */
class Observateur {
  static dernier: Observateur | null = null;
  cible: Element | null = null;
  deconnecte = false;
  constructor(
    readonly rapporter: (entrees: IntersectionObserverEntry[]) => void,
    readonly reglages: IntersectionObserverInit,
  ) {
    Observateur.dernier = this;
  }
  observe(cible: Element) {
    this.cible = cible;
  }
  disconnect() {
    this.deconnecte = true;
  }
}

const HAUTEUR_DE_L_ECRAN = 800;

/** La grille des trois cartes, dans sa boîte à l'écran. */
function placerLaGrille(haut: number, bas: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: haut, bottom: bas } as DOMRect);
}

const etat = (container: HTMLElement) => container.querySelector('[data-etat]')?.getAttribute('data-etat');

/** Fait rapporter à l'observateur une part visible de la section. */
async function voir(ratio: number, hauteurVisible: number, isIntersecting = true) {
  Observateur.dernier?.rapporter([
    { isIntersecting, intersectionRatio: ratio, intersectionRect: { height: hauteurVisible } } as IntersectionObserverEntry,
  ]);
  await tick();
}

beforeEach(() => {
  vi.useFakeTimers();
  mouvement.current = false;
  Observateur.dernier = null;
  vi.stubGlobal('IntersectionObserver', Observateur);
  vi.stubGlobal('innerHeight', HAUTEUR_DE_L_ECRAN);
  placerLaGrille(2000, 2400);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PreuvesJuriX', () => {
  it('sous l’écran : armée après le montage, jouée une fois à l’arrivée, puis au repos', async () => {
    const { container } = render(PreuvesJuriX);
    await tick();
    expect(etat(container)).toBe('arme');
    expect(Observateur.dernier?.cible).toBe(container.querySelector('[data-etat]'));

    await voir(0.3, 120);
    expect(etat(container)).toBe('joue');
    expect(Observateur.dernier?.deconnecte).toBe(true);

    vi.advanceTimersByTime(1400);
    await tick();
    expect(etat(container)).toBe('repos');
  });

  it('reste armée tant que la section est à peine entrée ou sortie de l’écran', async () => {
    const { container } = render(PreuvesJuriX);
    await tick();
    await voir(0.1, 40);
    expect(etat(container)).toBe('arme');
    await voir(0, 0, false);
    expect(etat(container)).toBe('arme');
  });

  it('plus haute que l’écran, elle se joue quand même : 30 % de l’écran suffisent', async () => {
    // À 400 % de zoom : jamais 30 % de la section à l'écran, et sans cette
    // règle, la puce, les statuts et le surlignage resteraient invisibles.
    const { container } = render(PreuvesJuriX);
    await tick();
    expect(Observateur.dernier?.reglages.threshold).toEqual([0.1, 0.2, 0.3]);
    await voir(0.1, 0.3 * HAUTEUR_DE_L_ECRAN);
    expect(etat(container)).toBe('joue');
  });

  it('déjà à l’écran au montage : au repos, sans disparaître sous les yeux', async () => {
    placerLaGrille(100, 500);
    const { container } = render(PreuvesJuriX);
    await tick();
    expect(etat(container)).toBe('repos');
    expect(Observateur.dernier).toBeNull();
  });

  it('en mouvement réduit : au repos, sans observateur', async () => {
    mouvement.current = true;
    const { container } = render(PreuvesJuriX);
    await tick();
    expect(etat(container)).toBe('repos');
    expect(Observateur.dernier).toBeNull();
  });

  it('sans IntersectionObserver : au repos, rien ne l’aurait levé', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(PreuvesJuriX);
    await tick();
    expect(etat(container)).toBe('repos');
  });

  it('ne laisse ni observateur ni minuterie derrière elle', async () => {
    const { unmount } = render(PreuvesJuriX);
    await tick();
    await voir(0.3, 120);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    const { unmount: fermer } = render(PreuvesJuriX);
    await tick();
    const observateur = Observateur.dernier;
    fermer();
    expect(observateur?.deconnecte).toBe(true);
  });
});
