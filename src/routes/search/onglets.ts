/**
 * La bande des onglets de nature de /search (P7) : l'onglet choisi reste en vue.
 *
 * POURQUOI. Sous lg (téléphone, tablette), et sur écran court (téléphone en
 * paysage), la bande défile de côté, et elle s'ouvrait toujours à son début.
 * « Autres » choisi, l'onglet actif était entièrement hors de l'écran à
 * 390 px (on ne voyait que Tous, Décrets, Lois et le début d'« Arrêtés »), et
 * à moitié sous le fondu de droite en 740×360, son effectif caché : rien ne
 * disait quelle nature filtrait la liste, ni à quoi répondait l'état vide
 * juste dessous. La maquette recherche-vide-p7a montre l'onglet actif.
 *
 * COMMENT. La bande défile d'elle-même jusqu'à l'onglet actif : à l'affichage,
 * à chaque navigation (un autre onglet, « Voir les N textes, toutes
 * natures ») et quand sa largeur change (rotation, fenêtre redimensionnée).
 * SEULE LA BANDE défile, jamais la page : `scrollIntoView` ferait aussi
 * remonter jusqu'aux onglets une page ouverte sur `#resultats` (les numéros
 * de page y mènent).
 *
 * LES DEUX BORDS S'ESTOMPENT. Ouverte sur l'onglet actif, la bande coupait net
 * à gauche les onglets précédents : en 740×360, il ne restait de « Tous 23 »
 * qu'un « 3 » isolé collé au bord, qu'on prenait pour un glyphe parasite ; à
 * 390 px, « Arrêtés 0 » était tranché, et rien ne disait que « Tous » et
 * « Décrets » attendaient hors champ. Le fondu de droite, qui signale la
 * suite, a donc son pendant à gauche, posé SEULEMENT quand la bande a défilé
 * au point de couper un onglet (`data-defilee`, lu par la page) : au début de
 * la bande, il estomperait « Tous » sans rien cacher. Il mesure la marge de
 * début (`scroll-pl-10`) : un onglet aligné par la bande commence là où le
 * fondu finit, et seule la fin de l'onglet précédent y passe, estompée.
 */

/** Ce que l'on mesure de la bande, en px, dans le repère de son contenu (défilement compris). */
export interface MesureDeLaBande {
  /** Défilement horizontal actuel (`scrollLeft`). */
  defilement: number;
  /** Largeur visible de la bande (`clientWidth`). */
  largeur: number;
  /** Défilement maximal (`scrollWidth - clientWidth`). */
  max: number;
  /**
   * `scroll-padding-left` : là où la bande aligne le début d'un onglet
   * (`snap-start`). C'est aussi la largeur du fondu de gauche, présent dès
   * que la bande a défilé au-delà du premier onglet (`bandeDefilee`).
   */
  margeDeDebut: number;
  /** Largeur du fondu de droite, où un onglet ne se lit plus. */
  fondu: number;
  /** Bord gauche de chaque onglet. */
  onglets: number[];
  /** Bords gauche et droit de l'onglet actif. */
  actif: { debut: number; fin: number };
}

/** Une mesure au demi-pixel près ne doit pas faire défiler la bande pour rien. */
const TOLERANCE = 1;

function borner(valeur: number, max: number): number {
  return Math.min(Math.max(valeur, 0), max);
}

/**
 * La bande a défilé au-delà du début de son premier onglet : un onglet est
 * coupé à gauche, le fondu de gauche est posé (`data-defilee`). Pas avant :
 * en 740×360, la bande défile de 2 px pour sortir l'effectif d'« Autres » du
 * fondu de droite ; ces 2 px ne prennent que sa marge intérieure, aucun
 * onglet n'est caché, et un fondu y aurait estompé « Tous » pour rien.
 *
 * @param debutDuPremierOnglet bord gauche du premier onglet, dans le repère du
 *   contenu de la bande : sa marge intérieure (pl-4, pl-6)
 */
export function bandeDefilee(defilement: number, debutDuPremierOnglet = 0): boolean {
  return defilement > debutDuPremierOnglet + TOLERANCE;
}

/**
 * Le défilement qui montre l'onglet actif EN ENTIER, hors des deux fondus, ou
 * `null` s'il est déjà en vue.
 *
 * La bande s'arrête sur ses onglets (`snap-x`, `snap-start` : le début d'un
 * onglet aligné sur la marge de début, borné à ce que la bande peut
 * défiler). La position rendue est l'un de ces arrêts : entre deux, le
 * magnétisme de la bande la déplacerait après coup, parfois jusqu'à recacher
 * l'onglet. Parmi les arrêts qui montrent l'onglet, le plus proche : le moins
 * de mouvement possible, et les onglets voisins restent en vue.
 */
