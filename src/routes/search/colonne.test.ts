import { afterEach, describe, expect, it, vi } from 'vitest';
import { collanteSiElleTient, colonneTient, ECART_DU_BAS, ECART_DU_HAUT } from './colonne';

/**
 * La colonne de filtres de /search ne colle que si elle tient entière dans la
 * fenêtre (P7) : sinon elle suit la page, et aucune case n'est jamais cachée
 * derrière un défilement propre à la colonne.
 */

describe('colonneTient', () => {
  it('une colonne de 845 px tient en 1440×900 sous ses 16 px, pas en 1024×768', () => {
    expect(845 + ECART_DU_HAUT + ECART_DU_BAS).toBeLessThanOrEqual(900);
    expect(colonneTient(845, 900)).toBe(true);
    expect(colonneTient(845, 768)).toBe(false);
  });

  it('à la limite : écarts du haut et du bas compris', () => {
    expect(colonneTient(900 - ECART_DU_HAUT - ECART_DU_BAS, 900)).toBe(true);
    expect(colonneTient(901 - ECART_DU_HAUT - ECART_DU_BAS, 900)).toBe(false);
  });

  it('une colonne masquée (repliée sous lg) ne colle pas', () => {
    expect(colonneTient(0, 900)).toBe(false);
  });
});

describe('collanteSiElleTient', () => {
  const hauteurDuSetup = window.innerHeight;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'innerHeight', { value: hauteurDuSetup, configurable: true });
  });

  /** Les images passent aussitôt : la mesure suit l'appel. */
  function imagesImmediates() {
    vi.stubGlobal('requestAnimationFrame', (rappel: FrameRequestCallback) => {
      rappel(0);
      return 1;
    });
  }

  function colonneDe(hauteur: { valeur: number }) {
    const colonne = document.createElement('form');
    Object.defineProperty(colonne, 'offsetHeight', { get: () => hauteur.valeur, configurable: true });
    document.body.append(colonne);
    return colonne;
  }

  it('pose `data-collante` quand la colonne tient, le retire quand la fenêtre rapetisse', () => {
    imagesImmediates();
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    const colonne = colonneDe({ valeur: 845 });

    const action = collanteSiElleTient(colonne);
    expect(colonne.hasAttribute('data-collante')).toBe(true);

    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(colonne.hasAttribute('data-collante')).toBe(false);

    action.destroy();
    colonne.remove();
  });

  it('trop haute pour la fenêtre : elle suit la page', () => {
    imagesImmediates();
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
    const colonne = colonneDe({ valeur: 1072 });

    const action = collanteSiElleTient(colonne);
    expect(colonne.hasAttribute('data-collante')).toBe(false);

    action.destroy();
    colonne.remove();
  });

  it('retirée de la page, elle n’écoute plus la fenêtre', () => {
    imagesImmediates();
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    const colonne = colonneDe({ valeur: 845 });
    const action = collanteSiElleTient(colonne);
    action.destroy();

    Object.defineProperty(window, 'innerHeight', { value: 1200, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(colonne.hasAttribute('data-collante')).toBe(false);
    colonne.remove();
  });
});
