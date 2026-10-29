import { afterEach, describe, expect, it, vi } from 'vitest';
import { bandeDefilee, defilementVersLOngletActif, ongletActifEnVue, type MesureDeLaBande } from './onglets';

/**
 * L'onglet de nature choisi reste en vue dans la bande qui défile (P7), hors
 * des deux fondus, sur les mesures de la page à 390 px (search-vide-nature,
 * onglet « Autres » actif) : Tous 23, Décrets 12, Lois 7, Arrêtés 0, Actes
 * uniformes 4, Autres 0.
 */

/**
 * 390 px : bande pleine largeur ; marge de début de 40 px (scroll-pl-10), qui
 * mesure le fondu de gauche ; fondu et marge de fin de 40 px (pr-10).
 */
const TELEPHONE = {
  largeur: 390,
  max: 328,
  margeDeDebut: 40,
  fondu: 40,
  onglets: [16, 110, 226, 310, 418, 584],
};
const FIN_DES_ONGLETS = [102, 218, 302, 410, 576, 678];

/** La bande de 390 px défilée de `defilement`, l'onglet n° `actif` choisi. */
function mesure(defilement: number, actif: number): MesureDeLaBande {
  return { ...TELEPHONE, defilement, actif: { debut: TELEPHONE.onglets[actif], fin: FIN_DES_ONGLETS[actif] } };
}

describe('defilementVersLOngletActif', () => {
  it('« Autres », hors de l’écran à l’ouverture : la bande va jusqu’au bout, l’onglet hors du fondu', () => {
    const cible = defilementVersLOngletActif(mesure(0, 5));
    expect(cible).toBe(328);
    // Visible en entier : son bord droit finit avant le fondu de droite, son
    // bord gauche après celui de gauche.
    expect(678 - 328).toBeLessThanOrEqual(390 - 40);
    expect(584 - 328).toBeGreaterThanOrEqual(40);
  });

  it('« Arrêtés », sous le fondu : le premier arrêt qui le montre, Tous caché le moins possible', () => {
    // Arrêts : 0, 70 (Décrets à 40 px du bord, juste après le fondu de
    // gauche), 186 (Lois), 270 (Arrêtés), 328 (bout de la bande).
    expect(defilementVersLOngletActif(mesure(0, 3))).toBe(70);
  });

  it('déjà en vue : rien ne bouge', () => {
    expect(defilementVersLOngletActif(mesure(0, 0))).toBeNull();
    expect(defilementVersLOngletActif(mesure(0, 2))).toBeNull();
    expect(defilementVersLOngletActif(mesure(328, 5))).toBeNull();
  });

  it('retour à « Tous » depuis le bout de la bande : vers la gauche, jusqu’au début', () => {
    expect(defilementVersLOngletActif(mesure(328, 0))).toBe(0);
    // « Décrets » : l'arrêt le plus proche qui le montre en entier, hors du fondu de gauche.
    expect(defilementVersLOngletActif(mesure(328, 1))).toBe(70);
  });

  it('bande défilée : un onglet sous le fondu de gauche n’est pas « en vue »', () => {
    // 640 px, bande jusqu'aux bords (pl-6) : Tous 137, Décrets 61, Lois 38,
    // Arrêtés 21, Actes uniformes 9, Autres 8, défilée jusqu'au bout.
    const tablette = { largeur: 640, max: 129, margeDeDebut: 40, fondu: 40, onglets: [24, 133, 253, 349, 466, 634] };
    // « Décrets » commence 4 px après le bord : dans le fondu de gauche. La
    // bande revient à l'arrêt qui le pose juste après ce fondu.
    expect(defilementVersLOngletActif({ ...tablette, defilement: 129, actif: { debut: 133, fin: 245 } })).toBe(93);
    // « Autres », depuis le début : le bout de la bande.
    expect(defilementVersLOngletActif({ ...tablette, defilement: 0, actif: { debut: 634, fin: 729 } })).toBe(129);
  });

  it('au début de la bande, pas de fondu de gauche : le premier onglet est en vue', () => {
    // Le premier onglet commence à 16 px (pl-4) : tant que la bande n'a pas
    // défilé au-delà, aucun onglet n'est coupé, aucun fondu ne le couvre.
    expect(defilementVersLOngletActif(mesure(0, 0))).toBeNull();
    expect(bandeDefilee(0, 16)).toBe(false);
    expect(bandeDefilee(17, 16)).toBe(false);
    expect(bandeDefilee(18, 16)).toBe(true);
  });

  it('740×360 : 2 px de défilement pour l’effectif d’« Autres », sans fondu à gauche', () => {
    // Bande jusqu'aux bords (pl-6) : les six onglets tiennent presque, à 2 px.
    const court = { largeur: 740, max: 2, margeDeDebut: 40, fondu: 40, onglets: [24, 124, 244, 328, 436, 607] };
    const cible = defilementVersLOngletActif({ ...court, defilement: 0, actif: { debut: 607, fin: 702 } });
    expect(cible).toBe(2);
    // « Tous » reste entier : ces 2 px ne prennent que la marge intérieure.
    expect(bandeDefilee(cible as number, court.onglets[0])).toBe(false);
  });

  it('un onglet plus large que la partie lisible : son début', () => {
    const etroite = { largeur: 120, max: 400, margeDeDebut: 16, fondu: 40, onglets: [16, 200] };
    expect(defilementVersLOngletActif({ ...etroite, defilement: 0, actif: { debut: 200, fin: 380 } })).toBe(184);
  });
});