export function defilementVersLOngletActif(m: MesureDeLaBande): number | null {
  // Bande défilée, le fondu de gauche couvre sa marge de début ; au début, rien.
  const debutLisible = (defilement: number) =>
    defilement + (bandeDefilee(defilement, m.onglets[0] ?? 0) ? m.margeDeDebut : 0);
  const montre = (defilement: number) =>
    m.actif.debut >= debutLisible(defilement) - TOLERANCE &&
    m.actif.fin <= defilement + m.largeur - m.fondu + TOLERANCE;
  if (montre(m.defilement)) return null;
  const arrets = m.onglets.map((debut) => borner(debut - m.margeDeDebut, m.max)).filter(montre);
  if (arrets.length) {
    return arrets.reduce((proche, arret) =>
      Math.abs(arret - m.defilement) < Math.abs(proche - m.defilement) ? arret : proche,
    );
  }
  // Un onglet plus large que la partie lisible de la bande : son début, au moins.
  return borner(m.actif.debut - m.margeDeDebut, m.max);
}

/**
 * Action Svelte de la bande : `use:ongletActifEnVue={{ nature, natures }}`.
 * Le paramètre change avec ce qui déplace l'onglet actif : la nature choisie,
 * et les effectifs, qui changent la largeur des onglets (une autre requête,
 * même nature). Un objet, neuf à chaque navigation : Svelte 5 n'appelle
 * `update` que pour une valeur différente. La mesure attend l'image
 * suivante, quand la page porte déjà le nouvel onglet actif
 * (`aria-current="true"`).
 *
 * Le fondu de droite mesure exactement la marge de fin de la bande (`pr-10`
 * et `calc(100% - 2.5rem)` dans la page) : c'est elle qu'on lit. Là où la
 * bande ne défile pas (sur le bureau, à partir de lg, sur plusieurs rangées),
 * elle vaut 0 et rien ne bouge.
 *
 * L'action pose aussi `data-defilee` (le fondu de gauche) à chaque défilement,
 * du doigt comme du sien. Sans JavaScript, la bande s'ouvre à son début, où
 * ce fondu n'a rien à signaler : seul celui de droite, en CSS, est posé.
 */
export function ongletActifEnVue(bande: HTMLElement, _suivi?: unknown) {
  /** Une mesure attend l'image suivante. Un drapeau et non l'identifiant de l'image : il est levé avant l'appel. */
  let prevue = false;
  let image = 0;
  /**
   * Bord gauche du premier onglet dans le contenu de la bande (sa marge
   * intérieure). Relu à chaque mesure (navigation, redimensionnement) et non
   * à chaque défilement : il ne change qu'avec la mise en page.
   */
  let debutDuPremier = 0;

  /** Le fondu de gauche suit le défilement ; l'attribut n'est réécrit que s'il change. */
  function marquer() {
    const defilee = bandeDefilee(bande.scrollLeft, debutDuPremier);
    if (bande.hasAttribute('data-defilee') !== defilee) bande.toggleAttribute('data-defilee', defilee);
  }

  function montrer() {
    prevue = false;
    const premier = bande.firstElementChild;
    debutDuPremier = premier
      ? premier.getBoundingClientRect().left - bande.getBoundingClientRect().left + bande.scrollLeft
      : 0;
    const actif = bande.querySelector<HTMLElement>('[aria-current="true"]');
    if (actif && bande.scrollWidth > bande.clientWidth) {
      const style = getComputedStyle(bande);
      const origine = bande.getBoundingClientRect().left - bande.scrollLeft;
      const bords = (element: Element) => {
        const boite = element.getBoundingClientRect();
        return { debut: boite.left - origine, fin: boite.right - origine };
      };
      const cible = defilementVersLOngletActif({
        defilement: bande.scrollLeft,
        largeur: bande.clientWidth,
        max: bande.scrollWidth - bande.clientWidth,
        margeDeDebut: parseFloat(style.scrollPaddingLeft) || 0,
        fondu: parseFloat(style.paddingRight) || 0,
        onglets: [...bande.children].map((onglet) => bords(onglet).debut),
        actif: bords(actif),
      });
      if (cible !== null) bande.scrollLeft = cible;
    }
    // Aussitôt, sans attendre l'événement `scroll` : la bande revenue à son
    // début (fenêtre élargie jusqu'au bureau) n'en émet pas toujours un.
    marquer();
  }

  /** Une mesure par image au plus : navigation et redimensionnement peuvent tomber ensemble. */
  function planifier() {
    if (prevue || typeof requestAnimationFrame !== 'function') return;
    prevue = true;
    image = requestAnimationFrame(montrer);
  }

  const observateur = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(planifier) : null;
  observateur?.observe(bande);
  bande.addEventListener('scroll', marquer, { passive: true });
  planifier();

  return {
    update: planifier,
    destroy() {
      observateur?.disconnect();
      bande.removeEventListener('scroll', marquer);
      if (prevue) cancelAnimationFrame(image);
    },
  };
}
