/**
 * Action Svelte : cale la note de l'IA (page de lecture) sur le passage
 * qu'elle explique. Posée sur la rangée « texte | marge », elle mesure où
 * tombe le milieu de la première ligne du passage clé (`<mark>`), et rend le
 * décalage à donner au haut de la marge pour que le trait de la note (à
 * `repere` px du haut de la note) arrive sur cette ligne :
 *
 *   décalage = max(0, milieu de la ligne − haut de la rangée − repere)
 *
 * (maquette RefonteLecture : `pt = hl.top − row.top + 17 − 28`, 17 étant le
 * demi-interligne de 34,2 px.) `null` quand la note n'est pas dans la marge
 * (sous 1 280 px, elle passe sous le texte) ou qu'aucun passage n'est
 * surligné (décision L2 : la v1 n'en a pas, la note reste en haut de la
 * marge, sans trait ni point).
 *
 * POURQUOI UNE MESURE EN JAVASCRIPT, REFAITE. La position d'une ligne dépend
 * de la largeur de la colonne ET de la police : Literata est servie sans
 * préchargement (`font-display: swap`) et peut arriver après le premier rendu,
 * les lignes se recomposent alors (PASSATION § 8, piège 13). La mesure est
 * donc refaite au redimensionnement de la rangée et de ses colonnes
 * (`ResizeObserver`, qui voit aussi le texte s'allonger quand la police
 * arrive), au chargement des polices (`document.fonts`), au passage du seuil
 * de 1 280 px (`matchMedia`) et à chaque changement de `cle` (autre article,
 * passages arrivés). Une image plus tard au plus (`requestAnimationFrame`),
 * une fois par image.
 *
 * POURQUOI LE RENDU SERVEUR N'EST PAS ANCRÉ. Une action ne tourne pas au
 * rendu serveur : le HTML en cache (ISR) montre la note au repos, en haut de
 * la marge, sans trait. Rien ne dépend du visiteur.
 *
 * Seuls `top` et la hauteur des boîtes sont lus : le glissement horizontal du
 * feuilletage (`translateX`) ne change pas la mesure. Le décalage n'est rendu
 * que s'il change de plus d'un pixel, pour qu'un arrondi ne fasse pas trembler
 * la note.
 */

/** La largeur à partir de laquelle la note est dans la marge, à droite du texte. */
export const REQUETE_DE_LA_MARGE = '(min-width: 1280px)';

/** Ordonnée du trait dans la note, en pixels depuis son haut (maquette : 28). */
export const REPERE_DU_TRAIT = 28;

export interface OptionsDAncrage {
  /** Le passage qui ancre la note (le premier `<mark>` clé de l'article lu), ou `null`. */
  cible: () => HTMLElement | null;
  /** Ordonnée du trait dans la note (px). Par défaut 28. */
  repere?: number;
  /**
   * Distance du haut de la ligne à son milieu (px), comme la maquette (17).
   * Absente : le milieu de la première boîte de ligne du passage, mesuré, qui
   * suit la taille et l'interligne réels du texte.
   */
  milieuDeLigne?: number;
  /** Requête média de la note dans la marge. Par défaut `(min-width: 1280px)`. */
  requete?: string;
  /** Reçoit le décalage (px), ou `null` : note non ancrée. */
  surMesure: (decalage: number | null) => void;
  /** Change quand l'article ou ses passages changent : la mesure est refaite. */
  cle?: unknown;
}

function plusTard(fonction: () => void): { annuler: () => void } {
  if (typeof requestAnimationFrame === 'function') {
    const image = requestAnimationFrame(fonction);
    return { annuler: () => cancelAnimationFrame(image) };
  }
  const minuterie = setTimeout(fonction, 0);
  return { annuler: () => clearTimeout(minuterie) };
}

export function ancrerLaNote(rangee: HTMLElement, options: OptionsDAncrage) {
  let reglages = options;
  // Le rendu serveur est « non ancré » : rien à dire tant que ça ne change pas.
  let dernier: number | null = null;
  /** Une mesure est déjà prévue pour la prochaine image, et de quoi l'annuler. */
  let enAttente = false;
  let annuler: () => void = () => {};
  // Une mesure promise par `document.fonts.ready` peut arriver après la
  // destruction : elle ne fait plus rien.
  let detruite = false;

  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(reglages.requete ?? REQUETE_DE_LA_MARGE)
      : null;

  function mesurer() {
    let decalage: number | null = null;
    const cible = reglages.cible();
    if (media?.matches && cible && rangee.contains(cible)) {
      const haut = rangee.getBoundingClientRect().top;
      // La PREMIÈRE ligne du passage : un `<mark>` en ligne a une boîte par
      // ligne ; sa boîte englobante commencerait au même endroit, mais sa
      // hauteur serait celle de tout le passage.
      const ligne = cible.getClientRects()[0] ?? cible.getBoundingClientRect();
      const milieu =
        reglages.milieuDeLigne !== undefined ? ligne.top + reglages.milieuDeLigne : ligne.top + ligne.height / 2;
      decalage = Math.max(0, Math.round(milieu - haut - (reglages.repere ?? REPERE_DU_TRAIT)));
    }
    if (decalage === dernier) return;
    if (decalage !== null && dernier !== null && Math.abs(decalage - dernier) <= 1) return;
    dernier = decalage;
    reglages.surMesure(decalage);
  }

  function planifier() {
    if (detruite || enAttente) return;
    // Le drapeau AVANT de prévoir : une image qui passerait tout de suite
    // (rappel synchrone) le remet à faux, et la mesure suivante reste possible.
    enAttente = true;
    annuler = plusTard(() => {
      enAttente = false;
      mesurer();
    }).annuler;
  }

  // La rangée et ses colonnes : le texte qui s'allonge (police arrivée,
  // fenêtre plus étroite) déplace la ligne du passage sans toujours changer la
  // hauteur de la rangée, que la marge peut dépasser.
  const observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(planifier) : null;
  if (observateur) {
    observateur.observe(rangee);
    for (const colonne of Array.from(rangee.children)) observateur.observe(colonne);
  } else if (typeof window !== 'undefined') {
    // Navigateur ancien, ou jsdom : la fenêtre seule.
    window.addEventListener('resize', planifier);
  }

  const polices = typeof document !== 'undefined' ? document.fonts : undefined;
  void polices?.ready?.then(planifier);
  polices?.addEventListener?.('loadingdone', planifier);
  media?.addEventListener?.('change', planifier);

  planifier();

  return {
    update(suivants: OptionsDAncrage) {
      const changee = suivants.cle !== reglages.cle;
      reglages = suivants;
      if (changee) planifier();
    },
    destroy() {
      detruite = true;
      annuler();
      // La rangée disparaît (passage au texte entier) : au retour, une action
      // neuve repart de « non ancrée », et ne dirait rien si la mesure le
      // reste ; la page garderait l'ancien décalage sous une note sans passage.
      if (dernier !== null) reglages.surMesure(null);
      observateur?.disconnect();
      if (!observateur && typeof window !== 'undefined') window.removeEventListener('resize', planifier);
      polices?.removeEventListener?.('loadingdone', planifier);
      media?.removeEventListener?.('change', planifier);
    },
  };
}