describe('ongletActifEnVue', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Les images passent aussitôt : la mesure suit l'appel. */
  function imagesImmediates() {
    vi.stubGlobal('requestAnimationFrame', (rappel: FrameRequestCallback) => {
      rappel(0);
      return 1;
    });
  }

  /** La bande de 390 px, « Autres » actif, mesurée comme le ferait le navigateur. */
  function bandeMesuree() {
    const bande = document.createElement('div');
    TELEPHONE.onglets.forEach((debut, i) => {
      const onglet = document.createElement('a');
      if (i === 5) onglet.setAttribute('aria-current', 'true');
      onglet.getBoundingClientRect = () =>
        ({ left: debut - bande.scrollLeft, right: FIN_DES_ONGLETS[i] - bande.scrollLeft }) as DOMRect;
      bande.append(onglet);
    });
    bande.getBoundingClientRect = () => ({ left: 0, right: 390 }) as DOMRect;
    Object.defineProperty(bande, 'clientWidth', { value: 390 });
    Object.defineProperty(bande, 'scrollWidth', { value: 718 });
    bande.style.paddingRight = '40px';
    bande.style.scrollPaddingLeft = '40px';
    document.body.append(bande);
    return bande;
  }

  it('fait défiler la bande seule, jamais la page', () => {
    imagesImmediates();
    const defilementDeLaPage = vi.fn();
    vi.stubGlobal('scrollTo', defilementDeLaPage);
    const bande = bandeMesuree();

    const action = ongletActifEnVue(bande, 'autres');

    expect(bande.scrollLeft).toBe(328);
    expect(defilementDeLaPage).not.toHaveBeenCalled();
    action.destroy();
    bande.remove();
  });

  it('suit l’onglet actif à chaque navigation, et pose le fondu de gauche seulement bande défilée', () => {
    imagesImmediates();
    const bande = bandeMesuree();
    const action = ongletActifEnVue(bande, 'autres');
    expect(bande.scrollLeft).toBe(328);
    expect(bande.hasAttribute('data-defilee')).toBe(true);

    // « Voir les N textes, toutes natures » : « Tous » devient l'onglet actif.
    bande.children[5].removeAttribute('aria-current');
    bande.children[0].setAttribute('aria-current', 'true');
    action.update();

    expect(bande.scrollLeft).toBe(0);
    expect(bande.hasAttribute('data-defilee')).toBe(false);
    action.destroy();
    bande.remove();
  });

  it('suit le défilement au doigt', () => {
    imagesImmediates();
    const bande = bandeMesuree();
    bande.children[5].removeAttribute('aria-current');
    bande.children[0].setAttribute('aria-current', 'true');
    const action = ongletActifEnVue(bande, 'tous');
    expect(bande.hasAttribute('data-defilee')).toBe(false);

    bande.scrollLeft = 120;
    bande.dispatchEvent(new Event('scroll'));
    expect(bande.hasAttribute('data-defilee')).toBe(true);

    // 10 px : dans la marge intérieure (16 px), « Tous » n'est pas coupé.
    bande.scrollLeft = 10;
    bande.dispatchEvent(new Event('scroll'));
    expect(bande.hasAttribute('data-defilee')).toBe(false);

    // Retirée de la page, la bande n'est plus suivie.
    action.destroy();
    bande.scrollLeft = 120;
    bande.dispatchEvent(new Event('scroll'));
    expect(bande.hasAttribute('data-defilee')).toBe(false);
    bande.remove();
  });
});
