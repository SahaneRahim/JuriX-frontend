/**
 * Pagination, pour toute l'application.
 *
 * POURQUOI. Quatre implémentations coexistaient, avec quatre noms pour la même
 * constante — `itemsPerPage`, `RESULTS_PER_PAGE`, `PAGE_SIZE`, `PAR_PAGE` — et
 * deux blocs `visiblePages` de 22 et 7 lignes appliquant des règles
 * incompatibles : sept numéros avec ellipses d'un côté, cinq sans de l'autre.
 * `Math.ceil(n / taille)` était réécrit quatre fois, et deux d'entre eux
 * oubliaient de protéger le minimum à 1 : sur une liste vide,
 * `/admin/documents` calculait `totalPages = 0`, ce qui rendait
 * `disabled={currentPage === totalPages}` faux et activait « Suivant » sur une
 * liste sans page suivante.
 */

/** Taille de page par défaut des écrans d'administration. */
export const TAILLE_PAGE_ADMIN = 15;

/**
 * Taille de page de la recherche.
 *
 * 20 et non davantage : `SearchRequest.limit` est plafonné à 50 côté API
 * (`app/schemas/search.py`).
 */
export const TAILLE_PAGE_RECHERCHE = 20;

/**
 * Taille de page de la liste publique du corpus.
 *
 * Vit ici et non dans `src/routes/laws/+page.ts` : un `+page.ts` n'accepte que
 * les exports que SvelteKit connaît (`load`, `prerender`, `ssr`…) et refuse le
 * reste au moment de la construction. Une constante partagée entre le `load` et
 * son composant n'a donc pas d'autre endroit où vivre — et c'est de toute façon
 * ici que vivent déjà ses deux sœurs.
 */
export const TAILLE_PAGE_LOIS = 20;

/**
 * Nombre total de pages, jamais inférieur à 1.
 *
 * Le minimum n'est pas cosmétique : sans lui, une liste vide donne 0, et toute
 * comparaison `page === totalPages` devient fausse.
 */
export function nombreDePages(total: number, taille: number): number {
  if (taille <= 0) return 1;
  return Math.max(1, Math.ceil(total / taille));
}

/**
 * Fenêtre de numéros à afficher autour de la page courante.
 *
 * Une seule règle pour toute l'application : au plus `span` numéros contigus,
 * centrés sur la page courante, sans ellipse. Les ellipses de l'ancienne
 * version admin obligeaient à distinguer `number` et `string` dans le rendu,
 * pour un gain de lisibilité nul en dessous de quelques dizaines de pages.
 */
export function pagesVisibles(
  pageCourante: number,
  totalPages: number,
  span = 5,
): number[] {
  if (totalPages <= 1) return [1];
  let debut = Math.max(1, pageCourante - Math.floor(span / 2));
  const fin = Math.min(totalPages, debut + span - 1);
  debut = Math.max(1, fin - span + 1);
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}

/** Découpe côté client, quand la liste entière est déjà chargée. */
export function trancheDePage<T>(
  items: readonly T[],
  pageCourante: number,
  taille: number,
): T[] {
  const debut = (pageCourante - 1) * taille;
  return items.slice(debut, debut + taille);
}
