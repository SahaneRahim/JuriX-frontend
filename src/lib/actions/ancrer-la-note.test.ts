import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ancrerLaNote, type OptionsDAncrage } from './ancrer-la-note';

/**
 * L'ancrage de la note de l'IA sur son passage (page de lecture). jsdom n'a
 * ni mise en page, ni `ResizeObserver`, ni `document.fonts`, ni `matchMedia`
 * qui suive une largeur : tout est simulé ici, et chaque déclencheur de
 * remesure (taille, polices, seuil de 1 280 px, autre article) est vérifié.
 */

type Rappel = () => void;

/** Les `ResizeObserver` créés, avec ce qu'ils observent. */
let observateurs: { rappel: Rappel; observes: Element[]; deconnecte: boolean }[] = [];
/** La requête média de la marge, réglable, et ses écouteurs. */
let largeurDeLaMarge: { matches: boolean; ecouteurs: Set<Rappel> };
/** `document.fonts` simulé : sa promesse et ses écouteurs. */
let polices: { finir: Rappel; ecouteurs: Set<Rappel> };

function rectangle(top: number, height = 20): DOMRect {
  return { top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** Une rangée « texte | marge », un passage dans le texte, aux positions voulues. */
function monter(haut: number, ligne: { top: number; height: number }) {
  const rangee = document.createElement('div');
  const lecture = document.createElement('div');
  const marge = document.createElement('aside');
  const passage = document.createElement('mark');
  lecture.append(passage);
  rangee.append(lecture, marge);
  document.body.append(rangee);
  const position = { haut, ligne };
  vi.spyOn(rangee, 'getBoundingClientRect').mockImplementation(() => rectangle(position.haut, 600));
  vi.spyOn(passage, 'getClientRects').mockImplementation(
    () => [rectangle(position.ligne.top, position.ligne.height)] as unknown as DOMRectList,
  );
  return { rangee, passage, position };
}

beforeEach(() => {
  observateurs = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      entree: { rappel: Rappel; observes: Element[]; deconnecte: boolean };
      constructor(rappel: Rappel) {
        this.entree = { rappel, observes: [], deconnecte: false };
        observateurs.push(this.entree);
      }
      observe(element: Element) {
        this.entree.observes.push(element);
      }
      disconnect() {
        this.entree.deconnecte = true;
      }
    },
  );
  // Une image = tout de suite : la mesure suit l'appel.
  vi.stubGlobal('requestAnimationFrame', (rappel: FrameRequestCallback) => {
    rappel(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  largeurDeLaMarge = { matches: true, ecouteurs: new Set() };
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (requete: string) =>
      ({
        get matches() {
          return largeurDeLaMarge.matches;
        },
        media: requete,
        addEventListener: (_type: string, rappel: Rappel) => largeurDeLaMarge.ecouteurs.add(rappel),
        removeEventListener: (_type: string, rappel: Rappel) => largeurDeLaMarge.ecouteurs.delete(rappel),
      }) as unknown as MediaQueryList,
  );

  let finir: Rappel = () => {};
  const pretes = new Promise<void>((resoudre) => (finir = resoudre));
  polices = { finir, ecouteurs: new Set() };
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      ready: pretes,
      addEventListener: (_type: string, rappel: Rappel) => polices.ecouteurs.add(rappel),
      removeEventListener: (_type: string, rappel: Rappel) => polices.ecouteurs.delete(rappel),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'fonts');
  document.body.innerHTML = '';
});

function options(passage: HTMLElement | null, surMesure: (d: number | null) => void, cle: unknown = 1): OptionsDAncrage {
  return { cible: () => passage, surMesure, milieuDeLigne: 17, cle };
}

describe('ancrerLaNote', () => {
  it('cale le trait sur la ligne du passage : top(mark) − top(rangée) + 17 − 28', () => {
    const { rangee, passage } = monter(100, { top: 230, height: 24 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    expect(surMesure).toHaveBeenLastCalledWith(230 - 100 + 17 - 28);
  });

  it('sans demi-interligne donné, vise le milieu mesuré de la première ligne', () => {
    const { rangee, passage } = monter(100, { top: 230, height: 34 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, { cible: () => passage, surMesure });
    expect(surMesure).toHaveBeenLastCalledWith(230 + 17 - 100 - 28);
  });

  it('borne le décalage à 0 : un passage tout en haut ne remonte pas la note', () => {
    const { rangee, passage } = monter(100, { top: 100, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    // 100 − 100 + 17 − 28 = −11 : la note reste en haut de la marge.
    expect(surMesure).toHaveBeenLastCalledWith(0);
  });

  it('sous 1 280 px (note sous le texte), ou sans passage : rien d’ancré', () => {
    largeurDeLaMarge.matches = false;
    const { rangee, passage } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    // Le rendu serveur n'est déjà pas ancré : rien à dire.
    expect(surMesure).not.toHaveBeenCalled();

    largeurDeLaMarge.matches = true;
    const sansPassage = vi.fn();
    ancrerLaNote(rangee, options(null, sansPassage));
    expect(sansPassage).not.toHaveBeenCalled();
  });

  it('suit le passage du seuil de 1 280 px, dans les deux sens', () => {
    const { rangee, passage } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    expect(surMesure).toHaveBeenLastCalledWith(189);
    largeurDeLaMarge.matches = false;
    for (const rappel of largeurDeLaMarge.ecouteurs) rappel();
    expect(surMesure).toHaveBeenLastCalledWith(null);
    largeurDeLaMarge.matches = true;
    for (const rappel of largeurDeLaMarge.ecouteurs) rappel();
    expect(surMesure).toHaveBeenLastCalledWith(189);
  });

  it('remesure quand la rangée ou ses colonnes changent de taille (ResizeObserver)', () => {
    const { rangee, passage, position } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    expect(observateurs).toHaveLength(1);
    // La rangée et ses deux colonnes.
    expect(observateurs[0].observes).toEqual([rangee, ...rangee.children]);
    position.ligne = { top: 380, height: 20 };
    observateurs[0].rappel();
    expect(surMesure).toHaveBeenLastCalledWith(269);
  });

  it('remesure quand les polices arrivent (`document.fonts.ready`, `loadingdone`)', async () => {
    const { rangee, passage, position } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    // Literata arrive : les lignes se recomposent, le passage descend.
    position.ligne = { top: 340, height: 20 };
    polices.finir();
    await Promise.resolve();
    await Promise.resolve();
    expect(surMesure).toHaveBeenLastCalledWith(229);
    position.ligne = { top: 360, height: 20 };
    for (const rappel of polices.ecouteurs) rappel();
    expect(surMesure).toHaveBeenLastCalledWith(249);
  });

  it('remesure au changement de `cle` (autre article), pas à une mise à jour sans changement', () => {
    const { rangee, passage, position } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    const action = ancrerLaNote(rangee, options(passage, surMesure, 'article-1'));
    expect(surMesure).toHaveBeenCalledTimes(1);
    position.ligne = { top: 420, height: 20 };
    action.update(options(passage, surMesure, 'article-1'));
    expect(surMesure).toHaveBeenCalledTimes(1);
    action.update(options(passage, surMesure, 'article-2'));
    expect(surMesure).toHaveBeenLastCalledWith(309);
  });

  it('ne rappelle pas pour un écart d’un pixel ou moins', () => {
    const { rangee, passage, position } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure));
    expect(surMesure).toHaveBeenCalledTimes(1);
    position.ligne = { top: 301, height: 20 };
    observateurs[0].rappel();
    expect(surMesure).toHaveBeenCalledTimes(1);
    position.ligne = { top: 303, height: 20 };
    observateurs[0].rappel();
    expect(surMesure).toHaveBeenCalledTimes(2);
    expect(surMesure).toHaveBeenLastCalledWith(192);
  });

  it('se nettoie à la destruction : plus d’observateur, plus d’écouteur, plus de mesure', async () => {
    const { rangee, passage } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    const action = ancrerLaNote(rangee, options(passage, surMesure));
    expect(largeurDeLaMarge.ecouteurs.size).toBe(1);
    expect(polices.ecouteurs.size).toBe(1);
    action.destroy();
    expect(observateurs[0].deconnecte).toBe(true);
    expect(largeurDeLaMarge.ecouteurs.size).toBe(0);
    expect(polices.ecouteurs.size).toBe(0);
    surMesure.mockClear();
    polices.finir();
    await Promise.resolve();
    await Promise.resolve();
    expect(surMesure).not.toHaveBeenCalled();
  });

  it('détruite alors qu’elle était ancrée, elle rend `null` : la page ne garde pas l’ancien décalage', () => {
    const { rangee, passage } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    ancrerLaNote(rangee, options(passage, surMesure)).destroy();
    expect(surMesure).toHaveBeenLastCalledWith(null);

    // Jamais ancrée : rien à défaire.
    const sansPassage = vi.fn();
    ancrerLaNote(rangee, options(null, sansPassage)).destroy();
    expect(sansPassage).not.toHaveBeenCalled();
  });

  it('sans ResizeObserver (navigateur ancien), suit la fenêtre', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { rangee, passage, position } = monter(100, { top: 300, height: 20 });
    const surMesure = vi.fn();
    const action = ancrerLaNote(rangee, options(passage, surMesure));
    position.ligne = { top: 500, height: 20 };
    window.dispatchEvent(new Event('resize'));
    expect(surMesure).toHaveBeenLastCalledWith(389);
    action.destroy();
    surMesure.mockClear();
    position.ligne = { top: 700, height: 20 };
    window.dispatchEvent(new Event('resize'));
    expect(surMesure).not.toHaveBeenCalled();
  });
});
