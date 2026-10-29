/**
 * La colonne de filtres de /search (P7) ne colle au haut de l'écran que si
 * elle y tient EN ENTIER.
 *
 * POURQUOI. Collante et bornée à la hauteur de la fenêtre, elle défilait en
 * elle-même dès que son contenu (environ 850 px : trois dates, quatorze
 * domaines) dépassait. En 1440×900, la dernière case (« Éducation, culture
 * et médias ») était coupée à mi-ligne par le bas du panneau ; en 1024×768,
 * quatre domaines ne se voyaient qu'en faisant défiler le panneau lui-même :
 * un défilement dans le défilement, que seule une ombre signalait. Collante
 * sans borne, elle aurait caché son bas jusqu'à la fin des résultats.
 *
 * Elle suit donc le flux de la page, et se lit en entier en descendant. La
 * maquette recherche-p7a la voulait collante (`lg:sticky`) : elle le reste là
 * où elle tient tout entière sous son décalage. Sur un grand écran, les
 * filtres restent sous la main pendant qu'on parcourt les vingt résultats,
 * sans jamais rien cacher. La hauteur se MESURE (langue, police, pointeur fin
 * ou tactile, effectifs changent celle de la colonne) : une media query de
 * hauteur n'en serait qu'une estimation.
 *
 * Sans JavaScript, la colonne ne colle jamais : c'est le cas sûr. Coller
 * après l'hydratation ne déplace rien : un élément collant garde sa place tant
 * que la page n'a pas défilé jusqu'à lui (voir aussi `ECART_DU_HAUT`).
 */

/**
 * Écart entre le haut de l'écran et la colonne collée : `lg:data-[collante]:top-4`
 * dans la page. 16 px et non les 96 de la maquette (`top-24`) : l'en-tête du
 * site ne colle pas sur /search, ces 96 px seraient restés vides au-dessus de
 * la colonne, et c'étaient 80 px de moins pour qu'elle tienne dans l'écran.
 * 16 px, comme la marge d'arrivée sur `#resultats` (`scroll-mt-4`), où mènent
 * les numéros de page : la colonne y est déjà à 16 px du haut, et devenir
 * collante à l'hydratation ne la déplace pas.
 */
export const ECART_DU_HAUT = 16;
/** Marge gardée sous la colonne collée, pour que sa bordure basse reste visible. */
export const ECART_DU_BAS = 16;

/** Vrai quand la colonne, collée à `ECART_DU_HAUT`, tient entière dans la fenêtre. */
export function colonneTient(hauteurDeLaColonne: number, hauteurDeLaFenetre: number): boolean {
  // Une colonne masquée (repliée sous lg) mesure 0 : rien à coller.
  return hauteurDeLaColonne > 0 && hauteurDeLaColonne + ECART_DU_HAUT + ECART_DU_BAS <= hauteurDeLaFenetre;
}

/**
 * Action Svelte de la colonne : `use:collanteSiElleTient`. Elle pose
 * `data-collante` quand la colonne tient dans la fenêtre, que la page lit
 * (`lg:data-[collante]:sticky`). Mesurée à l'affichage, quand la colonne change
 * de taille (effectifs, langue, police chargée) et quand la fenêtre change de
 * hauteur.
 */
export function collanteSiElleTient(colonne: HTMLElement) {
  /** Une mesure attend l'image suivante. Un drapeau et non l'identifiant de l'image : il est levé avant l'appel. */
  let prevue = false;
  let image = 0;

  function mesurer() {
    prevue = false;
    const tient = colonneTient(colonne.offsetHeight, window.innerHeight);
    if (colonne.hasAttribute('data-collante') !== tient) colonne.toggleAttribute('data-collante', tient);
  }

  /** Une mesure par image au plus : la colonne et la fenêtre changent souvent ensemble. */
  function planifier() {
    if (prevue || typeof requestAnimationFrame !== 'function') return;
    prevue = true;
    image = requestAnimationFrame(mesurer);
  }

  const observateur = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(planifier) : null;
  observateur?.observe(colonne);
  window.addEventListener('resize', planifier);
  planifier();

  return {
    destroy() {
      observateur?.disconnect();
      window.removeEventListener('resize', planifier);
      if (prevue) cancelAnimationFrame(image);
    },
  };
}
