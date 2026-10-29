import { afterEach, describe, expect, it, vi } from 'vitest';
import { _oublierLesPolicesDemandees, preparerLesPolicesDeLApercu } from './polices';

/**
 * L'aperçu d'une citation demande Literata texte (400 et 600) d'avance, une
 * seule fois, au repos du navigateur : en `optional`, une police arrivée
 * après l'ouverture de l'aperçu restait écartée pour la visite.
 */
describe('preparerLesPolicesDeLApercu', () => {
  const fontsDOrigine = Object.getOwnPropertyDescriptor(document, 'fonts');

  afterEach(() => {
    _oublierLesPolicesDemandees();
    if (fontsDOrigine) Object.defineProperty(document, 'fonts', fontsDOrigine);
    else delete (document as unknown as { fonts?: unknown }).fonts;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function simulerLesPolices() {
    const load = vi.fn((_police: string) => Promise.resolve([] as FontFace[]));
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load } });
    return load;
  }

  it('demande les deux graisses au repos du navigateur, une seule fois', () => {
    const load = simulerLesPolices();
    const auRepos = vi.fn((rappel: () => void) => {
      rappel();
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', auRepos);

    preparerLesPolicesDeLApercu();
    preparerLesPolicesDeLApercu();

    expect(auRepos).toHaveBeenCalledTimes(1);
    expect(load.mock.calls.map(([police]) => police)).toEqual([
      '400 1em "Literata Texte"',
      '600 1em "Literata Texte"',
    ]);
  });

  it('sans requestIdleCallback (Safari), un peu plus tard', () => {
    vi.useFakeTimers();
    const load = simulerLesPolices();
    vi.stubGlobal('requestIdleCallback', undefined);

    preparerLesPolicesDeLApercu();
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('sans API des polices (jsdom, vieux navigateur) : rien, sans erreur', () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    expect(() => preparerLesPolicesDeLApercu()).not.toThrow();
  });
});
