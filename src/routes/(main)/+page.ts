import { browser } from '$app/environment';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { leverIndisponible } from '$lib/panne';
import type { Category } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Catégories de la page d'accueil, chargées AVANT le rendu.
 *
 * POURQUOI UN `load` PLUTÔT QU'UN `onMount`. Chargée dans `onMount`, la grille
 * des catégories n'apparaissait qu'après l'exécution du JavaScript : le HTML
 * expédié n'en contenait rien. Un `load` universel la fait rendre par le
 * serveur, avec la page.
 *
 * Le `fetch` vient du paramètre, jamais du global : c'est lui qui transmet la
 * réponse du serveur au client, ce qui évite le SECOND appel réseau que le même
 * code referait à l'hydratation.
 */
export const load: PageLoad = async ({ fetch }) => {
  let cause: unknown;
  try {
    const reponse = await fetch(`${API_URL}/categories`, { signal: AbortSignal.timeout(DELAI_API_MS) });
    if (reponse.ok) {
      const categories: Category[] = await reponse.json();
      return { categories, erreur: '' };
    }
    cause = reponse;
  } catch (e) {
    cause = e;
  }

  // Au rendu serveur, un 503 ($lib/panne) : l'accueil est la page la plus
  // explorée du site, et sa version « Impossible de charger », sans aucun lien
  // de catégorie, serait indexée telle quelle. Dans le navigateur (retour à
  // l'accueil, reprise par invalidateAll), la page garde son message et sa
  // reprise. Le chemin est écrit en dur : lire `url` ferait rejouer ce `load`
  // à chaque changement d'adresse.
  if (!browser) leverIndisponible('/', cause);
  return { categories: [] as Category[], erreur: 'categories.errorLoad' };
};
